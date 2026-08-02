import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"

import type { DocumentBytes } from "./types.ts"

export type TemplateBlock =
  | { type: "heading"; level?: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet_list"; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "spacer"; lines?: number }
  | {
      type: "repeating_section"
      loopName: string
      blocks: Array<{ type: "heading" | "paragraph"; level?: 1 | 2 | 3; text: string }>
    }

export type TemplateGenerationJson = {
  fileName?: string
  title?: string
  subtitle?: string
  blocks: TemplateBlock[]
}

export type BuiltTemplate = {
  content: DocumentBytes
  spec: TemplateGenerationJson
  filename: string
}

type TextReference = { get: () => string; set: (value: string) => void }

function normalizeFileName(name: string): string {
  const base = name.trim().replace(/[\\/:*?"<>|]/g, "-")
  if (!base) return "template.docx"
  return base.toLowerCase().endsWith(".docx") ? base : `${base}.docx`
}

function cloneSpec(spec: TemplateGenerationJson): TemplateGenerationJson {
  return {
    ...spec,
    blocks: spec.blocks.map((block) => {
      if (block.type === "bullet_list") return { ...block, items: [...block.items] }
      if (block.type === "table") return { ...block, header: [...block.header], rows: block.rows.map((row) => [...row]) }
      if (block.type === "repeating_section") return { ...block, blocks: block.blocks.map((inner) => ({ ...inner })) }
      return { ...block }
    }),
  }
}

function placeholderSegments(text: string): Array<{ prefix: string; key: string; description: string }> {
  const segments: Array<{ prefix: string; key: string; description: string }> = []
  const regex = /\{\{\s*([#\/]?)([a-zA-Z0-9_]+)(?:\s*:\s*([^}]+))?\s*\}\}/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    segments.push({ prefix: match[1] || "", key: match[2], description: (match[3] || "").trim() })
  }
  return segments
}

function normalizeConflictingPlaceholderKeys(input: TemplateGenerationJson): TemplateGenerationJson {
  const spec = cloneSpec(input)
  const refs: TextReference[] = []
  const add = (object: Record<string, unknown>, key: string) => {
    if (typeof object[key] === "string") refs.push({ get: () => object[key] as string, set: (value) => { object[key] = value } })
  }

  add(spec as Record<string, unknown>, "title")
  add(spec as Record<string, unknown>, "subtitle")
  for (const block of spec.blocks) {
    if (block.type === "heading" || block.type === "paragraph") add(block, "text")
    if (block.type === "bullet_list") block.items.forEach((_, index) => refs.push({ get: () => block.items[index], set: (value) => { block.items[index] = value } }))
    if (block.type === "table") {
      block.header.forEach((_, index) => refs.push({ get: () => block.header[index], set: (value) => { block.header[index] = value } }))
      block.rows.forEach((row, rowIndex) => row.forEach((_, cellIndex) => refs.push({ get: () => block.rows[rowIndex][cellIndex], set: (value) => { block.rows[rowIndex][cellIndex] = value } })))
    }
    if (block.type === "repeating_section") block.blocks.forEach((inner, index) => refs.push({ get: () => block.blocks[index].text, set: (value) => { block.blocks[index].text = value } }))
  }

  const descriptions = new Map<string, Set<string>>()
  for (const ref of refs) for (const segment of placeholderSegments(ref.get())) {
    if (!segment.prefix && segment.description) (descriptions.get(segment.key) ?? descriptions.set(segment.key, new Set()).get(segment.key)!).add(segment.description)
  }
  const conflicts = new Set([...descriptions].filter(([, values]) => values.size > 1).map(([key]) => key))
  if (conflicts.size === 0) return spec

  const firstDescription = new Map<string, string>()
  const replacements = new Map<string, string>()
  const counts = new Map<string, number>()
  for (const ref of refs) for (const segment of placeholderSegments(ref.get())) {
    if (!conflicts.has(segment.key) || segment.prefix || !segment.description) continue
    const first = firstDescription.get(segment.key)
    if (!first) { firstDescription.set(segment.key, segment.description); continue }
    if (first === segment.description) continue
    const signature = `${segment.key}\u0000${segment.description}`
    if (!replacements.has(signature)) {
      const count = (counts.get(segment.key) ?? 1) + 1
      counts.set(segment.key, count)
      replacements.set(signature, `${segment.key}_${count}`)
    }
  }
  for (const ref of refs) ref.set(ref.get().replace(/\{\{\s*([#\/]?)([a-zA-Z0-9_]+)(?:\s*:\s*([^}]+))?\s*\}\}/g, (raw, prefix, key, description) => {
    if (prefix || !description) return raw
    const renamed = replacements.get(`${key}\u0000${String(description).trim()}`)
    return renamed ? `{{${renamed}:${String(description).trim()}}}` : raw
  }))
  return spec
}

function headingLevel(level?: 1 | 2 | 3): typeof HeadingLevel[keyof typeof HeadingLevel] {
  if (level === 1) return HeadingLevel.HEADING_1
  if (level === 3) return HeadingLevel.HEADING_3
  return HeadingLevel.HEADING_2
}

function tableCell(text: string, header = false): TableCell {
  return new TableCell({ width: { size: 100 / 3, type: WidthType.PERCENTAGE }, margins: { top: 120, bottom: 120, left: 120, right: 120 }, shading: header ? { fill: "F3F4F6" } : undefined, children: [new Paragraph({ spacing: { after: 0, before: 0 }, children: [new TextRun({ text, bold: header, size: header ? 22 : 20 })] })] })
}

function paragraph(text: string, options: { heading?: 1 | 2 | 3; loopTag?: boolean } = {}): Paragraph {
  if (options.loopTag) return new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text, size: 2 })] })
  if (options.heading) return new Paragraph({ heading: headingLevel(options.heading), spacing: { before: 260, after: 120 }, children: [new TextRun({ text, bold: true })] })
  return new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text, size: 22 })] })
}

