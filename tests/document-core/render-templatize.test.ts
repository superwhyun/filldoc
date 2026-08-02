import PizZip from "pizzip"
import { describe, expect, it } from "vitest"

import {
  extractDocumentText,
  renderTemplate,
  templatizeDocument,
  TemplatizeError,
} from "../../packages/core/src/index.ts"
import { createDocx } from "./fixtures.ts"

describe("renderTemplate", () => {
  it("renders nested values and replaces missing values with an empty string", async () => {
    const template = await createDocx(["Hello {{person.name}}", "Optional: {{person.title}}"])

    const output = renderTemplate({ template, data: { person: { name: "Ada" } } })

    await expect(extractDocumentText(output, "rendered.docx")).resolves.toContain("Hello Ada")
    await expect(extractDocumentText(output, "rendered.docx")).resolves.toContain("Optional:")
  })

  it("rejects invalid DOCX input", () => {
    expect(() => renderTemplate({ template: Buffer.from("not a docx"), data: {} })).toThrow()
  })
})

describe("templatizeDocument", () => {
  it("replaces, deletes, and inserts paragraphs while escaping replacement text", async () => {
    const source = await createDocx(["Before", "Replace this", "Remove first", "Remove last", "After"])

    const output = templatizeDocument(source, [
      { type: "replace", match: "Replace this", runs: [{ text: "{{title}} & <safe>" }] },
      { type: "delete-range", fromMatch: "Remove first", toMatch: "Remove last" },
      { type: "insert-paragraph", anchorMatch: "After", position: "before", runs: [{ text: "{{#items}}" }] },
      { type: "insert-paragraph", anchorMatch: "After", position: "after", runs: [{ text: "{{/items}}" }] },
    ])

    const documentXml = new PizZip(output).file("word/document.xml")?.asText()

    expect(documentXml).toContain("{{title}} &amp; &lt;safe&gt;")
    expect(documentXml).not.toContain("Remove first")
    expect(documentXml).toContain("{{#items}}")
  })

  it("rejects DOCX archives without a document XML file", () => {
    const archiveWithoutDocument = new PizZip().generate({ type: "uint8array" })

    expect(() => templatizeDocument(archiveWithoutDocument, [])).toThrow(TemplatizeError)
    expect(() => templatizeDocument(archiveWithoutDocument, [])).toThrow("word/document.xml")
  })

  it("reports missing replacement and delete-range targets", async () => {
    const source = await createDocx(["Only paragraph"])

    expect(() => templatizeDocument(source, [
      { type: "replace", match: "Missing", runs: [{ text: "{{value}}" }] },
    ])).toThrow('replace 대상 문단을 찾지 못했습니다: "Missing"')

    expect(() => templatizeDocument(source, [
      { type: "delete-range", fromMatch: "Only", toMatch: "Missing end" },
    ])).toThrow('delete-range의 toMatch를 fromMatch 이후에서 찾지 못했습니다: "Missing end"')
  })
})
