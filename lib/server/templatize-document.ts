import PizZip from "pizzip"

export type TemplatizeRun = { text: string } | { tab: true }

export type TemplatizeEdit =
  | { type: "replace"; match: string; runs: TemplatizeRun[] }
  | { type: "delete-range"; fromMatch: string; toMatch: string }
  | { type: "insert-paragraph"; anchorMatch: string; position: "before" | "after"; runs: TemplatizeRun[] }

export class TemplatizeError extends Error {}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function paragraphText(paraXml: string) {
  return paraXml.replace(/<[^>]+>/g, "")
}

/**
 * 문단의 <w:pPr>는 그대로 두고, 첫 번째 <w:r>의 <w:rPr>(폰트/크기/굵게/밑줄 등)을
 * 재사용한 새 run(들)으로 문단 내용을 통째로 교체한다. 문단/문자 서식은 원본 그대로,
 * 텍스트만 바뀐다.
 */
function rebuildParagraph(paraXml: string, runs: TemplatizeRun[]): string {
  const pPrMatch = paraXml.match(/^(<w:p[^>]*>(?:<w:pPr>[\s\S]*?<\/w:pPr>)?)/)
  const prefix = pPrMatch ? pPrMatch[1] : paraXml.match(/^<w:p[^>]*>/)![0]

  const firstRunRPrMatch = paraXml.match(/<w:r[^>]*><w:rPr>([\s\S]*?)<\/w:rPr>/)
  const donorRPr = firstRunRPrMatch ? firstRunRPrMatch[1] : ""

  const runsXml = runs
    .map((run) => {
      if ("tab" in run) return `<w:r><w:rPr>${donorRPr}</w:rPr><w:tab/></w:r>`
      return `<w:r><w:rPr>${donorRPr}</w:rPr><w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`
    })
    .join("")

  return `${prefix}${runsXml}</w:p>`
}

/**
 * 루프 시작/끝 태그({{#x}}/{{/x}})만 담는 새 문단을 만든다. 문단 자체엔 pPr을 주지 않는다 —
 * docxtemplater의 paragraphLoop는 태그만 있는 이런 "경계 문단"을 렌더링 시 통째로 제거하므로,
 * 반복 사이에 불필요한 빈 줄이 남지 않는다 (여러 문단을 하나의 루프로 반복할 때 쓰는 표준 패턴).
 */
function buildTagOnlyParagraph(runs: TemplatizeRun[]): string {
  const runsXml = runs
    .map((run) => {
      if ("tab" in run) return `<w:r><w:tab/></w:r>`
      return `<w:r><w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`
    })
    .join("")
  return `<w:p>${runsXml}</w:p>`
}

/**
 * 원본 docx를 열어 지정된 문단만 서식을 유지한 채 텍스트를 치환하거나, 지정된 범위의
 * 문단을 통째로 삭제하거나, 앵커 문단 앞/뒤에 새 문단(주로 루프 태그 전용)을 끼워 넣는다.
 * AI 호출 없음 — 어떤 문단을 어떻게 바꿀지는 호출자가 edits로 직접 지정한다.
 *
 * 문단 매칭은 각 <w:p>의 태그를 제거한 순수 텍스트에 대해 부분 문자열(includes)로
 * 이뤄지며, 문서 순서상 앞에서부터 처음 매칭되는 문단을 사용한다. 매칭은 항상 원본
 * 문서 기준이라, edits 순서와 무관하게 안정적으로 동작한다.
 *
 * 여러 문단에 걸친 루프({{#x}}...{{/x}})를 만들 때는 시작/끝 태그를 내용 문단에 섞지 말고,
 * insert-paragraph로 태그 전용 문단을 앞/뒤에 별도로 끼워 넣어야 반복 사이 줄바꿈이 보존된다.
 */
export function templatizeDocument(originalBuffer: Buffer, edits: TemplatizeEdit[]): Buffer {
  const zip = new PizZip(originalBuffer)
  const file = zip.file("word/document.xml")
  if (!file) {
    throw new TemplatizeError("word/document.xml을 찾을 수 없습니다. 올바른 .docx 파일인지 확인하세요.")
  }

  const xml = file.asText()
  const pRegex = /<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>/g
  const matches = [...xml.matchAll(pRegex)]

  const replaceByIndex = new Map<number, TemplatizeRun[]>()
  const deleteIndices = new Set<number>()
  const insertBeforeByIndex = new Map<number, TemplatizeRun[][]>()
  const insertAfterByIndex = new Map<number, TemplatizeRun[][]>()

  function findIndex(matchText: string, label: string): number {
    const idx = matches.findIndex((m) => paragraphText(m[0]).includes(matchText))
    if (idx === -1) {
      throw new TemplatizeError(`${label} 대상 문단을 찾지 못했습니다: "${matchText}"`)
    }
    return idx
  }

  for (const edit of edits) {
    if (edit.type === "replace") {
      const idx = findIndex(edit.match, "replace")
      replaceByIndex.set(idx, edit.runs)
      continue
    }

    if (edit.type === "insert-paragraph") {
      const idx = findIndex(edit.anchorMatch, "insert-paragraph")
      const map = edit.position === "before" ? insertBeforeByIndex : insertAfterByIndex
      const list = map.get(idx) ?? []
      list.push(edit.runs)
      map.set(idx, list)
      continue
    }

    const fromIdx = findIndex(edit.fromMatch, "delete-range의 fromMatch")
    const toIdxRelative = matches.slice(fromIdx).findIndex((m) => paragraphText(m[0]).includes(edit.toMatch))
    if (toIdxRelative === -1) {
      throw new TemplatizeError(`delete-range의 toMatch를 fromMatch 이후에서 찾지 못했습니다: "${edit.toMatch}"`)
    }
    const toIdx = fromIdx + toIdxRelative

    for (let i = fromIdx; i <= toIdx; i++) deleteIndices.add(i)
  }

  let result = ""
  let cursor = 0

  matches.forEach((m, i) => {
    const start = m.index!
    const end = start + m[0].length
    result += xml.slice(cursor, start)

    for (const runs of insertBeforeByIndex.get(i) ?? []) {
      result += buildTagOnlyParagraph(runs)
    }

    if (deleteIndices.has(i)) {
      // 문단 자체를 출력하지 않는다.
    } else if (replaceByIndex.has(i)) {
      result += rebuildParagraph(m[0], replaceByIndex.get(i)!)
    } else {
      result += m[0]
    }

    for (const runs of insertAfterByIndex.get(i) ?? []) {
      result += buildTagOnlyParagraph(runs)
    }

    cursor = end
  })

  result += xml.slice(cursor)

  zip.file("word/document.xml", result)
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" })
}
