import { type NextRequest, NextResponse } from "next/server"
import { extractPlaceholders } from "@/lib/server/extract-placeholders"
import { assertUploadSize, UploadTooLargeError } from "@/lib/server/upload-limits"

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json()
    assertUploadSize(content)
    const buffer = Buffer.from(content)

    const result = extractPlaceholders(buffer)

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          validations: result.validations,
          warnings: result.warnings,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      placeholders: result.placeholders,
      warnings: result.warnings,
    })
  } catch (error: any) {
    if (error instanceof UploadTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 413 })
    }

    // 더 상세한 에러 메시지 제공
    const errorMessage = error?.properties?.explanation || error?.message || "Failed to extract placeholders"

    return NextResponse.json({
      error: errorMessage,
      details: error?.properties || {}
    }, { status: 500 })
  }
}
