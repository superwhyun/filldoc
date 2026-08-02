import { Buffer } from "node:buffer"
import { renderTemplate } from "../../packages/core/src/index.ts"

export function generateDocument(templateContent: Buffer, placeholders: Record<string, unknown>): Buffer {
  return Buffer.from(renderTemplate({ template: templateContent, data: placeholders }))
}
