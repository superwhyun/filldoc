#!/usr/bin/env node
/**
 * 실제 예시 .docx의 원본 서식(폰트/크기/굵게/밑줄/정렬 등)을 그대로 유지한 채,
 * 지정한 문단만 {{placeholder}}로 치환하거나 지정한 범위를 삭제해서 템플릿을 만드는
 * 독립 CLI. AI 키 불필요 — 어떤 문단을 어떻게 바꿀지는 호출자(에이전트)가 직접
 * filldoc-extract-text로 원문을 읽고 판단해서 edits로 넘긴다.
 *
 * 사용법:
 *   filldoc-extract-text --file ./예시.docx        # 1단계: 원문 확인
 *   filldoc-templatize-doc --source ./예시.docx --edits ./edits.json --output ./템플릿.docx
 *
 * edits.json 형태:
 *   [
 *     { "type": "replace", "match": "SC 6/WG 7 N484",
 *       "runs": [{ "text": "{{doc_number:문서 번호, 예: SC 6/WG 7 N484}}" }] },
 *     { "type": "insert-paragraph", "anchorMatch": "Recommendation WG7.1", "position": "before",
 *       "runs": [{ "text": "{{#recommendations}}" }] },
 *     { "type": "delete-range", "fromMatch": "SC 6 N18437", "toMatch": "China National Body" }
 *   ]
 *
 * - "match"/"fromMatch"/"toMatch"/"anchorMatch"는 해당 문단의 텍스트에 포함되는 부분
 *   문자열이면 된다 (문서 순서상 처음 매칭되는 문단을 사용).
 * - "replace"는 매칭된 문단의 내용을 통째로 교체한다. 문단/문자 서식은 유지된다.
 * - "delete-range"는 fromMatch가 있는 문단부터 toMatch가 있는 문단까지 삭제한다.
 * - "insert-paragraph"는 앵커 문단 앞/뒤에 새 문단을 끼워 넣는다. 여러 문단에 걸친
 *   루프의 {{#loopName}}/{{/loopName}}은 반드시 이 타입의 독립 문단으로 넣는다.
 */
import { readFileSync, writeFileSync } from "node:fs"

import { templatizeDocument, TemplatizeError, type TemplatizeEdit } from "../../../lib/server/templatize-document.ts"
import { extractPlaceholders } from "../../../lib/server/extract-placeholders.ts"
import { CliProcessingError, CliUsageError, runCli } from "./lib/cli-support.ts"

type CliArgs = {
  source: string
  edits?: string
  editsJson?: string
  output: string
  help: boolean
}

function printUsage() {
  console.error(`사용법:
  filldoc-templatize-doc --source <원본.docx> (--edits <edits.json> | --edits-json '<json>') --output <템플릿.docx>

옵션:
  --source     원본 예시 문서 경로 (.docx) (필수)
  --edits      edits 배열이 담긴 JSON 파일 경로 (--edits-json과 둘 중 하나 필수)
  --edits-json edits 배열 JSON 문자열 (--edits와 둘 중 하나 필수)
  --output     생성될 템플릿 .docx 저장 경로 (필수)

edits 항목 타입:
  { "type": "replace", "match": "<문단에 포함된 원문>", "runs": [{"text":"..."} | {"tab":true}, ...] }
  { "type": "delete-range", "fromMatch": "<시작 문단 원문>", "toMatch": "<끝 문단 원문>" }
  { "type": "insert-paragraph", "anchorMatch": "<기준 문단 원문>", "position": "before"|"after", "runs": [...] }`)
}

function parseArgs(argv: string[]): CliArgs {
  if (argv.includes("--help")) {
    return { source: "", output: "", help: true }
  }

  const map = new Map<string, string>()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith("--")) continue
    const key = arg.slice(2)
    const value = argv[i + 1]
    if (value === undefined || (key !== "edits-json" && value.startsWith("--"))) {
      throw new CliUsageError(`--${key} 옵션에 값이 필요합니다.`)
    }
    map.set(key, value)
    i++
  }

  const source = map.get("source")
  const edits = map.get("edits")
  const editsJson = map.get("edits-json")
  const output = map.get("output")

  if (!source || !output || (!edits && !editsJson)) {
    printUsage()
    throw new CliUsageError("--source, --output, (--edits 또는 --edits-json)은 필수입니다.")
  }

  return { source, edits, editsJson, output, help: false }
}

function loadEdits(args: CliArgs): TemplatizeEdit[] {
  let raw: string
  try {
    raw = args.editsJson ?? readFileSync(args.edits!, "utf-8")
  } catch (error: any) {
    throw new CliUsageError(`--edits 파일을 읽을 수 없습니다: ${args.edits} (${error.message})`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error: any) {
    throw new CliUsageError(`--edits${args.editsJson ? "-json" : ""} 파싱 실패: 올바른 JSON이 아닙니다. (${error.message})`)
  }

  if (!Array.isArray(parsed)) {
    throw new CliUsageError("edits는 JSON 배열이어야 합니다.")
  }

  return parsed as TemplatizeEdit[]
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    return
  }

  if (!args.source.toLowerCase().endsWith(".docx")) {
    throw new CliUsageError("--source는 .docx 파일이어야 합니다.")
  }

  let sourceBuffer: Buffer
  try {
    sourceBuffer = readFileSync(args.source)
  } catch (error: any) {
    throw new CliUsageError(`원본 파일을 읽을 수 없습니다: ${args.source} (${error.message})`)
  }

  const edits = loadEdits(args)

  let outputBuffer: Buffer
  try {
    outputBuffer = templatizeDocument(sourceBuffer, edits)
  } catch (error: any) {
    if (error instanceof TemplatizeError) {
      throw new CliProcessingError(error.message)
    }
    throw error
  }

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
    console.error(`경고: 생성된 템플릿이 문법 검증을 통과하지 못했습니다. filldoc-extract-doc으로 다시 확인하세요.`)
    for (const v of validation.validations) console.error(`  - ${v}`)
  }
}

runCli(main)