/** Builds a DOCX from an agent-provided template specification without web or AI dependencies. */
export async function buildTemplateFromSpec(input: { spec: TemplateGenerationJson; templateName?: string }): Promise<BuiltTemplate> {
  const spec = normalizeConflictingPlaceholderKeys(input.spec)
  const children: Array<Paragraph | Table> = []
  if (spec.title?.trim()) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: spec.title.trim(), bold: true, size: 44 })] }))
  if (spec.subtitle?.trim()) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: spec.subtitle.trim(), italics: true, color: "6B7280", size: 22 })] }))

  for (const block of spec.blocks) {
    if (block.type === "heading") children.push(paragraph(block.text, { heading: block.level }))
    else if (block.type === "paragraph") children.push(paragraph(block.text))
    else if (block.type === "bullet_list") for (const item of block.items) children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 100 }, children: [new TextRun({ text: item, size: 22 })] }))
    else if (block.type === "spacer") for (let index = 0; index < Math.max(1, Math.min(8, Math.floor(block.lines ?? 1))); index += 1) children.push(new Paragraph({ spacing: { after: 120 } }))
    else if (block.type === "repeating_section") {
      children.push(paragraph(`{{#${block.loopName}}}`, { loopTag: true }))
      for (const inner of block.blocks) children.push(paragraph(inner.text, { heading: inner.type === "heading" ? inner.level : undefined }))
      children.push(paragraph(`{{/${block.loopName}}}`, { loopTag: true }))
    } else if (block.header.length > 0) {
      const columns = Math.max(block.header.length, ...block.rows.map((row) => row.length))
      const cells = (row: string[]) => Array.from({ length: columns }, (_, index) => row[index] ?? "")
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" }, left: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" }, right: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" } }, rows: [new TableRow({ children: cells(block.header).map((cell) => tableCell(cell, true)) }), ...block.rows.map((row) => new TableRow({ children: cells(row).map((cell) => tableCell(cell)) }))] }))
      children.push(new Paragraph({ spacing: { after: 160 } }))
    }
  }
  if (children.length === 0) throw new Error("생성된 템플릿 블록이 비어있습니다.")

  const document = new Document({ styles: { default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { line: 320 } } } } }, sections: [{ properties: { page: { margin: { top: 1100, right: 1100, bottom: 1100, left: 1100 } } }, children }] })
  return { content: new Uint8Array(await Packer.toBuffer(document)), spec, filename: normalizeFileName(input.templateName || spec.fileName || "template.docx") }
}
