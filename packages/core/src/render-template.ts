import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"
import type { DocumentBytes } from "./types.ts"

// Angular parser - docxtemplater에서 제공하는 표준 parser
function angularParser(tag: string) {
  // {{keyword:description}} -> keyword
  const cleanTag = tag.includes(':') ? tag.split(':')[0].trim() : tag

  // 표준 angular expression parser
  if (cleanTag === '') {
    return {
      get: function (scope: any) { return scope; }
    }
  }
  return {
    get: function (scope: any, context: any) {
      let obj: any = scope
      const parts = cleanTag.split('.')
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        obj = obj[part]
        if (obj === undefined || obj === null) {
          return undefined
        }
      }
      return obj
    }
  }
}

const RUN_REGEX = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g
const TEXT_NODE_REGEX = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g

function runText(runXml: string): string {
  return Array.from(runXml.matchAll(TEXT_NODE_REGEX), (match) => match[1]).join('')
}

// "{{"가 열린 채 끝나거나 "{" 한 글자로 끝나면(Word가 "{" "{"를 따로 저장하는 경우) 다음 run까지 이어진다.
function hasOpenPlaceholder(text: string): boolean {
  return text.lastIndexOf('{{') > text.lastIndexOf('}}') || /(^|[^{])\{$/.test(text)
}

// Word는 {{projects.id:설명}} 하나를 여러 run(<w:r>)으로 쪼개고 사이에 <w:proofErr> 등을 끼워 저장한다.
// placeholder가 걸친 run들을 첫 run 하나로 합쳐 XML 상에서도 placeholder가 연속된 텍스트가 되게 한다.
// 합친 run은 첫 run의 서식(rPr)을 따른다.
function mergeSplitPlaceholderRuns(paragraphXml: string): string {
  const runs = Array.from(paragraphXml.matchAll(RUN_REGEX), (match) => ({
    xml: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }))

  let result = ''
  let cursor = 0
  let index = 0
  while (index < runs.length) {
    let text = runText(runs[index].xml)
    let last = index
    while (hasOpenPlaceholder(text) && last + 1 < runs.length) {
      last += 1
      text += runText(runs[last].xml)
    }

    if (last > index) {
      const first = runs[index].xml.replace(TEXT_NODE_REGEX, '')
      const merged = first.replace(/<\/w:r>$/, `<w:t xml:space="preserve">${text}</w:t></w:r>`)
      result += paragraphXml.slice(cursor, runs[index].start) + merged
      cursor = runs[last].end
    }
    index = last + 1
  }

  return result + paragraphXml.slice(cursor)
}

// XML 전처리기: 점 문법(tasks.name)을 찾아 해당 행을 {#tasks}...{/tasks}로 감싸고 태그를 {{name}}으로 단순화합니다.
function preProcessXml(xml: string): string {
  // 1. 모든 테이블 행(<w:tr>)을 찾습니다.
  const trRegex = /<w:tr(?: [^>]+)?>[\s\S]*?<\/w:tr>/g

  return xml.replace(trRegex, (rowXml) => {
    // 워드 XML에서는 {{task.name}}이 내부적으로 <w:t> 태그 등으로 쪼개져 있을 수 있습니다.
    // 이를 감지하기 위해 태그를 제거한 순수 텍스트에서 먼저 확인합니다.
    const strippedText = rowXml.replace(/<[^>]+>/g, '')
    const dotMatch = strippedText.match(/\{\{\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_\.]+)\s*(?::[^}]+)?\}\}/)

    if (dotMatch) {
      const parentName = dotMatch[1]

      // 2. 쪼개진 placeholder run을 합친 뒤, parent. 형식 태그를 {{child}}로 바꿉니다(설명은 보존).
      const mergedRowXml = rowXml.replace(/<w:p[\s>][\s\S]*?<\/w:p>/g, mergeSplitPlaceholderRuns)
      const dotRegex = /\{\{\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_\.]+)\s*(:[^}]*)?\}\}/g

      let newRowXml = mergedRowXml.replace(dotRegex, (match, p, c, desc = '') => {
        return p === parentName ? `{{${c}${desc}}}` : match
      })

      // 3. 행의 시작과 끝에 루프 태그를 삽입합니다.
      // 델리미터가 {{ }} 로 설정되어 있으므로 이를 준수해야 합니다.
      // NOTE: "<w:t[^>]*>" 같은 접두어 매칭은 "<w:tr...>", "<w:tc...>"까지 잘못 잡는다.
      // 실제 텍스트 노드(<w:t> 또는 <w:t ...>)만 매칭하도록 경계를 명확히 한다.
      const firstWtMatch = newRowXml.match(/<w:t(?:\s[^>]*)?>/)
      if (firstWtMatch?.index !== undefined) {
        const firstWtEndIndex = firstWtMatch.index + firstWtMatch[0].length
        newRowXml = newRowXml.slice(0, firstWtEndIndex) + `{{#${parentName}}}` + newRowXml.slice(firstWtEndIndex)
      }

      // 마지막 </w:t> 태그를 찾아 그 앞에 {/parent}를 넣습니다.
      const lastWtOpenIndex = newRowXml.lastIndexOf('</w:t>')
      if (lastWtOpenIndex !== -1) {
        newRowXml = newRowXml.slice(0, lastWtOpenIndex) + `{{/${parentName}}}` + newRowXml.slice(lastWtOpenIndex)
      }

      return newRowXml
    }

    return rowXml
  })
}

/**
 * 템플릿 docx 버퍼와 { key: value } 형태의 placeholder 데이터를 받아
 * 채워진 docx 버퍼를 반환한다.
 */
export function renderTemplate(input: { template: DocumentBytes; data: Record<string, unknown> }): DocumentBytes {
  const { template: templateContent, data: placeholders } = input
  const zip = new PizZip(templateContent)

  // --- XML Pre-processing ---
  try {
    const docXmlPath = "word/document.xml"
    const file = zip.file(docXmlPath)
    if (file) {
      let docXml = file.asText()
      const processedXml = preProcessXml(docXml)
      zip.file(docXmlPath, processedXml)
    }
  } catch (err) {
    // XML Pre-processing failed, continue with original
  }
  // --------------------------

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: {
      start: '{{',
      end: '}}'
    },
    nullGetter: () => {
      return ""
    },
    parser: angularParser
  })

  doc.render(placeholders)

  const output = doc.getZip().generate({
    type: "uint8array",
    compression: "DEFLATE",
  })

  return output
}
