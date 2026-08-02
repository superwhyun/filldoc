export type DocumentBytes = Uint8Array

export type Placeholder = {
  key: string
  description?: string
  isLoop?: boolean
  fields?: string[]
}

export type TemplateInspection =
  | { ok: true; placeholders: Placeholder[]; warnings?: string[] }
  | { ok: false; error: string; validations: string[]; warnings?: string[] }
