import { describe, expect, it } from "vitest"

import { extractDocumentText, renderTemplate } from "../../packages/core/src/index.ts"
import { createDocxTable } from "./fixtures.ts"

// Word로 저장한 템플릿은 {{projects.id:설명}} 한 개가 여러 run으로 쪼개진다.
describe("renderTemplate with placeholders split across runs", () => {
  const data = { projects: [{ id: "PWI 26749", leader: "Pei LI" }, { id: "AWI TR 24988", leader: "Mengyang Lan" }] }

  it("repeats table rows when dot placeholders with descriptions are split across runs", async () => {
    const template = await createDocxTable(["Project", "Leader"], [
      ["{{", "projects.id", ":", "프로젝트", " ", "번호", "}}"],
      ["{{", "projects.leader", ":리더}}"],
    ])

    const text = await extractDocumentText(renderTemplate({ template, data }), "rendered.docx")

    expect(text).toContain("PWI 26749")
    expect(text).toContain("Pei LI")
    expect(text).toContain("AWI TR 24988")
    expect(text).toContain("Mengyang Lan")
    expect(text).not.toContain("{{")
  })

  it("repeats table rows when split dot placeholders have no description", async () => {
    const template = await createDocxTable(["Project", "Leader"], [["{{projects", ".id}}"], ["{{", "projects.leader", "}}"]])

    const text = await extractDocumentText(renderTemplate({ template, data }), "rendered.docx")

    expect(text).toContain("PWI 26749")
    expect(text).toContain("Mengyang Lan")
  })
})
