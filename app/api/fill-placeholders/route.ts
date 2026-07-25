import { type NextRequest, NextResponse } from "next/server"
import {
  fillPlaceholders,
  FillPlaceholdersInputError,
  classifyFillError,
  type FillProvider,
} from "@/lib/server/fill-placeholders"

export async function POST(req: NextRequest) {
  let provider: FillProvider = "openai"

  try {
    const { dataContent, placeholders, provider: requestProvider, apiKey } = await req.json()
    provider = requestProvider === "grok" ? "grok" : "openai"

    const result = await fillPlaceholders({ dataContent, placeholders, provider, apiKey })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof FillPlaceholdersInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    const { message, status } = classifyFillError(error, provider)
    return NextResponse.json({ error: message }, { status })
  }
}
