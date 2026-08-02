import { describe, expect, it } from "vitest"

import { buildTemplateFromSpec, extractDocumentText, inspectTemplate, renderTemplate, templatizeDocument } from "../../packages/core/src/index.ts"
import { createDocx } from "./fixtures.ts"

describe("current document-core behavior", () => {
  it("extracts normal and explicit-loop placeholders", async () => {
    const template = await createDocx(["{{title:문서 제목}}", "{{#items}}", "{{name}}", "{{/items}}"])

    expect(inspectTemplate(template)).toEqual({
      ok: true,
      placeholders: [
        { key: "title", description: "문서 제목" },
        { key: "items", isLoop: true, fields: ["name"] },
      ],
      warnings: undefined,
    })
  })

  it("renders template data into a DOCX", async () => {
    const template = await createDocx(["{{title}}"])
    const output = renderTemplate({ template, data: { title: "Rendered title" } })

    await expect(extractDocumentText(output, "output.docx")).resolves.toContain("Rendered title")
  })

  it("extracts text from a local text source", async () => {
    await expect(extractDocumentText(Buffer.from("meeting notes", "utf8"), "notes.md"))
      .resolves.toBe("meeting notes")
  })

  it("rejects empty and unsupported sources", async () => {
    await expect(extractDocumentText(new Uint8Array(), "empty.txt")).rejects.toThrow("비어있습니다")
    await expect(extractDocumentText(Buffer.from("x"), "source.doc")).rejects.toThrow(".doc")
    await expect(extractDocumentText(Buffer.from("x"), "source.csv")).rejects.toThrow("지원하지 않는")
  })

  it("templatizes a source paragraph and exposes its placeholder", async () => {
    const source = await createDocx(["Original title"])
    const output = templatizeDocument(source, [
      { type: "replace", match: "Original title", runs: [{ text: "{{title}}" }] },
    ])

    expect(inspectTemplate(output)).toMatchObject({
      ok: true,
      placeholders: [{ key: "title" }],
    })
  })

  it("builds a template from an agent-provided spec", async () => {
    const { content } = await buildTemplateFromSpec({
      spec: { blocks: [{ type: "paragraph", text: "{{title}}" }], },
    })

    expect(inspectTemplate(content)).toMatchObject({
      ok: true,
      placeholders: [{ key: "title" }],
    })
  })

  it("builds every non-AI block kind", async () => {
    const built = await buildTemplateFromSpec({
      templateName: "unsafe/name",
      spec: { title: "Title", subtitle: "Sub", blocks: [
        { type: "heading", level: 1, text: "{{heading}}" },
        { type: "bullet_list", items: ["one"] },
        { type: "table", header: ["Name"], rows: [["{{tasks.name}}"]] },
        { type: "spacer", lines: 2 },
        { type: "repeating_section", loopName: "items", blocks: [{ type: "paragraph", text: "{{name}}" }] },
      ] },
    })
    expect(built.filename).toBe("unsafe-name.docx")
    expect(inspectTemplate(built.content)).toMatchObject({ ok: true })
  })


  it("builds repeating sections and table loops without mutating the input spec", async () => {
    const spec = {
      blocks: [
        { type: "repeating_section" as const, loopName: "items", blocks: [{ type: "heading" as const, level: 2 as const, text: "{{name}}" }] },
        { type: "table" as const, header: ["Name"], rows: [["{{tasks.name}}"]] },
      ],
    }

    const { content, spec: normalized } = await buildTemplateFromSpec({ spec })

    expect(spec).toEqual({
      blocks: [
        { type: "repeating_section", loopName: "items", blocks: [{ type: "heading", level: 2, text: "{{name}}" }] },
        { type: "table", header: ["Name"], rows: [["{{tasks.name}}"]] },
      ],
    })
    expect(normalized).not.toBe(spec)
    expect(inspectTemplate(content)).toMatchObject({
      ok: true,
      placeholders: [
        { key: "items", isLoop: true, fields: ["name"] },
        { key: "tasks", isLoop: true, fields: ["name"] },
      ],
    })
  })
})
