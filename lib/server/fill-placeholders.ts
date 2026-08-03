import OpenAI, { toFile } from "openai"
import { createXai } from "@ai-sdk/xai"
import { streamText } from "ai"

export type FillProvider = "openai" | "grok"

export type PlaceholderInput = { key: string; description?: string; isLoop?: boolean; fields?: string[] }

export type FileSearchEvidence = {
  toolCallId: string
  queries: string[]
  fileId: string | null
  filename: string | null
  score: number | null
  text: string
}

type DeleteRetryResult = {
  ok: boolean
  attempts: number
  error?: string
}

export type ProcessingMeta = {
  provider: FillProvider
  usedFileSearch: boolean
  usedFallback: boolean
  fallbackReason?: string
  parsingMode: "structured_json_schema" | "json_extractor"
  cleanup?: {
    vectorStoreDeleted: boolean
    vectorStoreDeleteAttempts: number
    uploadedFileDeleted: boolean
    uploadedFileDeleteAttempts: number
  }
}

export type FillPlaceholdersInput = {
  dataContent: string
  placeholders: PlaceholderInput[]
  provider: FillProvider
  apiKey: string
}

export type FillPlaceholdersOutput = {
  filledPlaceholders: Array<{
    key: string
    value: any
    description?: string
    isLoop?: boolean
    fields?: string[]
  }>
  evidence?: FileSearchEvidence[]
  processing: ProcessingMeta
  /** 근거 자료에 없어 AI가 값을 지어내지 않고 비워둔 필드 목록 (없으면 undefined). */
  unresolvedKeys?: string[]
}

/** 요청 형식 오류(400 상당)를 표현한다. 실제 AI 호출 실패와 구분하기 위한 타입. */
export class FillPlaceholdersInputError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = "FillPlaceholdersInputError"
    this.status = status
  }
}

const JSON_EXAMPLE = {
  company: "Acme Corp",
  tasks: [
    { no: "1", name: "Design", owner: "John" },
    { no: "2", name: "Build", owner: "Sarah" },
  ],
}

/** AI가 근거 없이 값을 지어내는 대신 출력하도록 지시하는 표시값. */
const UNKNOWN_SENTINEL = "__UNKNOWN__"

/**
 * normalizedData를 순회하며 UNKNOWN_SENTINEL 값을 빈 문자열로 치환하고,
 * 어떤 key(및 loop 필드)가 미해결이었는지 목록으로 돌려준다.
 */
function collectAndClearUnresolved(
  placeholderList: PlaceholderInput[],
  normalizedData: Record<string, any>,
): string[] {
  const unresolved: string[] = []

  for (const p of placeholderList) {
    if (p.isLoop) {
      const items = Array.isArray(normalizedData[p.key]) ? normalizedData[p.key] : []
      items.forEach((item: any, idx: number) => {
        if (!item || typeof item !== "object") return
        for (const field of p.fields ?? []) {
          if (item[field] === UNKNOWN_SENTINEL) {
            unresolved.push(`${p.key}[${idx}].${field}`)
            item[field] = ""
          }
        }
      })
    } else if (normalizedData[p.key] === UNKNOWN_SENTINEL) {
      unresolved.push(p.key)
      normalizedData[p.key] = ""
    }
  }

  return unresolved
}

function buildPlaceholderDescriptions(placeholderList: PlaceholderInput[]) {
  return placeholderList
    .map((p) => {
      if (p.isLoop) {
        const fieldsStr = p.fields && p.fields.length > 0 ? ` (Fields: ${p.fields.join(", ")})` : ""
        const prefix = `- {{#${p.key}}} [ARRAY/LIST]${fieldsStr}`
        return p.description ? `${prefix} : ${p.description}` : prefix
      }

      const prefix = `- {{${p.key}}}`
      return p.description ? `${prefix} : ${p.description}` : prefix
    })
    .join("\n")
}

