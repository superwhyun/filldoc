import { type NextRequest, NextResponse } from "next/server"
import { generateDocument } from "@/lib/server/generate-document"
import { extractPlaceholders } from "@/lib/server/extract-placeholders"
import { validateRenderData } from "@/lib/server/validate-render-data"
import { assertUploadSize, UploadTooLargeError } from "@/lib/server/upload-limits"

export async function POST(req: NextRequest) {
  try {
    const { templateContent, placeholders, allowPartial } = await req.json()

    assertUploadSize(templateContent)
    const buffer = Buffer.from(templateContent)

    const inspection = extractPlaceholders(buffer)
    if (inspection.ok) {
      const { missing } = validateRenderData({ inspection, data: placeholders, allowPartial: Boolean(allowPartial) })

      if (missing.length > 0 && !allowPartial) {
        return NextResponse.json(
          {
            error: "템플릿에 필요한 값이 데이터에 없습니다.",
            missing,
          },
          { status: 400 }
        )
      }
    }

    const output = generateDocument(buffer, placeholders)

    // Buffer를 Uint8Array로 변환하여 NextResponse에 전달
    const responseBody = new Uint8Array(output)

    return new NextResponse(responseBody, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="filled-document.docx"',
      },
    })
  } catch (error: any) {
    if (error instanceof UploadTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 })
    }

    const errorMessage = error?.properties?.explanation || error?.message || "Failed to generate document"

    return NextResponse.json({
      error: errorMessage,
      details: error?.properties || {}
    }, { status: 500 })
  }
}
