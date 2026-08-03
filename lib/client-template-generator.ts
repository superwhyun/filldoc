import {
  buildTemplateFromSpec as coreBuildTemplateFromSpec,
  type TemplateBlock,
  type TemplateGenerationJson,
} from "../packages/core/src/index.ts"

export type { TemplateBlock, TemplateGenerationJson }

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export type TemplateAIProvider = "openai" | "grok"

type GenerateTemplateInput = {
  provider: TemplateAIProvider
  apiKey: string
  userRequest: string
  templateName?: string
}

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    fileName: { anyOf: [{ type: "string" }, { type: "null" }] },
    title: { anyOf: [{ type: "string" }, { type: "null" }] },
    subtitle: { anyOf: [{ type: "string" }, { type: "null" }] },
    blocks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["heading", "paragraph", "bullet_list", "table", "spacer", "repeating_section"],
          },
          level: { anyOf: [{ type: "number", enum: [1, 2, 3] }, { type: "null" }] },
          text: { type: "string" },
          items: {
            type: "array",
            items: { type: "string" },
          },
          header: {
            type: "array",
            items: { type: "string" },
          },
          rows: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" },
            },
          },
          lines: { type: "number" },
          loopName: { anyOf: [{ type: "string" }, { type: "null" }] },
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["heading", "paragraph"] },
                level: { anyOf: [{ type: "number", enum: [1, 2, 3] }, { type: "null" }] },
                text: { type: "string" },
              },
              required: ["type", "level", "text"],
              additionalProperties: false,
            },
          },
        },
        required: ["type", "level", "text", "items", "header", "rows", "lines", "loopName", "blocks"],
        additionalProperties: false,
      },
    },
  },
  required: ["fileName", "title", "subtitle", "blocks"],
  additionalProperties: false,
} as const

function buildPrompt(userRequest: string, templateName?: string) {
  return `당신은 Word(.docx) 템플릿 설계 전문가입니다.

목표:
- 사용자 요구사항에 맞는 "보기 좋은" 문서 템플릿 구조를 JSON으로 생성하세요.
- 아래 플레이스홀더 문법을 문서 본문에 적극 사용하세요.

플레이스홀더 문법:
- 일반: {{company}}
- 설명 포함: {{project_name:프로젝트 공식 명칭}}
- 루프 시작/끝: {{#tasks}} ... {{/tasks}}
- 루프 내부 필드: {{no}}, {{name}}, {{owner}}

중요 규칙:
1) 의미가 다른 필드는 key를 절대 재사용하지 말 것.
2) key는 snake_case 영어 사용.
3) 같은 key 재사용은 완전히 같은 의미일 때만 허용.
4) blocks는 읽기 좋은 문서 레이아웃(제목, 섹션 제목, 본문, 목록, 표)을 포함할 것.
5) 표가 필요하면 type="table"로 구성하고, rows 안에 플레이스홀더를 넣어도 됨.
5.5) 표가 아니라 "제목+본문" 같은 문단 구조가 여러 번 반복되는 섹션이 필요하면 type="repeating_section"을 쓰고, loopName(snake_case)과 blocks(heading/paragraph만, plain {{field}} placeholder 사용, dot 표기 금지)를 채울 것. 반복 횟수만큼 복제하지 말고 한 번만 작성할 것.
6) 반드시 JSON만 출력. 설명/마크다운/코드블록 금지.
7) blocks의 각 item에는 아래 키를 항상 모두 포함:
   - type, level, text, items, header, rows, lines, loopName, blocks
   - 미사용 필드는 기본값 사용:
     level=null, text="", items=[], header=[], rows=[], lines=1, loopName=null, blocks=[]

선호 파일명(선택): ${templateName?.trim() ? templateName.trim() : "(없음)"}
사용자 요구사항:
${userRequest}`
}

