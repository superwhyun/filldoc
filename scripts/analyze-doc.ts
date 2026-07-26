#!/usr/bin/env -S node --experimental-strip-types
/**
 * 실제로 작성된 예시 .docx(또는 .pdf/.txt/.md) 문서를 분석해서
 * 재사용 가능한 RepGen 템플릿({{placeholder}} 포함)을 생성하는 독립 CLI.
 * Hermes 같은 외부 에이전트가 "skill"로 직접 호출하기 위한 용도.
 *
 * 사용법:
 *   OPENAI_API_KEY=sk-... repgen-analyze-doc \
 *     --source ./예시-회의록.docx \
 *     --output ./새템플릿.docx \
 *     [--provider openai|grok] [--api-key sk-...] [--template-name 이름]
 */
import { readFileSync, writeFileSync } from "node:fs"
import { basename } from "node:path"

import { extractTextFromBuffer, ExtractTextError } from "../lib/server/extract-text.ts"
import { extractPlaceholders } from "../lib/server/extract-placeholders.ts"
import { generateTemplateFromSample, type TemplateAIProvider } from "../lib/client-template-generator.ts"

type CliArgs = {
  source: string
  output: string
  provider: TemplateAIProvider
  apiKey?: string
  templateName?: string
}

function printUsage() {
  console.error(`사용법:
  repgen-analyze-doc --source <예시.docx> --output <새템플릿.docx> [--provider openai|grok] [--api-key <key>] [--template-name <이름>]

옵션:
  --source         실제로 작성 완료된 예시 문서 경로 (.docx/.pdf/.txt/.md) (필수)
  --output         생성된 템플릿 .docx 저장 경로 (필수)
  --provider       openai | grok (기본값: openai)
  --api-key        AI API 키. 생략 시 OPENAI_API_KEY / XAI_API_KEY 환경변수 사용
  --template-name  생성될 템플릿의 선호 파일명(확장자 없이/있이 모두 가능)

예시:
  OPENAI_API_KEY=sk-... repgen-analyze-doc --source ./예시-회의록.docx --output ./.skills/filldoc/templates/wg-recommendations.docx`)
}

function parseArgs(argv: string[]): CliArgs {
  const map = new Map<string, string>()

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith("--")) continue
    const key = arg.slice(2)
    const value = argv[i + 1]
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`--${key} 옵션에 값이 필요합니다.`)
    }
    map.set(key, value)
    i++
  }

  const source = map.get("source")
  const output = map.get("output")

  if (!source || !output) {
    printUsage()
    throw new Error("--source, --output은 필수입니다.")
  }

  const providerRaw = map.get("provider") ?? "openai"
  if (providerRaw !== "openai" && providerRaw !== "grok") {
    throw new Error(`--provider는 openai 또는 grok만 허용됩니다. (입력값: ${providerRaw})`)
  }

  return {
    source,
    output,
    provider: providerRaw,
    apiKey: map.get("api-key"),
    templateName: map.get("template-name"),
  }
}

function resolveApiKey(args: CliArgs): string {
  if (args.apiKey) return args.apiKey

  const envKey = args.provider === "openai" ? process.env.OPENAI_API_KEY : process.env.XAI_API_KEY
  if (envKey) return envKey

  const envName = args.provider === "openai" ? "OPENAI_API_KEY" : "XAI_API_KEY"
  throw new Error(`API 키가 없습니다. --api-key를 전달하거나 ${envName} 환경변수를 설정해주세요.`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const apiKey = resolveApiKey(args)

  let sourceBuffer: Buffer
  try {
    sourceBuffer = readFileSync(args.source)
  } catch (error: any) {
    throw new Error(`예시 문서를 읽을 수 없습니다: ${args.source} (${error.message})`)
  }

  const filename = basename(args.source)
  let sourceText: string
  try {
    sourceText = await extractTextFromBuffer(sourceBuffer, filename)
  } catch (error: any) {
    if (error instanceof ExtractTextError) {
      throw new Error(`${filename}: ${error.message}`)
    }
    throw error
  }

  const { file, spec } = await generateTemplateFromSample({
    provider: args.provider,
    apiKey,
    sourceText,
    templateName: args.templateName,
  })

  const outputBuffer = Buffer.from(await file.arrayBuffer())
  writeFileSync(args.output, outputBuffer)

  // 생성된 템플릿이 실제로 파싱 가능한지(문법 오류 없는지) 바로 확인해서 결과에 포함한다.
  const validation = extractPlaceholders(outputBuffer)

  const loopKeys = spec.blocks
    .filter((b): b is Extract<typeof b, { type: "repeating_section" }> => b.type === "repeating_section")
    .map((b) => b.loopName)
  const tableLoopKeys = validation.ok
    ? validation.placeholders.filter((p) => p.isLoop && !loopKeys.includes(p.key)).map((p) => p.key)
    : []

  console.log(
    JSON.stringify(
      {
        output: args.output,
        placeholderCount: validation.ok ? validation.placeholders.length : null,
        repeatingSectionKeys: loopKeys,
        tableLoopKeys,
        templateValid: validation.ok,
        templateValidationError: validation.ok ? undefined : validation.error,
      },
      null,
      2,
    ),
  )

  if (!validation.ok) {
    console.error(`경고: 생성된 템플릿이 문법 검증을 통과하지 못했습니다. repgen-extract-doc으로 다시 확인하세요.`)
    for (const v of validation.validations) console.error(`  - ${v}`)
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`오류: ${message}`)
  if (process.env.DEBUG) console.error(error)
  process.exit(1)
})
