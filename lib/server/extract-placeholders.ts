import PizZip from "pizzip"
import Docxtemplater from "docxtemplater"

export type PlaceholderResult = {
  key: string
  description?: string
  isLoop?: boolean
  fields?: string[]
}

export type ExtractPlaceholdersResult =
  | { ok: true; placeholders: PlaceholderResult[]; warnings?: string[] }
  | { ok: false; error: string; validations: string[]; warnings?: string[] }

/**
 * 템플릿 docx 바이트에서 {{keyword}}, {{keyword:description}}, {{#loop}}...{{/loop}},
 * {{parent.child}} 문법의 플레이스홀더를 추출한다.
 * 라이브러리 수준 예외(손상된 docx 등)는 호출자에게 그대로 던진다.
 */
export function extractPlaceholders(buffer: Buffer): ExtractPlaceholdersResult {
  const zip = new PizZip(buffer)

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: {
      start: '{{',
      end: '}}'
    },
    // 에러를 수집하되 계속 진행
    parser: (tag: string) => {
      return {
        get: (scope: any) => {
          return scope[tag]
        }
      }
    }
  })

  // Extract all placeholders from the template
  // 형식: {{keyword}}, {{keyword:description}}, {{#array}}, {{/array}}, {{parent.child}}, {{parent.child:description}}
  const text = doc.getFullText()

  // 정규표현식 업데이트: 점(.) 문법 지원
  // [1]: #, / 또는 빈 문자열
  // [2]: keyword (parent.child 가능)
  // [3]: description (선택 사항)
  const simpleRegex = /\{\{([#\/]?)([^\s{}:]+)(?::([^}]+))?\}\}/g
  const matches = text.matchAll(simpleRegex)

  // key를 기준으로 중복 제거하고 description 보존
  const placeholderMap = new Map<string, PlaceholderResult>()
  const parseErrors: string[] = []

  // 현재 활성화된 루프 추적
  const activeLoops = new Set<string>()

  for (const match of matches) {
    const prefix = match[1] // #, /, 또는 빈 문자열
    const rawKey = match[2]
    const description = match[3]?.trim()

    // 1. 루프 시작 태그 (#) 처리
    if (prefix === '#') {
      activeLoops.add(rawKey)
      if (!placeholderMap.has(rawKey)) {
        placeholderMap.set(rawKey, {
          key: rawKey,
          isLoop: true,
          ...(description && { description }),
          fields: []
        })
      }
    }
    // 2. 루프 종료 태그 (/)
    else if (prefix === '/') {
      activeLoops.delete(rawKey)
      continue
    }
    // 3. 점(.) 문법 처리 (예: tasks.name)
    else if (rawKey.includes('.')) {
      const [parent, ...childParts] = rawKey.split('.')
      const child = childParts.join('.')

      if (!parent || !child) {
        parseErrors.push(`점 문법 오류: {{${rawKey}}} 형식이 올바르지 않습니다. 예: {{tasks.name}}`)
        continue
      }

      if (!placeholderMap.has(parent)) {
        placeholderMap.set(parent, {
          key: parent,
          isLoop: true,
          fields: [child]
        })
      } else {
        const entry = placeholderMap.get(parent)!
        entry.isLoop = true
        if (!entry.fields) entry.fields = []
        if (!entry.fields.includes(child)) {
          entry.fields.push(child)
        }
        if (description && !entry.description) {
          entry.description = description
        }
      }
    }
    // 4. 일반 플레이스홀더 (루프 안에 있으면 필드로 추가)
    else {
      // 활성 루프가 있으면 해당 루프의 필드로 추가
      if (activeLoops.size > 0) {
        // 가장 마지막에 시작된 루프에 추가
        const currentLoop = Array.from(activeLoops)[activeLoops.size - 1]
        const loopEntry = placeholderMap.get(currentLoop)!
        if (!loopEntry.fields) loopEntry.fields = []
        if (!loopEntry.fields.includes(rawKey)) {
          loopEntry.fields.push(rawKey)
        }
      }
      // 루프 밖에 있는 일반 플레이스홀더
      else {
        if (!placeholderMap.has(rawKey)) {
          placeholderMap.set(rawKey, {
            key: rawKey,
            ...(description && { description })
          })
        }
      }
    }
  }

  const placeholders = Array.from(placeholderMap.values())

  // 루프 태그 검증: #/ 쌍 검증 (점 문법은 제외)
  const loopStarts = Array.from(text.matchAll(/\{\{#([a-zA-Z0-9_]+)/g)).map(m => m[1])
  const loopEnds = Array.from(text.matchAll(/\{\{\/([a-zA-Z0-9_]+)/g)).map(m => m[1])

  const warnings: string[] = []

  loopStarts.forEach(key => {
    if (!loopEnds.includes(key)) {
      parseErrors.push(`루프 태그 오류: {{#${key}}}에 대응하는 {{/${key}}}가 없습니다.`)
    }
  })

  loopEnds.forEach(key => {
    if (!loopStarts.includes(key)) {
      parseErrors.push(`루프 태그 오류: {{/${key}}}에 대응하는 {{#${key}}}가 없습니다.`)
    }
  })

  // strict schema를 위해 루프 필드는 최소 1개 이상의 자식 필드가 필요
  placeholders.forEach((p) => {
    if (p.isLoop && (!p.fields || p.fields.length === 0)) {
      parseErrors.push(
        `루프 필드 오류: "${p.key}" 루프에서 필드를 찾지 못했습니다. 예: {{#${p.key}}}{{name}}{{/${p.key}}} 또는 {{${p.key}.name}}`
      )
    }
  })

  if (parseErrors.length > 0) {
    return {
      ok: false,
      error: "템플릿 문법 검증 실패",
      validations: parseErrors,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  return {
    ok: true,
    placeholders,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
