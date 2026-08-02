import { describe, expect, it } from "vitest"

import { inspectTemplate } from "../../packages/core/src/index.ts"
import { buildTemplateFromSpec } from "../../lib/client-template-generator.ts"

describe("lib/client-template-generator buildTemplateFromSpec (web adapter)", () => {
  it("delegates to core's single template builder and returns a readable File", async () => {
    const { file, spec } = await buildTemplateFromSpec({
      title: "Title",
      blocks: [{ type: "paragraph", text: "{{title}}" }],
    })

    expect(file.name.endsWith(".docx")).toBe(true)
    expect(file.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    expect(spec.blocks).toEqual([{ type: "paragraph", text: "{{title}}" }])

    const bytes = new Uint8Array(await file.arrayBuffer())
    expect(inspectTemplate(bytes)).toMatchObject({ ok: true, placeholders: [{ key: "title" }] })
  })

  it("falls back to a timestamped filename when neither templateName nor spec.fileName is set", async () => {
    const { file } = await buildTemplateFromSpec({ blocks: [{ type: "paragraph", text: "x" }] })

    expect(file.name).toMatch(/^template-\d+\.docx$/)
  })

  it("prefers the explicit templateName argument over spec.fileName", async () => {
    const { file } = await buildTemplateFromSpec(
      { fileName: "from-spec.docx", blocks: [{ type: "paragraph", text: "x" }] },
      "explicit-name",
    )

    expect(file.name).toBe("explicit-name.docx")
  })
})
