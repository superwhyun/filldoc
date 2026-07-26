#!/usr/bin/env -S node --experimental-strip-types
/**
 * 임의의 파일(.docx/.pdf/.txt/.md)에서 순수 텍스트만 뽑아 stdout에 출력하는 독립 CLI.
 * AI 키 불필요 — Hermes 같은 에이전트가 .docx 원문을 직접 읽을 수 없기 때문에,
 * 텍스트만 뽑아서 에이전트 자신이 읽고 판단하도록 넘겨주는 용도.
 * (예: repgen-build-template과 짝을 이뤄 "예시 문서 → 템플릿" 흐름을 AI 키 없이 완성)
 *
 * 사용법:
 *   repgen-extract-text --file ./예시-회의록.docx
 */
import { readFileSync } from "node:fs"
import { basename } from "node:path"

import { extractTextFromBuffer, ExtractTextError } from "../lib/server/extract-text.ts"

function printUsage() {
  console.error(`사용법:
  repgen-extract-text --file <path>

옵션:
  --file   텍스트를 추출할 파일 경로 (.docx/.pdf/.txt/.md) (필수)

출력(stdout): 추출된 순수 텍스트 그대로`)
}

function parseArgs(argv: string[]): { file: string } {
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

  const file = map.get("file")
  if (!file) {
    printUsage()
    throw new Error("--file은 필수입니다.")
  }

  return { file }
}

async function main() {
  const { file } = parseArgs(process.argv.slice(2))

  let buffer: Buffer
  try {
    buffer = readFileSync(file)
  } catch (error: any) {
    throw new Error(`파일을 읽을 수 없습니다: ${file} (${error.message})`)
  }

  try {
    const text = await extractTextFromBuffer(buffer, basename(file))
    console.log(text)
  } catch (error: any) {
    if (error instanceof ExtractTextError) {
      throw new Error(error.message)
    }
    throw error
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`오류: ${message}`)
  process.exit(1)
})
