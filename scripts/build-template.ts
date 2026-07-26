#!/usr/bin/env -S node --experimental-strip-types
/**
 * 호출자(에이전트)가 이미 결정한 템플릿 스펙(JSON)을 그대로 docx로 조립하는 독립 CLI.
 * AI 키 불필요 — 값 판단/분석은 이미 LLM인 호출 에이전트가 직접 하고,
 * RepGen은 순수하게 "스펙대로 문서 조립"만 한다.
 *
 * 사용법 (repgen-extract-text로 예시 문서 텍스트를 먼저 읽고, 에이전트가 직접 스펙을 만든 뒤):
 *   repgen-build-template --spec ./spec.json --output ./새템플릿.docx
 *
 * spec.json 형태 (TemplateGenerationJson):
 *   {
 *     "title": "...", "subtitle": "...",
 *     "blocks": [
 *       { "type": "heading", "level": 2, "text": "..." },
 *       { "type": "paragraph", "text": "{{intro:...}}" },
 *       { "type": "repeating_section", "loopName": "recommendations", "blocks": [
 *           { "type": "heading", "level": 2, "text": "Recommendation {{no}}" },
 *           { "type": "paragraph", "text": "{{title}}" },
 *           { "type": "paragraph", "text": "{{body}}" }
 *       ]},
 *       { "type": "table", "header": ["번호","이름"], "rows": [["{{tasks.no}}","{{tasks.name}}"]] }
 *     ]
 *   }
 */
import { readFileSync, writeFileSync } from "node:fs"

import { buildTemplateFromSpec, type TemplateGenerationJson } from "../lib/client-template-generator.ts"
import { extractPlaceholders } from "../lib/server/extract-placeholders.ts"

type CliArgs = {
  spec?: string
  specJson?: string
  output: string
  templateName?: string
}

function printUsage() {
  console.error(`사용법:
  repgen-build-template (--spec <spec.json> | --spec-json '<json string>') --output <새템플릿.docx> [--template-name <이름>]

옵션:
  --spec           TemplateGenerationJson 형태의 JSON 파일 경로 (--spec-json과 둘 중 하나 필수)
  --spec-json      TemplateGenerationJson 형태의 JSON 문자열 (--spec와 둘 중 하나 필수)
  --output         생성될 템플릿 .docx 저장 경로 (필수)
  --template-name  선호 파일명(선택)

blocks 타입: heading | paragraph | bullet_list | table | spacer | repeating_section
repeating_section: { loopName, blocks: [{type: heading|paragraph, level?, text}] } — 반복 구간을 1회분만 작성.`)
}

function parseArgs(argv: string[]): CliArgs {
  const map = new Map<string, string>()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith("--")) continue
    const key = arg.slice(2)
    const value = argv[i + 1]
    if (value === undefined || (key !== "spec-json" && value.startsWith("--"))) {
      throw new Error(`--${key} 옵션에 값이 필요합니다.`)
    }
    map.set(key, value)
    i++
  }

  const spec = map.get("spec")
  const specJson = map.get("spec-json")
  const output = map.get("output")

  if (!output || (!spec && !specJson)) {
    printUsage()
    throw new Error("--output, (--spec 또는 --spec-json)은 필수입니다.")
  }

  return { spec, specJson, output, templateName: map.get("template-name") }
}

function loadSpec(args: CliArgs): TemplateGenerationJson {
  const raw = args.specJson ?? readFileSync(args.spec!, "utf-8")

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error: any) {
    throw new Error(`--spec${args.specJson ? "-json" : ""} 파싱 실패: 올바른 JSON이 아닙니다. (${error.message})`)
  }

  if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as any).blocks)) {
    throw new Error("스펙은 { blocks: [...] } 형태의 JSON 객체여야 합니다.")
  }

  return parsed as TemplateGenerationJson
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const spec = loadSpec(args)

  const { file } = await buildTemplateFromSpec(spec, args.templateName)
  const outputBuffer = Buffer.from(await file.arrayBuffer())
  writeFileSync(args.output, outputBuffer)

  const validation = extractPlaceholders(outputBuffer)

  console.log(
    JSON.stringify(
      {
        output: args.output,
        placeholderCount: validation.ok ? validation.placeholders.length : null,
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
