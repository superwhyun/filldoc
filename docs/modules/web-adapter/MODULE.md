---
id: web-adapter
version: 0.1.0
parent: none
persona: web-adapter
status: implemented
contract_version: 0.1.0
---

# web-adapter

Next.js API routes와 React UI를 `document-core`/`cli-surface` 계약의 얇은 웹
어댑터로 만든다. 웹은 HTTP DTO ↔ core DTO 변환, 업로드 제약, credential 경계,
UI 상태만 담당하며 문서 처리 규칙이나 AI 호출 로직을 직접 구현하지 않는다.

## 현재 상태 조사 (이 계약의 근거)

- `app/page.tsx`는 5단계 위저드(upload→placeholders→data→edit→download)를
  들고 있고, `handleEditComplete`에서 **pizzip/docxtemplater를 브라우저에
  직접 import해 core의 `render-template.ts`와 거의 동일한 로직(점 표기 loop
  전처리, custom angular parser)을 중복 구현**하고 있다. 이미 존재하는
  `POST /api/generate-document`(Phase 1에서 core `validateRenderData`/
  `renderTemplate`에 연결됨)를 호출하지 않고 있다.
- `components/data-upload.tsx`는 `.docx`(pizzip/docxtemplater)와
  `.pdf`(pdfjs-dist, CDN에서 워커 스크립트 로드)를 **브라우저에서 직접
  텍스트 추출**한다. 이미 존재하는 `POST /api/extract-text`(core
  `extractDocumentText`에 연결됨)를 호출하지 않고 있다.
- `components/template-upload.tsx`의 AI 템플릿 생성 경로는
  `lib/client-template-generator.ts`의 `generateTemplateDocx`를 호출하는데,
  이 함수는 **브라우저에서 `api.openai.com`/`api.x.ai`로 직접 fetch**한다
  (`generateWithOpenAI`/`generateWithGrok`). 이 과정에서 API 키가 브라우저
  네트워크 탭에 그대로 노출된다.
- API 키는 `localStorage["docfiller-settings"]`에 **평문 JSON**으로 저장되고
  (`settings-dialog.tsx`, `template-upload.tsx`, `data-upload.tsx` 3곳에서
  독립적으로 읽음, 공유 accessor 없음), 서버 환경변수 fallback은 전혀 없다
  (`process.env`에 provider 키 참조가 코드베이스 어디에도 없음).
- `POST /api/generate-document`, `POST /api/extract-text`는 이미 구현·테스트
  되어 있지만 어떤 UI 컴포넌트도 호출하지 않는 고아 라우트다.

## Contract

### 계층 원칙

- API route는 **request validation → core/CLI 계약 호출 → HTTP 응답 변환**만
  한다. DOCX XML 조작, docxtemplater 직접 사용, AI 프롬프트 조립은 route
  파일에 두지 않는다(이미 `lib/server/*`가 그 경계를 담당).
- 브라우저(컴포넌트)는 **업로드, 진행 상태, 편집 가능한 결과, 다운로드,
  사용자向 에러 메시지**만 담당한다. DOCX 렌더링, 텍스트 추출, AI provider
  호출을 브라우저에서 직접 하지 않는다 — 전부 `/api/*`를 거친다.

### Routes

| Route | Request | Success | Failure | 비고 |
| --- | --- | --- | --- | --- |
| `POST /api/extract-placeholders` | `{ content: number[] }` | `{ placeholders, warnings? }` | 400(템플릿 오류)/500 | 기존 유지 |
| `POST /api/extract-text` | `{ content: number[], filename }` | `{ text }` | 400/500 | **기존 라우트, Step 2에서 UI가 실제로 호출하도록 연결** (data-upload.tsx의 client-side pizzip/pdfjs-dist 추출 제거) |
| `POST /api/generate-document` | `{ templateContent: number[], placeholders, allowPartial? }` | DOCX attachment | 400(누락 데이터)/500 | **기존 라우트, Step 2에서 app/page.tsx의 client-side docxtemplater 렌더링 제거하고 이걸 호출하도록 연결** |
| `POST /api/fill-placeholders` | `{ dataContent, placeholders, provider, apiKey? }` | 현재 fill 결과 JSON | 400/401/5xx | **Step 1에서 `apiKey` optional로 변경, 없으면 서버 env(`OPENAI_API_KEY`/`XAI_API_KEY`) fallback, 둘 다 없으면 401** |
| `POST /api/generate-template` (신규) | `{ mode: "prompt"; userRequest; provider; apiKey?; templateName? }` | `{ file: number[], filename, spec }` | 400/401/5xx | **신규.** `lib/client-template-generator.ts`의 `generateWithOpenAI`/`generateWithGrok` 호출을 서버로 이전. 브라우저는 더 이상 `api.openai.com`/`api.x.ai`에 직접 fetch하지 않는다. `apiKey` optional, 없으면 서버 env fallback (fill-placeholders와 동일 정책) |
| `GET /api/templates`, `GET /api/templates/[filename]` | - | 기존 유지 | 기존 유지 | path traversal 방어 이미 있음(`filename.includes("/"\|"\\")`), 변경 없음 |

