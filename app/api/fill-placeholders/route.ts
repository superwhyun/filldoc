import { type NextRequest, NextResponse } from "next/server"
import {
  fillPlaceholders,
  FillPlaceholdersInputError,
  classifyFillError,
  type FillProvider,
} from "@/lib/server/fill-placeholders"
import { MissingProviderCredentialError, resolveProviderCredential } from "@/lib/server/resolve-provider-credential"

export async function POST(req: NextRequest) {
  let provider: FillProvider = "openai"

  try {
    const { dataContent, placeholders, provider: requestProvider, apiKey: requestApiKey } = await req.json()
    provider = requestProvider === "grok" ? "grok" : "openai"

    const apiKey = resolveProviderCredential({ provider, requestApiKey })

    const result = await fillPlaceholders({ dataContent, placeholders, provider, apiKey })

    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof MissingProviderCredentialError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (error instanceof FillPlaceholdersInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    const { message, status } = classifyFillError(error, provider)
    return NextResponse.json({ error: message }, { status })
  }
}
