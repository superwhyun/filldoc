import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { extractDocumentText } from "../../packages/core/src/index.ts"
import { createDocx } from "../document-core/fixtures.ts"

/**
 * apps/cli/dist(esbuild로 번들된 packed CLI 산출물)를 저장소 밖 임시
 * work directory에서 직접 spawn해 검증한다. dist/*.js는 monorepo-internal
 * 소스를 전부 인라인 번들링했으므로 repository-relative import가 없다
 * (packages/core/src/*, lib/server/* 등은 dist 안에 이미 포함됨).
 */

const repoRoot = fileURLToPath(new URL("../../", import.meta.url))
const distDir = join(repoRoot, "apps/cli/dist")

function dist(name: string) {
  return join(distDir, `${name}.js`)
}

let workDir: string

beforeAll(() => {
  const build = spawnSync(process.execPath, [join(repoRoot, "apps/cli/build.mjs")], {
    cwd: join(repoRoot, "apps/cli"),
    encoding: "utf-8",
  })
  if (build.status !== 0) {
    throw new Error(`apps/cli build 실패:\n${build.stdout}\n${build.stderr}`)
  }
}, 30_000)

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "repgen-cli-e2e-"))
})

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

function run(name: string, args: string[], input?: string) {
  return spawnSync(process.execPath, [dist(name), ...args], {
    cwd: workDir,
    encoding: "utf-8",
    input,
  })
}

