import { Buffer } from "node:buffer"
import {
  templatizeDocument as templatizeDocumentCore,
  TemplatizeError,
} from "../../packages/core/src/index.ts"
import type { TemplatizeEdit, TemplatizeRun } from "../../packages/core/src/index.ts"

export { TemplatizeError }
export type { TemplatizeEdit, TemplatizeRun }

export function templatizeDocument(originalBuffer: Buffer, edits: TemplatizeEdit[]): Buffer {
  return Buffer.from(templatizeDocumentCore(originalBuffer, edits))
}
