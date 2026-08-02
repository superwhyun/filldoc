import { describe, expect, it } from "vitest"

import { inspectTemplate, validateRenderData } from "../../packages/core/src/index.ts"
import { createDocx } from "./fixtures.ts"

describe("validateRenderData", () => {
  it("reports no missing placeholders when data covers every key", async () => {
    const template = await createDocx(["{{title}}", "{{#items}}", "{{name}}", "{{/items}}"])
    const inspection = inspectTemplate(template)
    if (!inspection.ok) throw new Error("expected inspection to succeed")

    const result = validateRenderData({ inspection, data: { title: "T", items: [] } })

    expect(result).toEqual({ missing: [], warnings: [] })
  })

  it("lists missing placeholders and no warnings by default (strict)", async () => {
    const template = await createDocx(["{{title}}", "{{subtitle}}"])
    const inspection = inspectTemplate(template)
    if (!inspection.ok) throw new Error("expected inspection to succeed")

    const result = validateRenderData({ inspection, data: { title: "T" } })

    expect(result.missing).toEqual([{ key: "subtitle" }])
    expect(result.warnings).toEqual([])
  })

  it("emits warnings instead of blocking when allowPartial is true", async () => {
    const template = await createDocx(["{{title}}", "{{subtitle}}"])
    const inspection = inspectTemplate(template)
    if (!inspection.ok) throw new Error("expected inspection to succeed")

    const result = validateRenderData({ inspection, data: { title: "T" }, allowPartial: true })

    expect(result.missing).toEqual([{ key: "subtitle" }])
    expect(result.warnings).toEqual(['"subtitle" 값이 없습니다.'])
  })
})
