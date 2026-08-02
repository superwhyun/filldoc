---
id: document-core
version: 1.0.0
parent: none
persona: document-core
status: planned
contract_version: 1.0.0
---

# document-core

RepGen의 템플릿 분석, 문서 텍스트 추출, 데이터 검증·렌더링, 원본 서식 보존 템플릿화, 스펙 기반 템플릿 조립을 제공한다. Claude Code·Codex 같은 호출 에이전트와 웹 UI는 이 모듈의 서로 다른 어댑터이며, 이 모듈은 AI 모델이나 HTTP를 호출하지 않는다.

## Contract

### Runtime boundary

- 입력과 출력의 binary 형식은 `Uint8Array`다. Node `Buffer`는 CLI/web 어댑터에서만 변환한다.
- core는 파일 경로, `node:fs`, 환경변수, `process`, HTTP, Next.js, React, `window`, `document`, `File`, `Blob`, `localStorage`, provider SDK, `fetch`를 import하거나 요구하지 않는다.
- `packages/core`는 Node 22+에서 실행되는 순수 문서 엔진이다. DOCX/PDF 라이브러리는 허용하지만 network/provider 의존성은 허용하지 않는다.
- AI provider 호출은 `packages/providers`의 선택적 legacy 기능이다. `repgen-fill-doc` 호환 기능은 core API가 아니다.

### Public types

```ts
export type DocumentBytes = Uint8Array

export type Placeholder = {
  key: string
  description?: string
  isLoop?: boolean
  fields?: string[]
}

export type TemplateInspection =
  | { ok: true; placeholders: Placeholder[]; warnings?: string[] }
  | { ok: false; error: string; validations: string[]; warnings?: string[] }

export type TemplatizeRun = { text: string } | { tab: true }
export type TemplatizeEdit =
  | { type: "replace"; match: string; runs: TemplatizeRun[] }
  | { type: "delete-range"; fromMatch: string; toMatch: string }
  | { type: "insert-paragraph"; anchorMatch: string; position: "before" | "after"; runs: TemplatizeRun[] }

export type TemplateGenerationJson = {
  fileName?: string
  title?: string
  subtitle?: string
  blocks: TemplateBlock[]
}
```

`TemplateBlock`은 기존 `heading | paragraph | bullet_list | table | spacer | repeating_section` union을 유지한다. `repeating_section`의 loop tag는 독립 paragraph로 생성한다.

### Public operations

```ts
export function inspectTemplate(template: DocumentBytes): TemplateInspection

export function validateRenderData(input: {
  inspection: Extract<TemplateInspection, { ok: true }>
  data: Record<string, unknown>
  allowPartial?: boolean
}): { missing: Placeholder[]; warnings: string[] }

export function renderTemplate(input: {
  template: DocumentBytes
  data: Record<string, unknown>
}): DocumentBytes

export function templatizeDocument(input: {
  source: DocumentBytes
  edits: TemplatizeEdit[]
}): DocumentBytes

export async function extractDocumentText(input: {
  content: DocumentBytes
  filename: string
}): Promise<string>

export async function buildTemplateFromSpec(input: {
  spec: TemplateGenerationJson
  templateName?: string
}): Promise<{ content: DocumentBytes; spec: TemplateGenerationJson; filename: string }>
```

`inspectTemplate`은 `{{key}}`, `{{key:description}}`, explicit loop, table dot-loop을 파싱·검증한다. `renderTemplate`은 dot-loop table 전처리와 docxtemplater 렌더링을 수행한다. adapter는 `validateRenderData`로 누락 필드를 확인한 뒤, 기본적으로 렌더링을 중단한다.

### AI-agent JSON contract

기본 agent 흐름은 API 키가 필요 없다.

```text
inspect-template(template.docx) -> { placeholders }
extract-text(source.docx|pdf|txt|md) -> text
agent decides values or edits
render-template({ template, data }) -> filled.docx
templatize-document({ source, edits }) -> template.docx
```

`data`는 JSON object다. 일반 placeholder 값은 문자열이고, `isLoop: true` placeholder 값은 `fields`를 key로 갖는 object 배열이다. 템플릿에 있으나 `data`에 없는 key는 `allowPartial: true`가 아닌 한 adapter가 오류로 처리한다. Agent는 `description`을 작성 지침으로 사용하되, unknown 값을 임의로 채우지 않는다.

