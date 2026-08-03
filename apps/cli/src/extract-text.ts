#!/usr/bin/env node
/**
 * 임의의 파일(.docx/.pdf/.txt/.md)에서 순수 텍스트만 뽑아 stdout에 출력하는 독립 CLI.
 * AI 키 불필요 — Hermes 같은 에이전트가 .docx 원문을 직접 읽을 수 없기 때문에,
 * 텍스트만 뽑아서 에이전트 자신이 읽고 판단하도록 넘겨주는 용도.
 *
 * 사용법:
 *   filldoc-extract-text --file ./예시-회의록.docx
 */
import { readFileSync } from "node:fs"
import { basename } from "node:path"

import { extractTextFromBuffer, ExtractTextError } from "../../../lib/server/extract-text.ts"
import { CliProcessingError, CliUsageError, runCli } from "./lib/cli-support.ts"

function printUsage() {
  console.error(`사용법:
  filldoc-extract-text --file <path>

옵션:
  --file   텍스트를 추출할 파일 경로 (.docx/.pdf/.txt/.md) (필수)

출력(stdout): 추출된 순수 텍스트 그대로`)
}

function parseArgs(argv: string[]): { file: string; help: boolean } {
  if (argv.includes("--help")) return { file: "", help: true }

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

  const file = map.get("file")
  if (!file) {
    printUsage()
    throw new CliUsageError("--file은 필수입니다.")
  }

  return { file, help: false }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    return
  }

  let buffer: Buffer
  try {
    buffer = readFileSync(args.file)
  } catch (error: any) {
    throw new CliUsageError(`파일을 읽을 수 없습니다: ${args.file} (${error.message})`)
  }

  try {
    const text = await extractTextFromBuffer(buffer, basename(args.file))
    console.log(text)
  } catch (error: any) {
    if (error instanceof ExtractTextError) {
      throw new CliProcessingError(error.message)
    }
    throw error
  }
}

runCli(main)