function buildPrompt({
  placeholderDescriptions,
  dataContent,
  withInlineContent,
}: {
  placeholderDescriptions: string
  dataContent?: string
  withInlineContent: boolean
}) {
  const dataSection = withInlineContent
    ? `\nHere is the data content:\n${dataContent ?? ""}\n`
    : "\nUse file_search tool results as the source of truth for filling placeholders.\n"

  return `You are a document filling assistant. I have a document with the following placeholders that need to be filled:

${placeholderDescriptions}
${dataSection}
IMPORTANT: Analyze ALL source data provided above. If multiple files are present (separated by tags), ensure information from all of them is considered.

Follow these instructions carefully for each placeholder:
1. If a description is provided (after the colon), follow it strictly.
2. Provide appropriate values based on the evidence in the source data.
3. If the source data does NOT contain any evidence for a placeholder (or a loop item's field), do NOT guess or invent a value. Output exactly the literal string "${UNKNOWN_SENTINEL}" for that value instead.
4. Return ONLY a JSON object with placeholder names as keys and their values.

- For normal placeholders, provide STRING values.
- For [ARRAY/LIST] placeholders, provide a JSON ARRAY of objects. Each object should contain the requested "Fields" if they were specified.
- Do not include any other text or explanation.

Example format:
${JSON.stringify(JSON_EXAMPLE, null, 2)}`
}

function buildStructuredOutputSchema(placeholderList: PlaceholderInput[]) {
  const properties: Record<string, unknown> = {}
  for (const p of placeholderList) {
    if (p.isLoop) {
      const fields = p.fields ?? []
      if (fields.length === 0) {
        throw new Error(`Strict schema 생성 실패: 루프 "${p.key}" 필드가 비어있습니다.`)
      }

      const itemProperties = Object.fromEntries(fields.map((field) => [field, { type: "string" }]))
      properties[p.key] = {
        type: "array",
        items: {
          type: "object",
          properties: itemProperties,
          required: fields,
          additionalProperties: false,
        },
      }
    } else {
      properties[p.key] = { type: "string" }
    }
  }

  return {
    type: "object",
    properties,
    required: placeholderList.map((p) => p.key),
    additionalProperties: false,
  } as const
}

function extractFileSearchEvidence(response: OpenAI.Responses.Response): FileSearchEvidence[] {
  const evidence: FileSearchEvidence[] = []
  for (const item of response.output) {
    if (item.type !== "file_search_call") continue

    for (const result of item.results ?? []) {
      if (!result.text) continue
      evidence.push({
        toolCallId: item.id,
        queries: item.queries ?? [],
        fileId: result.file_id ?? null,
        filename: result.filename ?? null,
        score: typeof result.score === "number" ? result.score : null,
        text: result.text,
      })
    }
  }
  return evidence
}

function extractJsonObject(text: string) {
  const trimmed = text.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    // Ignore and try object boundary extraction below.
  }

  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === "\\") {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === "{") {
      if (start === -1) start = i
      depth += 1
      continue
    }

    if (ch === "}") {
      depth -= 1
      if (depth === 0 && start !== -1) {
        const candidate = trimmed.slice(start, i + 1)
        return JSON.parse(candidate)
      }
    }
  }

  throw new Error("Failed to parse AI response as JSON")
}