### Legacy consumer inventory

| Consumer | Current input | Success contract | Current failure/side effect | Target adapter responsibility |
| --- | --- | --- | --- | --- |
| `repgen-extract-doc` | `--template <.docx>` | stdout `{ placeholders }` | invalid template/parse error → stderr, exit 1 | read path, call `inspectTemplate`, JSON encode |
| `repgen-extract-text` | `--file <.docx|.pdf|.txt|.md>` | stdout text | empty/unsupported/corrupt source → stderr, exit 1 | read path, preserve filename, print text |
| `repgen-render-doc` | `--template`, `--data` or `--data-json`, `--output`, optional `--allow-partial` | writes DOCX, stdout `{ output, filledKeys }` | missing values default stop; partial warns; invalid input → exit 1 | JSON/file loading, missing-data policy, write output |
| `repgen-templatize-doc` | `--source`, `--edits` or `--edits-json`, `--output` | writes DOCX, stdout `{ output, placeholderCount, templateValid }` | unmatched edit/invalid JSON → stderr, exit 1 | JSON/file loading, write output, inspection summary |
| `repgen-build-template` | `--spec` or `--spec-json`, `--output`, optional name | writes DOCX, stdout validation summary | invalid spec/JSON → stderr, exit 1 | spec parsing, write output, inspection summary |
| `repgen-analyze-doc` | source, provider, API key | writes AI-generated DOCX, stdout validation summary | provider/credential failure → exit 1 | legacy provider adapter; not core |
| `repgen-fill-doc` | template, sources, provider, API key | writes AI-filled DOCX, stdout processing summary | provider/credential/source failure → exit 1 | legacy provider adapter; not core |
| `POST /api/extract-placeholders` | JSON `{ content }` | `{ placeholders, warnings? }` | invalid template 400; unexpected 500 | decode bytes, map core result to HTTP |
| `POST /api/extract-text` | JSON `{ content, filename }` | `{ text }` | missing/unsupported source 400; unexpected 500 | decode bytes, map core error to HTTP |
| `POST /api/generate-document` | JSON `{ templateContent, placeholders }` | DOCX attachment response | render failure 500 | decode bytes, call validate/render, stream result |
| `POST /api/fill-placeholders` | JSON `{ dataContent, placeholders, provider, apiKey }` | current fill result JSON | provider/input error status | web-only legacy provider adapter; core is not called with credential |

Existing `generateTemplateDocx` and `generateTemplateFromSample` are web/provider consumers. Their non-AI document assembly portion will become `buildTemplateFromSpec`; their `File`/`Blob` conversion remains outside core.

### Errors

The implementation introduces typed errors with a stable `code` and Korean-safe `message`. Adapters map them to legacy messages/statuses during the migration.

| Code | When raised |
| --- | --- |
| `INVALID_TEMPLATE` | invalid placeholder syntax, broken loop pair, missing loop fields, corrupt template |
| `INVALID_RENDER_DATA` | data is not an object or required key is missing under strict policy |
| `UNSUPPORTED_SOURCE` | source extension is not docx/pdf/txt/md |
| `EMPTY_SOURCE` | source content or extracted text is empty |
| `SOURCE_PARSE_FAILED` | DOCX/PDF cannot be read |
| `TEMPLATE_EDIT_TARGET_NOT_FOUND` | templatize match/anchor/range cannot be found |
| `TEMPLATE_RENDER_FAILED` | docxtemplater render cannot produce a DOCX |
| `INVALID_TEMPLATE_SPEC` | template-generation JSON does not meet the block schema |

### Dependencies

- upstream: none
- downstream: `apps/cli`, `apps/web`, optional `packages/providers`
- document libraries: `docxtemplater`, `pizzip`, `pdf-parse`, `docx`
- test runner: Vitest. Core line/branch/function coverage must be at least 80%; all tests use local binary fixtures and never invoke a provider.

## Autonomy

- 내부 구현: 공개 타입·에러 코드·legacy inventory를 지키는 범위에서 자유.
- Contract 변경: Phase 1에서 `contract-change` step을 append하고 Phase 2 CLI 및 Phase 3 web-adapter 계약을 함께 갱신한다.
- 타 모듈 MODULE.md: 읽기만, 수정 금지.