function buildAnalyzePrompt(sourceText: string, templateName?: string) {
  return `당신은 Word(.docx) 템플릿 설계 전문가입니다.

목표:
- 아래는 실제로 작성 완료된 예시 문서의 텍스트입니다. 이 문서를 분석해서, 같은 형식의 문서를 반복해서 만들 때 재사용할 수 있는 "템플릿" 구조를 JSON으로 생성하세요.
- 문서 안에서 매번 바뀔 수 있는 부분(날짜, 이름, 문서번호, 각 항목의 제목/본문 등 "인스턴스별 데이터")과, 항상 똑같이 유지되는 상용구(boilerplate)를 구분하세요.
- 인스턴스별 데이터는 아래 플레이스홀더 문법으로 바꾸세요.

플레이스홀더 문법:
- 일반: {{company}}
- 설명 포함: {{project_name:프로젝트 공식 명칭, 원문 예시 참고}}
- 표 안 반복(dot 표기): {{tasks.no}}, {{tasks.name}}
- 문단 반복(repeating_section): loopName + blocks(heading/paragraph, plain {{field}})

중요 규칙:
1) 의미가 다른 필드는 key를 절대 재사용하지 말 것.
2) key는 snake_case 영어 사용.
3) description에는 원문에서 어떤 값이 들어있었는지 예시로 남겨서, 나중에 이 템플릿을 채우는 사람/AI가 형식을 알 수 있게 할 것.
4) 문서 안에서 유사한 구조(제목+본문 등)가 여러 번 반복되면(예: 번호 매겨진 항목 목록), type="repeating_section" 블록 하나로 표현하세요. **반복 횟수만큼 blocks를 복제하지 말고 대표 예시 1회분만** 작성하고, loopName(snake_case)을 정하고, 반복 내부 값은 plain {{field}} placeholder(dot 표기 금지)로 표시하세요.
5) 실제 Word 표(격자) 형태의 반복은 type="table"을 쓰고 셀 안에 {{parent.field}} dot 표기를 쓰세요.
6) 문서의 나머지 구조(제목, 섹션 헤딩, 서두 문단, 마무리 문단 등)는 heading/paragraph/bullet_list/spacer 블록으로 최대한 원문 순서와 구조를 보존해서 표현하세요.
7) 반드시 JSON만 출력. 설명/마크다운/코드블록 금지.
8) blocks의 각 item에는 아래 키를 항상 모두 포함:
   - type, level, text, items, header, rows, lines, loopName, blocks
   - 미사용 필드는 기본값 사용:
     level=null, text="", items=[], header=[], rows=[], lines=1, loopName=null, blocks=[]

선호 파일명(선택): ${templateName?.trim() ? templateName.trim() : "(없음)"}
예시 문서 텍스트:
${sourceText}`
}

function parseGenerationJson(rawText: string): TemplateGenerationJson {
  const trimmed = rawText.trim()
  try {
    const parsed = JSON.parse(trimmed) as TemplateGenerationJson
    if (!Array.isArray(parsed.blocks)) throw new Error("blocks field is required")
    return parsed
  } catch {
    const start = trimmed.indexOf("{")
    const end = trimmed.lastIndexOf("}")
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("AI 응답에서 JSON을 찾지 못했습니다.")
    }
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as TemplateGenerationJson
    if (!Array.isArray(parsed.blocks)) throw new Error("blocks field is required")
    return parsed
  }
}

function extractOpenAIText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text
  }

  const output = Array.isArray(data?.output) ? data.output : []
  const chunks: string[] = []

  for (const item of output) {
    const contents = Array.isArray(item?.content) ? item.content : []
    for (const content of contents) {
      if (typeof content?.text === "string" && content.text.trim()) chunks.push(content.text)
      if (typeof content?.output_text === "string" && content.output_text.trim()) chunks.push(content.output_text)
      if (typeof content?.arguments === "string" && content.arguments.trim()) chunks.push(content.arguments)
    }

    if (typeof item?.text === "string" && item.text.trim()) chunks.push(item.text)
    if (typeof item?.arguments === "string" && item.arguments.trim()) chunks.push(item.arguments)
  }

  if (chunks.length > 0) return chunks.join("\n")

  if (typeof data?.status === "string" && data.status !== "completed") {
    const reason = data?.incomplete_details?.reason
    throw new Error(`OpenAI 응답이 완료되지 않았습니다. status=${data.status}${reason ? `, reason=${reason}` : ""}`)
  }

  return ""
}

