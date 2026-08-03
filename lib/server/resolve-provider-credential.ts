export type ProviderCredentialInput = {
  provider: "openai" | "grok"
  requestApiKey?: string
}

/** BYOK(요청 apiKey) > 서버 환경변수 순으로 provider credential을 정한다. */
export class MissingProviderCredentialError extends Error {}

export function resolveProviderCredential({ provider, requestApiKey }: ProviderCredentialInput): string {
  if (requestApiKey) return requestApiKey

  const envKey = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.XAI_API_KEY
  if (envKey) return envKey

  const envName = provider === "openai" ? "OPENAI_API_KEY" : "XAI_API_KEY"
  throw new MissingProviderCredentialError(
    `API 키가 없습니다. 요청에 apiKey를 포함하거나 서버에 ${envName} 환경변수를 설정하세요.`,
  )
}
