import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "@playwright/test"

import { extractDocumentText } from "../../packages/core/src/index.ts"
import { createDocx } from "../document-core/fixtures.ts"

/**
 * lib/server/fill-placeholders.ts는 실제 OpenAI file_search/vector store
 * 오케스트레이션을 수행해 신뢰성 있게 재현하기 어렵다 — 대신 브라우저의
 * fetch("/api/fill-placeholders") 호출을 page.route()로 가로채는 fake
 * provider를 쓴다. web-adapter 경계(요청 조립·응답 반영·에러 처리)는 실제로
 * 검증되고, provider 내부 로직은 core/CLI 밖의 legacy adapter 책임으로 남는다
 * (Phase 2 baseline과 동일한 스코프 결정).
 */

let templatePath: string
let dataPath: string

test.beforeAll(async () => {
  const template = await createDocx(["{{title}}", "Author: {{author}}"])
  const dir = mkdtempSync(join(tmpdir(), "repgen-e2e-fake-provider-"))
  templatePath = join(dir, "template.docx")
  writeFileSync(templatePath, template)

  dataPath = join(dir, "notes.txt")
  writeFileSync(dataPath, "제목은 Weekly Report이고 작성자는 Ada Lovelace입니다.", "utf-8")
})

async function setByokKey(page: import("@playwright/test").Page, key: string) {
  await page.getByRole("button", { name: "Settings" }).click()
  await page.getByLabel("OpenAI API Key").fill(key)
  await page.getByRole("button", { name: "저장" }).click()
}

test("fake provider happy path: BYOK key is forwarded and AI-filled values flow through to download", async ({ page }) => {
  const byokKey = "sk-test-fake-key"
  let capturedRequestBody: any = null
  let generateDocumentBody: any = null

  await page.route("**/api/generate-document", async (route) => {
    generateDocumentBody = route.request().postDataJSON()
    await route.continue()
  })

  await page.route("**/api/fill-placeholders", async (route) => {
    capturedRequestBody = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        filledPlaceholders: [
          { key: "title", value: "AI Generated Title" },
          { key: "author", value: "AI Author" },
        ],
        evidence: [],
        processing: { provider: "openai", usedFileSearch: false, usedFallback: false, parsingMode: "structured_json_schema" },
      }),
    })
  })

  await page.goto("/")
  await setByokKey(page, byokKey)

  await page.setInputFiles("#template-upload", templatePath)
  await page.getByRole("button", { name: "Continue to Data Upload" }).click()

  await page.setInputFiles("#data-upload", dataPath)
  await expect(page.getByText("notes.txt")).toBeVisible()

  await page.getByRole("button", { name: /AI로 자동 채우기/ }).click()
  await expect(page.getByText("내용 편집")).toBeVisible()

  // 가짜 provider가 돌려준 값이 실제로 편집 화면에 반영됐는지 확인
  await expect(page.locator("textarea").nth(0)).toHaveValue("AI Generated Title")
  await expect(page.locator("textarea").nth(1)).toHaveValue("AI Author")

  // BYOK 요청 검증: 설정에서 저장한 키가 그대로, provider도 올바르게 전달됨
  expect(capturedRequestBody.apiKey).toBe(byokKey)
  expect(capturedRequestBody.provider).toBe("openai")

  await page.getByRole("button", { name: "문서 생성하기" }).click()
  await expect(page.getByText("Document Ready!")).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("link", { name: "Download Document" }).click()
  const download = await downloadPromise

  // BYOK 키가 adapter 경계(fill-placeholders)를 넘어 generate-document로는 전달되지 않는지 확인
  expect(generateDocumentBody).not.toBeNull()
  expect(generateDocumentBody.apiKey).toBeUndefined()
  expect(JSON.stringify(generateDocumentBody)).not.toContain(byokKey)

  const downloadedPath = join(mkdtempSync(join(tmpdir(), "repgen-e2e-fake-provider-dl-")), "filled.docx")
  await download.saveAs(downloadedPath)
  const text = await extractDocumentText(readFileSync(downloadedPath), "filled.docx")
  expect(text).toContain("AI Generated Title")
  expect(text).toContain("AI Author")
})

test("provider failure path: 401 from /api/fill-placeholders surfaces as a user-facing error, no crash", async ({ page }) => {
  await page.route("**/api/fill-placeholders", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "API 키가 없습니다. 요청에 apiKey를 포함하거나 서버에 OPENAI_API_KEY 환경변수를 설정하세요." }),
    })
  })

  await page.goto("/")

  await page.setInputFiles("#template-upload", templatePath)
  await page.getByRole("button", { name: "Continue to Data Upload" }).click()
  await page.setInputFiles("#data-upload", dataPath)

  const dialogPromise = page.waitForEvent("dialog")
  await page.getByRole("button", { name: /AI로 자동 채우기/ }).click()
  const dialog = await dialogPromise

  expect(dialog.message()).toContain("API 키가 없습니다")
  await dialog.dismiss()

  // 실패 후에도 데이터 업로드 화면에 그대로 남아있어야 한다(크래시/빈 화면 아님)
  await expect(page.getByText("Upload Data Files")).toBeVisible()
})