async function generateWithOpenAI(apiKey: string, prompt: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      input: prompt,
      reasoning: { effort: "low" },
      max_output_tokens: 6000,
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "template_design",
          strict: true,
          schema: OUTPUT_SCHEMA,
        },
      },
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    const err = data?.error?.message || "OpenAI 템플릿 생성 실패"
    throw new Error(err)
  }

  const outputText = extractOpenAIText(data)
  if (!outputText) throw new Error("OpenAI 응답 텍스트가 비어있습니다.")
  return outputText
}

async function generateWithGrok(apiKey: string, prompt: string) {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-fast-non-reasoning",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You output only valid JSON and no extra text." },
        { role: "user", content: `${prompt}\n\n출력 스키마: ${JSON.stringify(OUTPUT_SCHEMA)}` },
      ],
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    const err = data?.error?.message || "Grok 템플릿 생성 실패"
    throw new Error(err)
  }

  const outputText = data?.choices?.[0]?.message?.content
  if (typeof outputText !== "string" || !outputText.trim()) {
    throw new Error("Grok 응답 텍스트가 비어있습니다.")
  }
  return outputText
}

/** 파싱된 스펙을 core의 단일 template builder로 조립하고 File로 감싼다. */
async function assembleFile(spec: TemplateGenerationJson, templateName: string) {
  const built = await coreBuildTemplateFromSpec({ spec, templateName })
  const file = new File([built.content as BlobPart], built.filename, { type: DOCX_MIME })
  return { file, spec: built.spec }
}

export async function generateTemplateDocx(input: GenerateTemplateInput) {
  const prompt = buildPrompt(input.userRequest, input.templateName)
  const rawText =
    input.provider === "openai"
      ? await generateWithOpenAI(input.apiKey, prompt)
      : await generateWithGrok(input.apiKey, prompt)

  const parsed = parseGenerationJson(rawText)
  const templateName = input.templateName || parsed.fileName || `ai-template-${Date.now()}.docx`

  return assembleFile(parsed, templateName)
}

/**
 * 이미 호출자(예: 이미 LLM인 에이전트)가 직접 결정한 TemplateGenerationJson 스펙을
 * 그대로 docx로 조립한다. AI 호출이 전혀 없다 — filldoc은 순수 문서 조립기 역할만 한다.
 */
export async function buildTemplateFromSpec(spec: TemplateGenerationJson, templateName?: string) {
  const name = templateName || spec.fileName || `template-${Date.now()}.docx`
  return assembleFile(spec, name)
}

type GenerateTemplateFromSampleInput = {
  provider: TemplateAIProvider
  apiKey: string
  sourceText: string
  templateName?: string
}

/**
 * 자연어 요청 대신, 실제로 작성 완료된 예시 문서의 텍스트를 분석해서
 * 재사용 가능한 템플릿을 생성한다. generateTemplateDocx와 파이프라인은 동일하고
 * 프롬프트만 buildAnalyzePrompt로 바뀐다.
 */
export async function generateTemplateFromSample(input: GenerateTemplateFromSampleInput) {
  const prompt = buildAnalyzePrompt(input.sourceText, input.templateName)
  const rawText =
    input.provider === "openai"
      ? await generateWithOpenAI(input.apiKey, prompt)
      : await generateWithGrok(input.apiKey, prompt)

  const parsed = parseGenerationJson(rawText)
  const templateName = input.templateName || parsed.fileName || `sample-template-${Date.now()}.docx`

  return assembleFile(parsed, templateName)
}
