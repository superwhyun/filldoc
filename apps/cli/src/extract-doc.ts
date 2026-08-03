#!/usr/bin/env node
/**
 * 템플릿 docx에서 placeholder 목록만 뽑아 JSON으로 출력하는 독립 CLI.
 * AI API 키가 필요 없다 — 호출한 에이전트(Hermes 등)가 이 목록을 보고
 * 스스로 값을 채운 뒤 render-doc으로 넘기는 흐름을 위한 1단계.
 *
 * 사용법:
 *   filldoc-extract-doc --template template-basic.docx
 */
import { readFileSync } from "node:fs"

import { extractPlaceholders } from "../../../lib/server/extract-placeholders.ts"
import { CliProcessingError, CliUsageError, runCli } from "./lib/cli-support.ts"

function printUsage() {
  console.error(`사용법:
  filldoc-extract-doc --template <template.docx>

옵션:
  --template   플레이스홀더가 포함된 .docx 템플릿 경로 (필수)

출력(stdout): { "placeholders": [{ key, description?, isLoop?, fields? }, ...] }`)
}

function parseArgs(argv: string[]): { template: string; help: boolean } {
  if (argv.includes("--help")) return { template: "", help: true }

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
  if (!template) {
    printUsage()
    throw new CliUsageError("--template은 필수입니다.")
  }

  return { template, help: false }
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

  const result = extractPlaceholders(templateBuffer)

  if (!result.ok) {
    const lines = [`템플릿 문법 검증 실패: ${result.error}`, ...result.validations.map((v) => `  - ${v}`)]
    throw new CliProcessingError(lines.join("\n"))
  }

  console.log(JSON.stringify({ placeholders: result.placeholders }, null, 2))
}

runCli(main)