function normalizeFilledData(filledData: Record<string, any>) {
  const normalizedData: Record<string, any> = {}
  for (const [key, value] of Object.entries(filledData)) {
    const normalizedKey = key.replace(/^\{\{|\}\}$|^\#|\/$/g, "")
    normalizedData[normalizedKey] = value
  }
  return normalizedData
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function retryWithBackoff(action: () => Promise<void>, label: string): Promise<DeleteRetryResult> {
  const delays = [0, 300, 900]

  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) {
      await sleep(delays[i])
    }

    try {
      await action()
      return { ok: true, attempts: i + 1 }
    } catch (error: any) {
      if (i === delays.length - 1) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[v0] ${label} cleanup 실패:`, error)
        return { ok: false, attempts: i + 1, error: errorMessage }
      }
    }
  }

  return { ok: false, attempts: delays.length, error: "Unknown cleanup error" }
}

/**
 * 데이터 텍스트와 placeholder 목록을 받아 OpenAI(file_search 우선) 또는 Grok으로
 * placeholder 값을 채운다. 요청 형식 오류는 FillPlaceholdersInputError로 던지고,
 * 그 외 실패는 원본 에러를 그대로 던진다 (classifyFillError로 후처리 가능).
 */
export async function fillPlaceholders({
  dataContent,
  placeholders,
  provider,
  apiKey,
}: FillPlaceholdersInput): Promise<FillPlaceholdersOutput> {
  if (!apiKey) {
    throw new FillPlaceholdersInputError(
      `Please configure your ${provider === "openai" ? "OpenAI" : "Grok"} API key in settings`,
    )
  }
  if (typeof dataContent !== "string" || dataContent.trim().length === 0) {
    throw new FillPlaceholdersInputError(
      "데이터 파일 내용이 비어있습니다. 최소 1개 이상의 유효한 파일을 업로드해주세요.",
    )
  }
  if (!Array.isArray(placeholders)) {
    throw new FillPlaceholdersInputError("플레이스홀더 형식이 올바르지 않습니다.")
  }

  let model
  let openaiClient: OpenAI | null = null
  if (provider === "openai") {
    openaiClient = new OpenAI({ apiKey })
  } else {
    const xai = createXai({ apiKey })
    model = xai("grok-4-fast-non-reasoning")
  }

  const placeholderList = placeholders
  const placeholderDescriptions = buildPlaceholderDescriptions(placeholderList)
  const outputSchema = buildStructuredOutputSchema(placeholderList)

  let fullText = ""
  let evidence: FileSearchEvidence[] = []
  const processing: ProcessingMeta = {
    provider,
    usedFileSearch: false,
    usedFallback: false,
    parsingMode: provider === "openai" ? "structured_json_schema" : "json_extractor",
  }

  if (openaiClient) {
    const INLINE_THRESHOLD = 15000
    const isSmallData = dataContent.length <= INLINE_THRESHOLD

    if (isSmallData) {
      console.log(`[v0] 데이터량이 작아(${dataContent.length}자) 직접 프롬프트 방식을 사용합니다.`)
      const prompt = buildPrompt({
        placeholderDescriptions,
        dataContent,
        withInlineContent: true,
      })

      const result = await openaiClient.responses.create({
        model: "gpt-5.2",
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "filled_placeholders_inline",
            strict: true,
            schema: outputSchema,
          },
        },
        reasoning: { effort: "medium" },
        max_output_tokens: 16000,
      })
      fullText = result.output_text
      processing.usedFileSearch = false
    } else {
      console.log(`[v0] 데이터량이 커서(${dataContent.length}자) file_search 방식을 사용합니다.`)
      const prompt = buildPrompt({ placeholderDescriptions, withInlineContent: false })
      let uploadedFileId: string | null = null
      let vectorStoreId: string | null = null

      try {
        const file = await toFile(Buffer.from(dataContent, "utf-8"), `filldoc-${Date.now()}.txt`, {
          type: "text/plain",
        })

        const uploaded = await openaiClient.files.create({
          file,
          purpose: "assistants",
        })
        uploadedFileId = uploaded.id

        const vectorStore = await openaiClient.vectorStores.create({
          name: `filldoc-${Date.now()}`,
          expires_after: { anchor: "last_active_at", days: 1 },
        })
        vectorStoreId = vectorStore.id

        await openaiClient.vectorStores.fileBatches.createAndPoll(vectorStoreId, {
          file_ids: [uploadedFileId],
        })

        const result = await openaiClient.responses.create({
          model: "gpt-5.2",
          input: prompt,
          include: ["file_search_call.results"],
          text: {
            format: {
              type: "json_schema",
              name: "filled_placeholders",
              strict: true,
              schema: outputSchema,
            },
          },
          tools: [
            {
              type: "file_search",
              vector_store_ids: [vectorStoreId],
              max_num_results: 20,
            },
          ],
          tool_choice: "required",
          reasoning: { effort: "medium" },
          max_output_tokens: 16000,
        })
        fullText = result.output_text
        evidence = extractFileSearchEvidence(result)
        processing.usedFileSearch = true
      } catch (fileSearchError: any) {
        processing.usedFallback = true
        processing.fallbackReason = fileSearchError?.message || "file_search_failed"
        console.error("[v0] file_search 실패, inline prompt fallback 실행:", fileSearchError)

        const fallbackPrompt = buildPrompt({
          placeholderDescriptions,
          dataContent,
          withInlineContent: true,
        })

        const fallbackResult = await openaiClient.responses.create({
          model: "gpt-5.2",
          input: fallbackPrompt,
          text: {
            format: {
              type: "json_schema",
              name: "filled_placeholders_fallback",
              strict: true,
              schema: outputSchema,
            },
          },
          reasoning: { effort: "medium" },
          max_output_tokens: 16000,
        })
        fullText = fallbackResult.output_text
      } finally {
        const vectorStoreCleanup = vectorStoreId
          ? await retryWithBackoff(
              () => openaiClient!.vectorStores.del(vectorStoreId as string).then(() => undefined),
              "vector store",
            )
          : { ok: true, attempts: 0 }

        const uploadedFileCleanup = uploadedFileId
          ? await retryWithBackoff(
              () => openaiClient!.files.del(uploadedFileId as string).then(() => undefined),
              "uploaded file",
            )
          : { ok: true, attempts: 0 }

        processing.cleanup = {
          vectorStoreDeleted: vectorStoreCleanup.ok,
          vectorStoreDeleteAttempts: vectorStoreCleanup.attempts,
          uploadedFileDeleted: uploadedFileCleanup.ok,
          uploadedFileDeleteAttempts: uploadedFileCleanup.attempts,
        }
      }
    }
  } else {
    const prompt = buildPrompt({
      placeholderDescriptions,
      dataContent,
      withInlineContent: true,
    })
    const result = await streamText({
      model: model as any,
      prompt,
      temperature: 0.7,
    })

    for await (const textPart of result.textStream) {
      fullText += textPart
    }
  }

  const filledData = extractJsonObject(fullText) as Record<string, any>
  const normalizedData = normalizeFilledData(filledData)
  const unresolvedKeys = collectAndClearUnresolved(placeholderList, normalizedData)

  const filledPlaceholders = placeholderList.map((p) => {
    const value = normalizedData[p.key]
    return {
      key: p.key,
      value: value ?? (p.isLoop ? [] : ""),
      ...(p.description && { description: p.description }),
      ...(p.isLoop && { isLoop: true, fields: p.fields }),
    }
  })

  return {
    filledPlaceholders,
    evidence: evidence.length > 0 ? evidence : undefined,
    processing,
    unresolvedKeys: unresolvedKeys.length > 0 ? unresolvedKeys : undefined,
  }
}

/**
 * fillPlaceholders에서 던져진 (FillPlaceholdersInputError가 아닌) 에러를
 * 사용자 메시지 + HTTP status로 정규화한다.
 */
export function classifyFillError(error: any, provider: FillProvider): { message: string; status: number } {
  if (error?.responseBody?.includes("Incorrect API key") || error?.responseBody?.includes("invalid_api_key")) {
    return {
      message: `API 키가 올바르지 않습니다. Settings에서 ${provider === "openai" ? "OpenAI" : "Grok"} API 키를 확인해주세요.`,
      status: 401,
    }
  }

  let errorMessage = "Failed to fill placeholders"
  if (error instanceof Error) {
    errorMessage = error.message
  } else if (error?.responseBody) {
    try {
      const errorData = JSON.parse(error.responseBody)
      errorMessage = errorData.error || errorData.message || errorMessage
    } catch {
      errorMessage = error.responseBody
    }
  }

  return { message: errorMessage, status: error?.statusCode || 500 }
}
