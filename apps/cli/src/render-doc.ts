#!/usr/bin/env node
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
 * --data/--data-json을 생략하고 stdin으로 파이프해도 된다:
 *   cat values.json | repgen-render-doc --template template-basic.docx --output ./filled.docx
 *
 * values.json 예시 (일반 필드는 문자열, loop 필드는 객체 배열):
 *   {
 *     "title": "회의록",
 *     "tasks": [{ "no": "1", "name": "설계", "owner": "홍길동", "due": "2026-08-01" }]
 *   }
 */
import { readFileSync, writeFileSync } from "node:fs"

import { extractPlaceholders } from "../../../lib/server/extract-placeholders.ts"
import { generateDocument } from "../../../lib/server/generate-document.ts"
import { validateRenderData } from "../../../packages/core/src/index.ts"
import { CliProcessingError, CliUsageError, runCli } from "./lib/cli-support.ts"

type CliArgs = {
  template: string
  data?: string
  dataJson?: string
  output: string
  allowPartial: boolean
  help: boolean
}

function printUsage() {
  console.error(`사용법:
  repgen-render-doc --template <template.docx> (--data <values.json> | --data-json '<json string>') --output <out.docx> [--allow-partial]

옵션:
  --template       플레이스홀더가 포함된 .docx 템플릿 경로 (필수)
  --data           { key: value } 형태의 JSON 파일 경로 (--data-json, stdin 파이프 중 하나)
  --data-json      { key: value } 형태의 JSON 문자열 (--data, stdin 파이프 중 하나)
  --output         결과 .docx 저장 경로 (필수)
  --allow-partial  템플릿에 있는데 데이터에 없는 key가 있어도 중단하지 않고 빈 값으로 렌더링

--data/--data-json을 둘 다 생략하면 stdin에서 JSON을 읽는다(파이프된 입력이 있을 때만).

값 형식: 일반 placeholder는 문자열, loop(#placeholder / key.field) placeholder는 { field: value } 객체 배열.
extract-doc으로 placeholder 목록(key/description/isLoop/fields)을 먼저 확인하면 편하다.

기본 동작: 템플릿이 요구하는 key인데 데이터에 없으면 렌더링하지 않고 에러로 중단한다(어떤 key가 빠졌는지 stderr에 나열).
이 값들을 사용자에게 물어본 뒤 다시 채워서 재실행하라는 신호다. 정말로 비워둬도 괜찮다면 --allow-partial을 쓴다.`)
}

function parseArgs(argv: string[]): CliArgs {
  if (argv.includes("--help")) {
    return { template: "", output: "", allowPartial: false, help: true }
  }

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
      throw new CliUsageError(`--${key} 옵션에 값이 필요합니다.`)
    }
    map.set(key, value)
    i++
  }

  const template = map.get("template")
  const data = map.get("data")
  const dataJson = map.get("data-json")
  const output = map.get("output")

  if (!template || !output) {
    printUsage()
    throw new CliUsageError("--template, --output은 필수입니다.")
  }

  if (!data && !dataJson && process.stdin.isTTY) {
    printUsage()
    throw new CliUsageError("--data, --data-json 중 하나를 쓰거나 stdin으로 JSON을 파이프해야 합니다.")
  }

  return { template, data, dataJson, output, allowPartial, help: false }
}

function loadData(args: CliArgs): Record<string, any> {
  let raw: string
  try {
    raw = args.dataJson ?? (args.data ? readFileSync(args.data, "utf-8") : readFileSync(0, "utf-8"))
  } catch (error: any) {
    const source = args.data ? `--data 파일(${args.data})` : "stdin"
    throw new CliUsageError(`${source}을 읽을 수 없습니다. (${error.message})`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error: any) {
    throw new CliUsageError(`--data${args.dataJson ? "-json" : ""} 파싱 실패: 올바른 JSON이 아닙니다. (${error.message})`)
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new CliUsageError("데이터는 { key: value } 형태의 JSON 객체여야 합니다.")
  }

  return parsed as Record<string, any>
}

function main() {
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

  const data = loadData(args)

  const extracted = extractPlaceholders(templateBuffer)
  if (extracted.ok) {
    const { missing, warnings } = validateRenderData({ inspection: extracted, data, allowPartial: args.allowPartial })

    if (missing.length > 0 && !args.allowPartial) {
      const lines = [
        `렌더링 중단: 템플릿에 필요한 값이 데이터에 없습니다 (${missing.length}개).`,
        ...missing.map((p) => `  - ${p.key}${p.description ? ` : ${p.description}` : ""}`),
        `사용자에게 이 값들을 물어본 뒤 다시 채워서 재실행하세요. 정말로 비워둬도 되면 --allow-partial 옵션을 추가하세요.`,
      ]
      throw new CliProcessingError(lines.join("\n"))
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

runCli(main)
