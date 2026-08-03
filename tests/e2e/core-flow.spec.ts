import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "@playwright/test"

import { extractDocumentText } from "../../packages/core/src/index.ts"
import { createDocx } from "../document-core/fixtures.ts"

let templatePath: string

test.beforeAll(async () => {
  const template = await createDocx(["{{title}}", "Author: {{author}}"])
  const dir = mkdtempSync(join(tmpdir(), "filldoc-e2e-"))
  templatePath = join(dir, "template.docx")
  writeFileSync(templatePath, template)
})

test("template upload → placeholders → manual data entry → generate → download (no AI)", async ({ page }) => {
  await page.goto("/")

  // 1) 템플릿 업로드
  await page.setInputFiles("#template-upload", templatePath)
  await expect(page.getByText("Detected Placeholders")).toBeVisible()
  await expect(page.getByText("{title}", { exact: false })).toBeVisible()
  await expect(page.getByText("{author}", { exact: false })).toBeVisible()

  // 2) placeholder 확인 후 데이터 업로드 단계로
  await page.getByRole("button", { name: "Continue to Data Upload" }).click()
  await expect(page.getByText("Upload Data Files")).toBeVisible()

  // 3) AI 없이 수동 입력으로 스킵
  await page.getByRole("button", { name: "수동으로 입력하기" }).click()
  await expect(page.getByText("내용 편집")).toBeVisible()

  // 4) 각 placeholder 값 입력
  const textareas = page.locator("textarea")
  await textareas.nth(0).fill("Weekly Report")
  await textareas.nth(1).fill("Ada Lovelace")

  // 5) 문서 생성 → "Document Ready!" 화면 → 실제 다운로드 링크 클릭
  await page.getByRole("button", { name: "문서 생성하기" }).click()
  await expect(page.getByText("Document Ready!")).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("link", { name: "Download Document" }).click()
  const download = await downloadPromise

  const downloadedPath = join(mkdtempSync(join(tmpdir(), "filldoc-e2e-download-")), "filled.docx")
  await download.saveAs(downloadedPath)

  // 6) core로 다시 읽어 값이 실제로 렌더링됐는지 확인 (CLI/core 결과와 동등성)
  const bytes = readFileSync(downloadedPath)
  const text = await extractDocumentText(bytes, "filled.docx")
  expect(text).toContain("Weekly Report")
  expect(text).toContain("Ada Lovelace")
})

test("validation error: missing render data is surfaced without crashing (allowPartial UI behavior)", async ({ page }) => {
  await page.goto("/")

  await page.setInputFiles("#template-upload", templatePath)
  await page.getByRole("button", { name: "Continue to Data Upload" }).click()
  await page.getByRole("button", { name: "수동으로 입력하기" }).click()

  // title만 채우고 author는 비워둔 채 생성 — UI는 allowPartial:true로 보내므로 에러 없이 완료돼야 한다
  await page.locator("textarea").nth(0).fill("Only Title")

  await page.getByRole("button", { name: "문서 생성하기" }).click()
  await expect(page.getByText("Document Ready!")).toBeVisible()
})
