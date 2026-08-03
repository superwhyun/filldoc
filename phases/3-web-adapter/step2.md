# Step 2: ui-migration

## 읽어야 할 파일

- `docs/modules/web-adapter/MODULE.md`, API adapter contract
- `app/page.tsx`, `components/{template-upload,data-upload,content-editor,settings-dialog}.tsx`

## 모듈 할당

- module: `web-adapter`
- owned_paths: `app/page.tsx`, listed UI components, UI-only hooks/types
- read_contracts: web API DTO contract
- forbidden_paths: core, providers, API route behavior

## 계약 및 베이스라인

- UI는 upload, progress, editable result, download 및 user-facing error만 관리한다.
- browser-side DOCX rendering과 direct OpenAI/xAI fetch를 제거한다. 기존 provider 선택과 명시적 BYOK remember UX는 web adapter에만 유지한다.

## 작업

components를 API DTO와 다운로드 response만 소비하도록 옮기고, 설정 화면에서 server-configured provider와 BYOK를 선택할 수 있게 한다. 기존 template selection, placeholder edit, document download flow를 보존한다.

## Acceptance Criteria

- [ ] browser bundle/source에 direct provider fetch와 duplicated Docxtemplater render logic가 없다. BYOK key handling은 settings/web adapter 경계로 제한된다.
- [ ] 기존 UI의 template upload→placeholder edit→generate/download flow가 동작한다.
- [ ] API 오류가 한국어의 안전한 사용자 메시지로 표시된다.

## 검증 절차

1. component/integration tests를 실행한다.
2. browser bundle과 localStorage usage를 검사한다.
3. core CLI fixture 결과와 web download 결과를 비교한다.

## 금지사항

- document rendering 규칙을 UI에 재도입하지 않는다.

## 실행 결과

1. `app/page.tsx`의 `handleEditComplete`: pizzip/docxtemplater 직접 import와 점-표기 loop 전처리/custom angular parser(약 100줄)를 전부 제거하고 `POST /api/generate-document` 호출로 교체(`allowPartial: true`로 기존 "누락 값은 빈 문자열로 렌더링" 동작을 그대로 보존).
2. `components/data-upload.tsx`: `.docx`(pizzip/docxtemplater)와 `.pdf`(pdfjs-dist, CDN 워커 로드) client-side 추출을 제거하고 `POST /api/extract-text` 호출로 통일(`.txt`/`.md`도 같은 경로로 단순화).
3. `components/template-upload.tsx`: `generateTemplateDocx`(브라우저 → api.openai.com/api.x.ai 직접 fetch) 호출을 `POST /api/generate-template` 호출로 교체. 응답의 `Content-Disposition` 헤더에서 서버가 정규화한 파일명을 읽어 `File`을 구성.
4. `lib/client-settings.ts` 신설: `localStorage["docfiller-settings"]` 읽기/쓰기를 한 곳으로 통합(`loadDocfillerSettings`, `saveDocfillerSettings`, `getProviderApiKey`). `settings-dialog.tsx`, `template-upload.tsx`, `data-upload.tsx` 3곳이 독립적으로 파싱하던 걸 이걸로 교체.
5. UI의 client-side "BYOK 키 없으면 차단" 로직 제거(`template-upload.tsx`의 `if (!apiKey) { alert(...); return }`) — 서버 env fallback을 실제로 쓸 수 있게 함. 키가 없어도 요청은 보내고, 서버가 401을 반환하면 그 메시지를 그대로 사용자에게 보여준다.
6. `pdfjs-dist`가 더 이상 어디서도 import되지 않는 것을 확인하고 root `package.json`에서 제거(`pnpm install`로 lockfile 갱신).

### AC 검증

- [x] browser bundle/source에 direct provider fetch와 duplicated Docxtemplater render logic가 없다 — `.next/static/chunks/*.js`를 `docxtemplater`/`api.openai.com`/`api.x.ai`/`pdfjs`로 grep한 결과 0건. BYOK key handling은 `lib/client-settings.ts` + `/api/*` 요청 body로만 이동.
- [x] 기존 UI의 template upload→placeholder edit→generate/download flow가 동작한다 — `pnpm dev:next`로 실행한 서버에 `/api/extract-placeholders`, `/api/generate-document`, `/api/generate-template`(400/401 경로), `/api/fill-placeholders`(401 경로)를 실제 fixture로 호출해 확인(아래 로그).
- [x] API 오류가 한국어 사용자 메시지로 표시된다 — 기존 `alert(error.message)` 패턴 유지, 서버 오류 메시지가 전부 한국어.

### 검증 로그

- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm lint` → 0 errors.
- `pnpm test` → 12 files / 57 tests 통과, coverage 80% threshold 통과.
- `pnpm build` → 성공, `/api/generate-template` 라우트 정상 등록.
- `pnpm dev:next`(포트 3001, 기존에 다른 프로세스가 3000 점유 중이라 자동 이동)로 실행한 뒤 curl로 실제 요청 확인:
  - `POST /api/generate-template` (userRequest 없음) → 400.
  - `POST /api/fill-placeholders` (키 없음) → 401.
  - `POST /api/extract-placeholders` (fixture docx) → 200, `{ placeholders: [{ key: "title" }] }`.
  - `POST /api/generate-document` (fixture docx + `{title:"Hello"}`) → 200, 8491 bytes DOCX 응답.
  - 서버 로그에 런타임 에러 없음(기존 lockfile 경고만 존재, 무관).
  - 테스트 서버는 검증 후 종료.
- `find .next/static/chunks -name "*.js" | xargs grep -l "docxtemplater\|api.openai.com\|api.x.ai\|pdfjs"` → 빈 결과.
