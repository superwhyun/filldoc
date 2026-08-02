import { describe, expect, it } from "vitest"

import { generateDocument } from "../../lib/server/generate-document.ts"
import { extractPlaceholders } from "../../lib/server/extract-placeholders.ts"
import { extractTextFromBuffer } from "../../lib/server/extract-text.ts"
import { templatizeDocument } from "../../lib/server/templatize-document.ts"
import { buildTemplateFromSpec } from "../../lib/client-template-generator.ts"
import { createDocx } from "./fixtures.ts"

describe("current document-core behavior", () => {
  it("extracts normal and explicit-loop placeholders", async () => {
    const template = await createDocx(["{{title:문서 제목}}", "{{#items}}", "{{name}}", "{{/items}}"])

    expect(extractPlaceholders(template)).toEqual({
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
    const output = generateDocument(template, { title: "Rendered title" })

    await expect(extractTextFromBuffer(output, "output.docx")).resolves.toContain("Rendered title")
  })

  it("extracts text from a local text source", async () => {
    await expect(extractTextFromBuffer(Buffer.from("meeting notes", "utf8"), "notes.md"))
      .resolves.toBe("meeting notes")
  })

  it("templatizes a source paragraph and exposes its placeholder", async () => {
    const source = await createDocx(["Original title"])
    const output = templatizeDocument(source, [
      { type: "replace", match: "Original title", runs: [{ text: "{{title}}" }] },
    ])

    expect(extractPlaceholders(output)).toMatchObject({
      ok: true,
      placeholders: [{ key: "title" }],
    })
  })

  it("builds a template from an agent-provided spec", async () => {
    const { file } = await buildTemplateFromSpec({
      blocks: [{ type: "paragraph", text: "{{title}}" }],
    })
    const output = Buffer.from(await file.arrayBuffer())

    expect(extractPlaceholders(output)).toMatchObject({
      ok: true,
      placeholders: [{ key: "title" }],
    })
  })
})
