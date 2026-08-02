import type { Placeholder, RenderDataValidation, TemplateInspection } from "./types.ts"

export function validateRenderData(input: {
  inspection: Extract<TemplateInspection, { ok: true }>
  data: Record<string, unknown>
  allowPartial?: boolean
}): RenderDataValidation {
  const missing: Placeholder[] = input.inspection.placeholders.filter((placeholder) => !(placeholder.key in input.data))
  return {
    missing,
    warnings: input.allowPartial ? missing.map((placeholder) => `"${placeholder.key}" 값이 없습니다.`) : [],
  }
}
