/**
 * BYOK 설정의 단일 저장/조회 지점. 이전엔 settings-dialog.tsx, template-upload.tsx,
 * data-upload.tsx 세 곳이 각자 localStorage["docfiller-settings"]를 읽고 파싱했다 —
 * 여기로 통합해 중복/불일치를 없앤다.
 *
 * 키가 비어있어도(또는 설정을 아예 안 했어도) 에러를 던지지 않는다 — 서버가
 * OPENAI_API_KEY/XAI_API_KEY env로 fallback할 수 있으므로, 최종 판단은 API
 * 응답(401)에 맡긴다.
 */
export type AIProvider = "openai" | "grok"

export type DocfillerSettings = {
  openaiApiKey: string
  grokApiKey: string
  defaultProvider: AIProvider
}

const STORAGE_KEY = "docfiller-settings"

export const DEFAULT_SETTINGS: DocfillerSettings = {
  openaiApiKey: "",
  grokApiKey: "",
  defaultProvider: "openai",
}

export function loadDocfillerSettings(): DocfillerSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return DEFAULT_SETTINGS
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveDocfillerSettings(settings: DocfillerSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

/** provider에 해당하는 BYOK 키. 없으면 undefined(서버가 env로 fallback하도록 요청에서 생략). */
export function getProviderApiKey(settings: DocfillerSettings, provider: AIProvider): string | undefined {
  const key = provider === "openai" ? settings.openaiApiKey : settings.grokApiKey
  return key ? key : undefined
}
