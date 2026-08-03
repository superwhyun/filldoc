import { type NextRequest, NextResponse } from "next/server"
import { generateTemplateDocx, type TemplateAIProvider } from "@/lib/client-template-generator"
import { MissingProviderCredentialError, resolveProviderCredential } from "@/lib/server/resolve-provider-credential"

/**
 * 사용자 요구사항(자연어)을 AI로 분석해 새 템플릿 docx를 생성한다.
 * 이전에는 브라우저가 api.openai.com/api.x.ai에 직접 fetch했다 —
 * 이 라우트로 옮겨서 API 키가 브라우저 네트워크 요청에 노출되지 않게 한다.
 */
export async function POST(req: NextRequest) {
  let provider: TemplateAIProvider = "openai"

  try {
    const { userRequest, provider: requestProvider, apiKey: requestApiKey, templateName } = await req.json()
    provider = requestProvider === "grok" ? "grok" : "openai"

    if (typeof userRequest !== "string" || !userRequest.trim()) {
      return NextResponse.json({ error: "userRequest는 필수입니다." }, { status: 400 })
    }

    const apiKey = resolveProviderCredential({ provider, requestApiKey })

    const { file } = await generateTemplateDocx({
      provider,
      apiKey,
      userRequest,
      templateName: typeof templateName === "string" && templateName.trim() ? templateName : undefined,
    })

    const buffer = Buffer.from(await file.arrayBuffer())

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`,
      },
    })
  } catch (error: any) {
    if (error instanceof MissingProviderCredentialError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    const errorMessage = error?.message || "템플릿 생성 중 알 수 없는 오류가 발생했습니다"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
