#!/usr/bin/env node
/**
 * 7개 repgen-* 명령의 unified alias. 기존 개별 명령(repgen-extract-doc 등)은
 * 그대로 유지되며, 이 명령은 `repgen <subcommand> [...args]` 형태로 같은
 * 구현을 호출하는 추가 진입점이다.
 *
 * 사용법:
 *   repgen --version
 *   repgen <extract-doc|extract-text|render-doc|templatize-doc|build-template|fill-doc|analyze-doc> [...args]
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const COMMANDS = [
  "extract-doc",
  "extract-text",
  "render-doc",
  "templatize-doc",
  "build-template",
  "fill-doc",
  "analyze-doc",
] as const

function printUsage() {
  console.error(`사용법:
  repgen --version
  repgen <${COMMANDS.join("|")}> [...args]

각 subcommand는 repgen-<subcommand>와 동일하게 동작한다. 옵션은 repgen-<subcommand> --help로 확인한다.`)
}

async function main() {
  const [sub, ...rest] = process.argv.slice(2)

  if (!sub || sub === "--help") {
    printUsage()
    return
  }

  if (sub === "--version") {
    const here = dirname(fileURLToPath(import.meta.url))
    const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf-8"))
    console.log(pkg.version)
    return
  }

  if (!(COMMANDS as readonly string[]).includes(sub)) {
    printUsage()
    console.error(`오류: 알 수 없는 명령입니다: ${sub}`)
    process.exit(2)
  }

  // 대상 명령 모듈은 로드되는 즉시 process.argv.slice(2)를 읽고 스스로 실행/종료한다.
  // 번들러(esbuild)가 정적으로 인식할 수 있도록 동적 import 경로를 문자열 리터럴로 분기한다.
  process.argv = [process.argv[0], process.argv[1], ...rest]
  switch (sub) {
    case "extract-doc": await import("./extract-doc.ts"); break
    case "extract-text": await import("./extract-text.ts"); break
    case "render-doc": await import("./render-doc.ts"); break
    case "templatize-doc": await import("./templatize-doc.ts"); break
    case "build-template": await import("./build-template.ts"); break
    case "fill-doc": await import("./fill-doc.ts"); break
    case "analyze-doc": await import("./analyze-doc.ts"); break
  }
}

main()