describe("CLI E2E — packed dist, repository 밖 work directory", () => {
  it("extract-doc → agent 판단 → render-doc: AI 키 없이 템플릿을 채운다", async () => {
    const built = run("build-template", [
      "--spec-json",
      JSON.stringify({
        title: "Report",
        blocks: [
          { type: "paragraph", text: "{{title}}" },
          { type: "repeating_section", loopName: "tasks", blocks: [{ type: "paragraph", text: "{{name}}" }] },
        ],
      }),
      "--output",
      "./template.docx",
    ])
    expect(built.status).toBe(0)
    expect(built.stderr).toBe("")
    expect(JSON.parse(built.stdout)).toMatchObject({ templateValid: true })

    const extracted = run("extract-doc", ["--template", "./template.docx"])
    expect(extracted.status).toBe(0)
    expect(extracted.stderr).toBe("")
    const { placeholders } = JSON.parse(extracted.stdout)
    expect(placeholders).toEqual([
      { key: "title" },
      { key: "tasks", isLoop: true, fields: ["name"] },
    ])

    // agent가 extract-doc 결과를 보고 스스로 값을 판단(fixture이므로 하드코딩)
    const rendered = run("render-doc", [
      "--template",
      "./template.docx",
      "--data-json",
      JSON.stringify({ title: "Weekly Report", tasks: [{ name: "Design" }, { name: "Review" }] }),
      "--output",
      "./filled.docx",
    ])
    expect(rendered.status).toBe(0)
    expect(rendered.stderr).toBe("")
    expect(JSON.parse(rendered.stdout)).toEqual({ output: "./filled.docx", filledKeys: 2 })

    const filledBytes = readFileSync(join(workDir, "filled.docx"))
    expect(filledBytes.length).toBeGreaterThan(0)

    // 값과 loop 반복 횟수가 실제로 렌더링됐는지 core로 다시 읽어 확인한다.
    const filledText = await extractDocumentText(filledBytes, "filled.docx")
    expect(filledText).toContain("Weekly Report")
    expect(filledText).toContain("Design")
    expect(filledText).toContain("Review")
  })

  it("extract-text: 순수 텍스트를 stdout에 그대로 출력한다 (JSON 아님)", () => {
    writeFileSync(join(workDir, "notes.txt"), "회의록 초안입니다.", "utf-8")

    const result = run("extract-text", ["--file", "./notes.txt"])
    expect(result.status).toBe(0)
    expect(result.stdout).toBe("회의록 초안입니다.\n")
    expect(result.stderr).toBe("")
  })

  it("templatize-doc → extract-doc → render-doc: 원본 서식을 유지한 채 템플릿화한다", async () => {
    const source = await createDocx(["Hello World", "Replace this line"])
    writeFileSync(join(workDir, "source.docx"), source)

    const templatized = run("templatize-doc", [
      "--source",
      "./source.docx",
      "--edits-json",
      JSON.stringify([{ type: "replace", match: "Replace this line", runs: [{ text: "{{greeting}}" }] }]),
      "--output",
      "./template-from-source.docx",
    ])
    expect(templatized.status).toBe(0)
    expect(JSON.parse(templatized.stdout)).toMatchObject({ placeholderCount: 1, templateValid: true })

    const extracted = run("extract-doc", ["--template", "./template-from-source.docx"])
    expect(JSON.parse(extracted.stdout)).toEqual({ placeholders: [{ key: "greeting" }] })

    const rendered = run("render-doc", [
      "--template",
      "./template-from-source.docx",
      "--data-json",
      JSON.stringify({ greeting: "Hi there" }),
      "--output",
      "./final.docx",
    ])
    expect(rendered.status).toBe(0)
    expect(JSON.parse(rendered.stdout)).toEqual({ output: "./final.docx", filledKeys: 1 })

    const finalBytes = readFileSync(join(workDir, "final.docx"))
    const finalText = await extractDocumentText(finalBytes, "final.docx")
    expect(finalText).toContain("Hello World")
    expect(finalText).toContain("Hi there")
  })

  it("stdout/stderr 계약: 성공은 stdout JSON만, 실패는 stderr 메시지 + 계약된 exit code", () => {
    const missingArg = run("extract-doc", [])
    expect(missingArg.status).toBe(2)
    expect(missingArg.stdout).not.toMatch(/\{/)
    expect(missingArg.stderr).toContain("--template은 필수입니다.")

    const missingFile = run("extract-doc", ["--template", "./does-not-exist.docx"])
    expect(missingFile.status).toBe(2)

    const badJson = run("build-template", ["--spec-json", "{not valid json", "--output", "./x.docx"])
    expect(badJson.status).toBe(2)
  })

  it("repgen unified alias는 개별 repgen-* 명령과 동일한 stdout을 낸다", () => {
    run("build-template", [
      "--spec-json",
      JSON.stringify({ blocks: [{ type: "paragraph", text: "{{x}}" }] }),
      "--output",
      "./t.docx",
    ])

    const direct = run("extract-doc", ["--template", "./t.docx"])
    const viaAlias = run("repgen", ["extract-doc", "--template", "./t.docx"])

    expect(viaAlias.status).toBe(direct.status)
    expect(viaAlias.stdout).toBe(direct.stdout)
  })

  it("repgen --version은 패키지 버전을 출력한다", () => {
    const result = run("repgen", ["--version"])
    expect(result.status).toBe(0)
    const pkg = JSON.parse(readFileSync(join(repoRoot, "apps/cli/package.json"), "utf-8"))
    expect(result.stdout.trim()).toBe(pkg.version)
  })

  it("repgen unified alias의 자체 오류(알 수 없는 명령)도 계약된 exit code와 stderr 형식을 따른다", () => {
    const result = run("repgen", ["bogus-command"])
    expect(result.status).toBe(2)
    expect(result.stdout).toBe("")
    expect(result.stderr).toContain("오류: 알 수 없는 명령입니다: bogus-command")
    // repgen.ts의 main()이 runCli()로 감싸이지 않으면 raw stack trace가 나온다 — 회귀 방지.
    expect(result.stderr).not.toContain("at ")
  })

  it("repgen을 통해 dispatch된 하위 명령의 비동기 실패도 exit code가 그대로 전파된다", () => {
    // repgen.ts는 대상 명령의 runCli(main) 완료를 기다리지 않고 동적 import만 한다.
    // 이 동작이 이벤트 루프 자연 종료에 의존하므로(cli-support.ts의 runCli 주석 참고),
    // 실제 비동기 작업(파일 읽기 → extractPlaceholders) 이후에 던져지는 실패까지
    // 잘리지 않고 중첩 dispatch로 전파되는지 검증한다.
    const built = run("build-template", [
      "--spec-json",
      JSON.stringify({ blocks: [{ type: "paragraph", text: "{{x}}" }] }),
      "--output",
      "./tpl.docx",
    ])
    expect(built.status).toBe(0)

    const result = run("repgen", ["fill-doc", "--template", "./tpl.docx", "--data", "./tpl.docx", "--output", "./out.docx"])
    expect(result.status).toBe(4)
    expect(result.stdout).toBe("")
    expect(result.stderr).toContain("API 키가 없습니다")
  })

  it("fill-doc/analyze-doc: API 키 없이 provider 오류 exit code(4)를 반환한다 (네트워크 호출 없음)", () => {
    writeFileSync(join(workDir, "t.docx"), Buffer.from("placeholder"))

    const built = run("build-template", [
      "--spec-json",
      JSON.stringify({ blocks: [{ type: "paragraph", text: "{{x}}" }] }),
      "--output",
      "./tpl.docx",
    ])
    expect(built.status).toBe(0)

    const fillDoc = run("fill-doc", ["--template", "./tpl.docx", "--data", "./tpl.docx", "--output", "./out.docx"])
    expect(fillDoc.status).toBe(4)
    expect(fillDoc.stderr).toContain("API 키가 없습니다")

    const analyzeDoc = run("analyze-doc", ["--source", "./tpl.docx", "--output", "./out2.docx"])
    expect(analyzeDoc.status).toBe(4)
    expect(analyzeDoc.stderr).toContain("API 키가 없습니다")
  })

  it("fill-doc/analyze-doc: 인자 누락은 exit code 2를 반환한다", () => {
    expect(run("fill-doc", []).status).toBe(2)
    expect(run("analyze-doc", []).status).toBe(2)
  })
})
