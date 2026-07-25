import { type NextRequest, NextResponse } from "next/server"
import { generateDocument } from "@/lib/server/generate-document"

export async function POST(req: NextRequest) {
  try {
    const { templateContent, placeholders } = await req.json()

    const buffer = Buffer.from(templateContent)
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
    const errorMessage = error?.properties?.explanation || error?.message || "Failed to generate document"

    return NextResponse.json({
      error: errorMessage,
      details: error?.properties || {}
    }, { status: 500 })
  }
}
