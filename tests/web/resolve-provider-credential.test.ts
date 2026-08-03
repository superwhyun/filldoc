import { afterEach, describe, expect, it } from "vitest"

import { MissingProviderCredentialError, resolveProviderCredential } from "../../lib/server/resolve-provider-credential.ts"

const originalOpenAiKey = process.env.OPENAI_API_KEY
const originalXaiKey = process.env.XAI_API_KEY

afterEach(() => {
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = originalOpenAiKey
  if (originalXaiKey === undefined) delete process.env.XAI_API_KEY
  else process.env.XAI_API_KEY = originalXaiKey
})

describe("resolveProviderCredential", () => {
  it("prefers the request-supplied (BYOK) key over the server env var", () => {
    process.env.OPENAI_API_KEY = "env-key"

    const resolved = resolveProviderCredential({ provider: "openai", requestApiKey: "byok-key" })

    expect(resolved).toBe("byok-key")
  })

  it("falls back to the server env var when no BYOK key is supplied", () => {
    process.env.OPENAI_API_KEY = "env-key"

    const resolved = resolveProviderCredential({ provider: "openai" })

    expect(resolved).toBe("env-key")
  })

  it("uses XAI_API_KEY for the grok provider", () => {
    process.env.XAI_API_KEY = "grok-env-key"

    const resolved = resolveProviderCredential({ provider: "grok" })

    expect(resolved).toBe("grok-env-key")
  })

  it("throws MissingProviderCredentialError when neither BYOK nor env key is available", () => {
    delete process.env.OPENAI_API_KEY

    expect(() => resolveProviderCredential({ provider: "openai" })).toThrow(MissingProviderCredentialError)
  })
})
