#!/usr/bin/env -S node --experimental-strip-types
/**
 * 이미 결정된 { key: value } 데이터로 템플릿을 즉시 렌더링하는 독립 CLI.
 * AI API 키가 필요 없다 — 값 채우기는 호출한 에이전트(Hermes 등)가
 * 이미 끝냈다고 가정하고, RepGen은 순수하게 "템플릿에 값 끼워넣기"만 한다.
 *
 * 사용법 (extract-doc으로 뽑은 placeholder 목록을 보고 값을 채운 뒤):
 *   repgen-render-doc \
 *     --template template/template-basic.docx \
 *     --data ./values.json \
 *     --output ./filled.docx
 *
 * values.json 예시 (일반 필드는 문자열, loop 필드는 객체 배열):
 *   {
 *     "title": "회의록",
 *     "tasks": [{ "no": "1", "name": "설계", "owner": "홍길동", "due": "2026-08-01" }]
 *   }
 */
import { readFileSync, writeFileSync } from "node:fs"

import { extractPlaceholders } from "../lib/server/extract-placeholders.ts"
import { generateDocument } from "../lib/server/generate-document.ts"
import { validateRenderData } from "../packages/core/src/index.ts"

type CliArgs = {
  template: string
  data?: string
  dataJson?: string
  output: string
  allowPartial: boolean
}

function printUsage() {
  console.error(`사용법:
  repgen-render-doc --template <template.docx> (--data <values.json> | --data-json '<json string>') --output <out.docx> [--allow-partial]

옵션:
  --template       플레이스홀더가 포함된 .docx 템플릿 경로 (필수)
  --data           { key: value } 형태의 JSON 파일 경로 (--data-json과 둘 중 하나 필수)
  --data-json      { key: value } 형태의 JSON 문자열 (--data와 둘 중 하나 필수)
  --output         결과 .docx 저장 경로 (필수)
  --allow-partial  템플릿에 있는데 데이터에 없는 key가 있어도 중단하지 않고 빈 값으로 렌더링

값 형식: 일반 placeholder는 문자열, loop(#placeholder / key.field) placeholder는 { field: value } 객체 배열.
extract-doc으로 placeholder 목록(key/description/isLoop/fields)을 먼저 확인하면 편하다.

기본 동작: 템플릿이 요구하는 key인데 데이터에 없으면 렌더링하지 않고 에러로 중단한다(어떤 key가 빠졌는지 stderr에 나열).
이 값들을 사용자에게 물어본 뒤 다시 채워서 재실행하라는 신호다. 정말로 비워둬도 괜찮다면 --allow-partial을 쓴다.`)
}

function parseArgs(argv: string[]): CliArgs {
  const map = new Map<string, string>()
  let allowPartial = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith("--")) continue
    const key = arg.slice(2)

    if (key === "allow-partial") {
      allowPartial = true
      continue
    }

    const value = argv[i + 1]
    if (value === undefined || (key !== "data-json" && value.startsWith("--"))) {
      throw new Error(`--${key} 옵션에 값이 필요합니다.`)
    }
    map.set(key, value)
    i++
  }

  const template = map.get("template")
  const data = map.get("data")
  const dataJson = map.get("data-json")
  const output = map.get("output")

  if (!template || !output || (!data && !dataJson)) {
    printUsage()
    throw new Error("--template, --output, (--data 또는 --data-json)은 필수입니다.")
  }

  return { template, data, dataJson, output, allowPartial }
}

function loadData(args: CliArgs): Record<string, any> {
  const raw = args.dataJson ?? readFileSync(args.data!, "utf-8")

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error: any) {
    throw new Error(`--data${args.dataJson ? "-json" : ""} 파싱 실패: 올바른 JSON이 아닙니다. (${error.message})`)
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("데이터는 { key: value } 형태의 JSON 객체여야 합니다.")
  }

  return parsed as Record<string, any>
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.template.toLowerCase().endsWith(".docx")) {
    throw new Error("--template은 .docx 파일이어야 합니다.")
  }

  let templateBuffer: Buffer
  try {
    templateBuffer = readFileSync(args.template)
  } catch (error: any) {
    throw new Error(`템플릿 파일을 읽을 수 없습니다: ${args.template} (${error.message})`)
  }

  const data = loadData(args)

  const extracted = extractPlaceholders(templateBuffer)
  if (extracted.ok) {
    const { missing, warnings } = validateRenderData({ inspection: extracted, data, allowPartial: args.allowPartial })

    if (missing.length > 0 && !args.allowPartial) {
      console.error(`렌더링 중단: 템플릿에 필요한 값이 데이터에 없습니다 (${missing.length}개).`)
      for (const p of missing) {
        console.error(`  - ${p.key}${p.description ? ` : ${p.description}` : ""}`)
      }
      console.error(`사용자에게 이 값들을 물어본 뒤 다시 채워서 재실행하세요. 정말로 비워둬도 되면 --allow-partial 옵션을 추가하세요.`)
      process.exit(1)
    }

    for (const warning of warnings) {
      console.error(`경고: ${warning}`)
    }
  }

  const outputBuffer = generateDocument(templateBuffer, data)
  writeFileSync(args.output, outputBuffer)

  console.log(
    JSON.stringify(
      {
        output: args.output,
        filledKeys: Object.keys(data).length,
      },
      null,
      2,
    ),
  )
}

try {
  main()
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`오류: ${message}`)
  process.exit(1)
}
