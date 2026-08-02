import { describe, expect, it } from "vitest"

import { ExtractTextError, extractDocumentText, inspectTemplate } from "../../packages/core/src/index.ts"
import { createDocx } from "./fixtures.ts"

describe("inspectTemplate", () => {
  it("preserves standalone descriptions and de-duplicates dot-notation loop fields", async () => {
    const template = await createDocx([
      "{{title: Report title}}",
      "{{tasks.name: Task name}}",
      "{{tasks.name}}",
    ])

    expect(inspectTemplate(template)).toEqual({
      ok: true,
      placeholders: [
        { key: "title", description: "Report title" },
        { key: "tasks", isLoop: true, fields: ["name"] },
      ],
      warnings: undefined,
    })
  })

  it("surfaces unmatched loop tags from the DOCX parser", async () => {
    const template = await createDocx(["{{#items}}", "{{name}}"])

    expect(() => inspectTemplate(template)).toThrow("Multi error")
  })

  it("surfaces malformed DOCX input to callers", () => {
    expect(() => inspectTemplate(Buffer.from("not a docx", "utf8"))).toThrow()
  })
})

describe("extractDocumentText", () => {
  it.each([
    ["notes.txt", "plain-text notes"],
    ["notes.MD", "# Markdown notes"],
  ])("extracts UTF-8 text from %s", async (filename, text) => {
    await expect(extractDocumentText(Buffer.from(text, "utf8"), filename)).resolves.toBe(text)
  })

  it("extracts text from a valid DOCX", async () => {
    const source = await createDocx(["First paragraph", "Second paragraph"])

    await expect(extractDocumentText(source, "source.docx"))
      .resolves.toContain("First paragraph")
  })

  it.each([
    [new Uint8Array(), "empty.txt", "파일이 비어있습니다"],
    [Buffer.from("   ", "utf8"), "blank.md", "파일 내용이 비어있습니다"],
    [Buffer.from("legacy", "utf8"), "legacy.doc", ".doc 형식은 지원하지 않습니다"],
    [Buffer.from("data", "utf8"), "data.csv", "지원하지 않는 파일 형식입니다"],
    [Buffer.from("not a zip", "utf8"), "broken.docx", "Word 파일이 손상되었거나 올바른 형식이 아닙니다"],
  ])("rejects %s sources", async (content, filename, message) => {
    await expect(extractDocumentText(content, filename))
      .rejects.toBeInstanceOf(ExtractTextError)
    await expect(extractDocumentText(content, filename)).rejects.toThrow(message)
  })
})
