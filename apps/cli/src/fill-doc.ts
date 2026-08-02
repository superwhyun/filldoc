#!/usr/bin/env node
/**
 * 브라우저/Next 서버 없이 템플릿+데이터로 문서를 채우는 독립 CLI.
 * Hermes 같은 외부 에이전트가 "skill"로 직접 호출하기 위한 용도.
 *
 * 사용법:
 *   OPENAI_API_KEY=sk-... repgen-fill-doc \
 *     --template template/template-basic.docx \
 *     --data ./minutes.docx,./notes.txt \
 *     --output ./filled.docx \
 *     [--provider openai|grok] [--api-key sk-...]
 */
import { readFileSync, writeFileSync } from "node:fs"
import { basename } from "node:path"

import { extractPlaceholders } from "../../../lib/server/extract-placeholders.ts"
import { extractTextFromBuffer, ExtractTextError } from "../../../lib/server/extract-text.ts"
import {
  fillPlaceholders,
  FillPlaceholdersInputError,
  classifyFillError,
  type FillProvider,
} from "../../../lib/server/fill-placeholders.ts"
import { generateDocument } from "../../../lib/server/generate-document.ts"
import { CliProcessingError, CliProviderError, CliUsageError, runCli } from "./lib/cli-support.ts"

type CliArgs = {
  template: string
  data: string[]
  output: string
  provider: FillProvider
  apiKey?: string
  help: boolean
}

function printUsage() {
  console.error(`사용법:
  repgen-fill-doc --template <template.docx> --data <file1,file2,...> --output <out.docx> [--provider openai|grok] [--api-key <key>]

옵션:
  --template   플레이스홀더가 포함된 .docx 템플릿 경로 (필수)
  --data       참고 자료 파일 경로 목록, 콤마로 구분 (.txt/.md/.docx/.pdf) (필수)
  --output     결과 .docx 저장 경로 (필수)
  --provider   openai | grok (기본값: openai)
  --api-key    AI API 키. 생략 시 OPENAI_API_KEY / XAI_API_KEY 환경변수 사용

예시:
  OPENAI_API_KEY=sk-... repgen-fill-doc --template template-basic.docx --data ./minutes.docx --output ./filled.docx`)
}

function parseArgs(argv: string[]): CliArgs {
  if (argv.includes("--help")) {
    return { template: "", data: [], output: "", provider: "openai", help: true }
  }

  const map = new Map<string, string>()

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith("--")) continue
    const key = arg.slice(2)
    const value = argv[i + 1]
    if (value === undefined || value.startsWith("--")) {
      throw new CliUsageError(`--${key} 옵션에 값이 필요합니다.`)
    }
    map.set(key, value)
    i++
  }

  const template = map.get("template")
  const data = map.get("data")
  const output = map.get("output")

  if (!template || !data || !output) {
    printUsage()
    throw new CliUsageError("--template, --data, --output은 필수입니다.")
  }

  const providerRaw = map.get("provider") ?? "openai"
  if (providerRaw !== "openai" && providerRaw !== "grok") {
    throw new CliUsageError(`--provider는 openai 또는 grok만 허용됩니다. (입력값: ${providerRaw})`)
  }

  return {
    template,
    data: data.split(",").map((p) => p.trim()).filter(Boolean),
    output,
    provider: providerRaw,
    apiKey: map.get("api-key"),
    help: false,
  }
}

function resolveApiKey(args: CliArgs): string {
  if (args.apiKey) return args.apiKey

  const envKey = args.provider === "openai" ? process.env.OPENAI_API_KEY : process.env.XAI_API_KEY
  if (envKey) return envKey

  const envName = args.provider === "openai" ? "OPENAI_API_KEY" : "XAI_API_KEY"
  throw new CliProviderError(`API 키가 없습니다. --api-key를 전달하거나 ${envName} 환경변수를 설정해주세요.`)
}

async function buildCombinedDataContent(dataPaths: string[]): Promise<string> {
  const sections: string[] = []

  for (const dataPath of dataPaths) {
    let buffer: Buffer
    try {
      buffer = readFileSync(dataPath)
    } catch (error: any) {
      throw new CliUsageError(`데이터 파일을 읽을 수 없습니다: ${dataPath} (${error.message})`)
    }

    const filename = basename(dataPath)
    try {
      const text = await extractTextFromBuffer(buffer, filename)
      sections.push(`\n<SourceFile name="${filename}">\n${text}\n</SourceFile>\n`)
    } catch (error: any) {
      if (error instanceof ExtractTextError) {
        throw new CliProcessingError(`${filename}: ${error.message}`)
      }
      throw error
    }
  }

  return sections.join("\n---\n")
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    return
  }

  if (!args.template.toLowerCase().endsWith(".docx")) {
    throw new CliUsageError("--template은 .docx 파일이어야 합니다.")
  }

  let templateBuffer: Buffer
  try {
    templateBuffer = readFileSync(args.template)
  } catch (error: any) {
    throw new CliUsageError(`템플릿 파일을 읽을 수 없습니다: ${args.template} (${error.message})`)
  }

  const extracted = extractPlaceholders(templateBuffer)
  if (!extracted.ok) {
    const lines = [`템플릿 문법 검증 실패: ${extracted.error}`, ...extracted.validations.map((v) => `  - ${v}`)]
    throw new CliProcessingError(lines.join("\n"))
  }

  const apiKey = resolveApiKey(args)
  const dataContent = await buildCombinedDataContent(args.data)

  let fillResult
  try {
    fillResult = await fillPlaceholders({
      dataContent,
      placeholders: extracted.placeholders,
      provider: args.provider,
      apiKey,
    })
  } catch (error: any) {
    if (error instanceof FillPlaceholdersInputError) {
      throw new CliProcessingError(error.message)
    }
    const { message, status } = classifyFillError(error, args.provider)
    if (status === 401) throw new CliProviderError(message)
    throw new CliProcessingError(message)
  }

  const record = fillResult.filledPlaceholders.reduce<Record<string, any>>((acc, p) => {
    acc[p.key] = p.value
    return acc
  }, {})

  const outputBuffer = generateDocument(templateBuffer, record)
  writeFileSync(args.output, outputBuffer)

  if (fillResult.unresolvedKeys && fillResult.unresolvedKeys.length > 0) {
    console.error(`경고: 근거 자료에서 값을 찾지 못해 비워둔 필드가 있습니다 (${fillResult.unresolvedKeys.length}개). 사용자에게 확인 후 render-doc으로 다시 채워 넣으세요.`)
    for (const k of fillResult.unresolvedKeys) console.error(`  - ${k}`)
  }

  console.log(
    JSON.stringify(
      {
        output: args.output,
        provider: fillResult.processing.provider,
        usedFileSearch: fillResult.processing.usedFileSearch,
        usedFallback: fillResult.processing.usedFallback,
        fallbackReason: fillResult.processing.fallbackReason,
        evidenceCount: fillResult.evidence?.length ?? 0,
        placeholderCount: fillResult.filledPlaceholders.length,
        unresolvedKeys: fillResult.unresolvedKeys ?? [],
      },
      null,
      2,
    ),
  )
}

runCli(main)
