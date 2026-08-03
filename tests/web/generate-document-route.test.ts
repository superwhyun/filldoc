import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { POST } from "../../app/api/generate-document/route.ts"
import { createDocx } from "../document-core/fixtures.ts"

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/generate-document", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

describe("POST /api/generate-document (web adapter regression)", () => {
  it("streams a rendered DOCX when data satisfies every placeholder", async () => {
    const template = await createDocx(["{{title}}"])

    const response = await POST(postRequest({ templateContent: Array.from(template), placeholders: { title: "T" } }))

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect(bytes.length).toBeGreaterThan(0)
  })

  it("returns 400 with the missing keys when render data is incomplete and allowPartial is not set", async () => {
    const template = await createDocx(["{{title}}", "{{subtitle}}"])

    const response = await POST(postRequest({ templateContent: Array.from(template), placeholders: { title: "T" } }))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.missing).toEqual([{ key: "subtitle" }])
  })

  it("renders with a blank value when allowPartial is true despite missing data", async () => {
    const template = await createDocx(["{{title}}", "{{subtitle}}"])

    const response = await POST(
      postRequest({ templateContent: Array.from(template), placeholders: { title: "T" }, allowPartial: true }),
    )

    expect(response.status).toBe(200)
  })

  it("returns 413 when templateContent exceeds the upload size limit", async () => {
    const oversized = new Array(20 * 1024 * 1024 + 1)

    const response = await POST(postRequest({ templateContent: oversized, placeholders: {} }))

    expect(response.status).toBe(413)
  })
})
