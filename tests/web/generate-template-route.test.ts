import { NextRequest } from "next/server"
import { afterEach, describe, expect, it } from "vitest"

import { POST } from "../../app/api/generate-template/route.ts"

const originalOpenAiKey = process.env.OPENAI_API_KEY

afterEach(() => {
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = originalOpenAiKey
})

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/generate-template", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("POST /api/generate-template (validation, no network)", () => {
  it("returns 400 when userRequest is missing", async () => {
    const response = await POST(postRequest({ provider: "openai" }))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain("userRequest")
  })

  it("returns 401 when no BYOK apiKey and no server env key are available", async () => {
    delete process.env.OPENAI_API_KEY

    const response = await POST(postRequest({ userRequest: "회의록 템플릿 만들어줘", provider: "openai" }))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toContain("API 키가 없습니다")
  })
})
