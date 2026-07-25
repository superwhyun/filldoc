import { type NextRequest, NextResponse } from "next/server"
import { extractTextFromBuffer, ExtractTextError } from "@/lib/server/extract-text"

export async function POST(req: NextRequest) {
  try {
    const { content, filename } = await req.json()

    if (!content || !filename) {
      return NextResponse.json({
        error: "파일 내용 또는 파일명이 누락되었습니다"
      }, { status: 400 })
    }

    const buffer = Buffer.from(content)

    try {
      const text = await extractTextFromBuffer(buffer, filename)
      return NextResponse.json({ text })
    } catch (extractError: any) {
      if (extractError instanceof ExtractTextError) {
        return NextResponse.json({ error: extractError.message }, { status: 400 })
      }
      throw extractError
    }
  } catch (error: any) {
    const errorMessage = error?.message || "텍스트 추출 중 알 수 없는 오류가 발생했습니다"

    return NextResponse.json({
      error: errorMessage,
      details: error?.properties || {}
    }, { status: 500 })
  }
}
