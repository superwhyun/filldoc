import { NextRequest } from "next/server"
import { afterEach, describe, expect, it } from "vitest"

import { POST } from "../../app/api/fill-placeholders/route.ts"

const originalOpenAiKey = process.env.OPENAI_API_KEY

afterEach(() => {
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = originalOpenAiKey
})

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/fill-placeholders", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("POST /api/fill-placeholders (credential resolution, no network)", () => {
  it("returns 401 when no BYOK apiKey and no server env key are available", async () => {
    delete process.env.OPENAI_API_KEY

    const response = await POST(postRequest({ dataContent: "text", placeholders: [{ key: "title" }], provider: "openai" }))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toContain("API 키가 없습니다")
  })
})
