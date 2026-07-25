#!/usr/bin/env -S node --experimental-strip-types
/**
 * 템플릿 docx에서 placeholder 목록만 뽑아 JSON으로 출력하는 독립 CLI.
 * AI API 키가 필요 없다 — 호출한 에이전트(Hermes 등)가 이 목록을 보고
 * 스스로 값을 채운 뒤 render-doc으로 넘기는 흐름을 위한 1단계.
 *
 * 사용법:
 *   repgen-extract-doc --template template-basic.docx
 */
import { readFileSync } from "node:fs"

import { extractPlaceholders } from "../lib/server/extract-placeholders.ts"

function printUsage() {
  console.error(`사용법:
  repgen-extract-doc --template <template.docx>

옵션:
  --template   플레이스홀더가 포함된 .docx 템플릿 경로 (필수)

출력(stdout): { "placeholders": [{ key, description?, isLoop?, fields? }, ...] }`)
}

function parseArgs(argv: string[]): { template: string } {
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

  const template = map.get("template")
  if (!template) {
    printUsage()
    throw new Error("--template은 필수입니다.")
  }

  return { template }
}

function main() {
  const { template } = parseArgs(process.argv.slice(2))

  if (!template.toLowerCase().endsWith(".docx")) {
    throw new Error("--template은 .docx 파일이어야 합니다.")
  }

  let templateBuffer: Buffer
  try {
    templateBuffer = readFileSync(template)
  } catch (error: any) {
    throw new Error(`템플릿 파일을 읽을 수 없습니다: ${template} (${error.message})`)
  }

  const result = extractPlaceholders(templateBuffer)

  if (!result.ok) {
    console.error(`템플릿 문법 검증 실패: ${result.error}`)
    for (const v of result.validations) console.error(`  - ${v}`)
    process.exit(1)
  }

  console.log(JSON.stringify({ placeholders: result.placeholders }, null, 2))
}

try {
  main()
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`오류: ${message}`)
  process.exit(1)
}