### Credential 정책 (BYOK + server env, Step 1에서 구현)

우선순위 (CLI의 `--api-key` > env 정책과 동일한 원칙, Phase 2 baseline
`phase3_adapter_inputs` 참고):

1. 요청 body의 `apiKey`(BYOK, 브라우저 `localStorage` 설정에서 옴)
2. 서버 환경변수 `OPENAI_API_KEY`(provider=openai) / `XAI_API_KEY`(provider=grok)
3. 둘 다 없으면 `401 { error: "API 키가 없습니다..." }`

- API 키는 **core DTO/생성된 파일/서버 로그에 절대 포함하지 않는다** — route는
  key를 provider 호출 함수 인자로만 전달하고 응답 JSON이나 `console.error`에
  echo하지 않는다 (기존 route들도 이미 이 원칙을 지키고 있음 — 유지).
- `settings-dialog.tsx`의 `localStorage["docfiller-settings"]` "remember" 방식은
  호환 유지한다(요구사항). 평문 저장이라는 한계는 `known_issues`로 남기고,
  최소한 세 곳에서 독립적으로 읽던 것을 **Step 2에서 공유 hook(`useSettings`
  또는 동등한 것)으로 통합**해 중복과 불일치 위험을 줄인다.

### Upload 제약 (Step 1에서 신설)

- 템플릿/데이터 업로드 파일 크기 제한: **20MB** (기존에 제한 없었음 — DoS/메모리
  이슈 방지). 초과 시 `413`.
- 확장자 allowlist는 각 라우트가 이미 위임한 core 계약(`extractDocumentText`의
  `.docx/.pdf/.txt/.md`, `extractPlaceholders`의 `.docx`)을 그대로 따른다.
  route 레벨에서는 추가로 `content` 배열 길이로 크기만 검사한다(파일 시스템
  접근 이전에 우선 차단).

### UI 재구성 (Step 2)

- `app/page.tsx`의 `handleEditComplete`: pizzip/docxtemplater 직접 사용 제거,
  `POST /api/generate-document` 호출로 교체. 누락 데이터 400 응답을 사용자
  메시지로 매핑.
- `components/data-upload.tsx`: `.docx`/`.pdf` client-side 추출 제거,
  `POST /api/extract-text` 호출로 교체. pdfjs-dist 의존성과 CDN 워커 스크립트
  로드가 더 이상 필요 없으면 제거한다(사용처가 이 한 곳뿐이면 완전 제거,
  다른 곳에서 쓰면 유지).
- `components/template-upload.tsx`: `generateTemplateDocx`(브라우저 직접
  fetch) 호출을 `POST /api/generate-template` 호출로 교체.
- 기존 업로드→placeholder 편집→데이터 업로드→편집→다운로드 흐름과 provider
  선택/BYOK UI, 서버/브라우저 템플릿 목록은 그대로 유지한다 — 내부 구현만
  core 계약을 거치도록 바꾼다.

### Errors

기존 라우트들의 응답 형태(`{ error, details? }` 또는 `{ error, validations?, warnings? }`)를
유지한다. 신규/확장 라우트도 동일한 형태를 따른다:

| status | 의미 |
| --- | --- |
| 400 | 요청 형식 오류, 템플릿/렌더 데이터 오류 (client 재시도 불가, 입력 수정 필요) |
| 401 | provider credential 없음/오류 |
| 413 | 업로드 파일 크기 초과 |
| 500 | 예상치 못한 서버/provider 오류 |

### Dependencies

- upstream: `document-core`(Phase 1), `cli-surface`(Phase 2, 참고용 — exit
  code/credential 우선순위 원칙 공유, 직접 코드 의존은 없음)
- downstream: 없음 (최종 소비자는 브라우저)
- `lib/server/fill-placeholders.ts`, `lib/client-template-generator.ts`
  (AI 프롬프트/호출)는 core 밖의 legacy optional provider adapter로 유지 —
  이번 phase에서 `packages/providers`로 옮기지 않는다 (Phase 2 baseline과
  동일한 판단).

## Autonomy

- 내부 구현: 이 문서의 route 표/credential 정책/upload 제약을 지키는 범위에서 자유.
- Contract 변경: 이후 phase가 생기면 `contract-change` step으로 갱신한다.
- 타 모듈 MODULE.md: 읽기만, 수정 금지.
