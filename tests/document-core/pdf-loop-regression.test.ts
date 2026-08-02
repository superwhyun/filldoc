import { describe, expect, it } from "vitest"

import { extractDocumentText, renderTemplate } from "../../packages/core/src/index.ts"
import { createDocxTable, createPdf } from "./fixtures.ts"

describe("PDF regression", () => {
  it("extracts text from a real PDF source (exercises pdf-parse path)", async () => {
    const pdf = createPdf("Hello PDF regression")

    await expect(extractDocumentText(pdf, "source.pdf")).resolves.toContain("Hello PDF regression")
  })

  it("wraps pdf-parse failures for a corrupt PDF source", async () => {
    const corrupt = Buffer.from("%PDF-1.4\nnot a real pdf body", "latin1")

    await expect(extractDocumentText(corrupt, "corrupt.pdf")).rejects.toThrow("PDF 파일에서 텍스트를 추출하지 못했습니다")
  })
})

describe("table dot-loop render regression", () => {
  it("expands a dot-notation table row per array item (exercises render-time XML preprocessing)", async () => {
    const template = await createDocxTable(["No", "Name"], ["{{tasks.no}}", "{{tasks.name}}"])

    const output = renderTemplate({
      template,
      data: {
        tasks: [
          { no: "1", name: "Design" },
          { no: "2", name: "Review" },
        ],
      },
    })

    const text = await extractDocumentText(output, "rendered.docx")
    expect(text).toContain("Design")
    expect(text).toContain("Review")
  })
})
