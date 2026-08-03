# Step 3: web-regression

## 읽어야 할 파일

- web-adapter MODULE.md, API/UI tests, Phase 2 CLI E2E baseline

## 모듈 할당

- module: `web-adapter`
- owned_paths: Playwright/E2E configuration and fixtures, web verification scripts
- read_contracts: web API and CLI result contracts
- forbidden_paths: business logic changes

## 계약 및 베이스라인

- E2E uses a fake provider and fixture credentials; no live AI key is required. BYOK request는 fixture key가 adapter 경계를 넘지 않는지도 검증한다.
- Web output must be semantically equal to the core/CLI fixture output.

## 작업

핵심 흐름(템플릿 선택/업로드, placeholder 확인, 자료 업로드, fill 또는 direct render, 편집, download)과 API failure states를 browser E2E로 검증한다.

## Acceptance Criteria

- [ ] 기존 provider 선택/BYOK happy path와 validation/provider failure path E2E가 있다.
- [ ] 다운로드한 DOCX의 placeholders/values가 CLI fixture와 일치한다.
- [ ] build, lint, typecheck, test가 통과한다.

## 검증 절차

1. fake provider를 포함한 browser E2E를 실행한다.
2. download 파일을 core extract로 검사한다.
3. build artifact에서 secret/API key가 없음을 검사한다.

## 금지사항

- live provider 또는 사용자 credentials를 사용하지 않는다.

## 실행 결과

1. `@playwright/test` 신설(devDependency), `playwright.config.ts` 추가(포트 3100, `pnpm exec next dev`를 webServer로 자동 기동). `pnpm test:e2e` 스크립트 추가 — `pnpm test`(vitest, 빠른 게이트)와 분리된 별도 명령으로 유지.
2. `tests/e2e/core-flow.spec.ts`: 템플릿 업로드 → placeholder 확인 → "수동으로 입력하기"(AI 없음) → 편집 → 문서 생성 → 실제 다운로드 링크 클릭 → 다운로드된 DOCX를 core `extractDocumentText`로 재검사해 입력한 값이 실제로 렌더링됐는지 확인. 누락 데이터가 있어도(`allowPartial: true`) 에러 없이 완료되는지도 검증.
3. `tests/e2e/fake-provider.spec.ts`: `page.route("**/api/fill-placeholders")`로 브라우저의 fetch 호출을 가로채는 fake provider로 (a) happy path — BYOK 키가 실제로 요청에 포함되는지, AI가 채운 값이 편집 화면에 반영되는지, 최종 다운로드 DOCX에 그 값이 실제로 렌더링됐는지, 그리고 **`/api/generate-document` 요청에는 BYOK 키가 전혀 포함되지 않는지**(adapter 경계 확인) 검증. (b) 401 실패 경로 — `alert()` 다이얼로그로 에러 메시지가 사용자에게 그대로 노출되고 크래시 없이 이전 화면에 남아있는지 검증.
4. `components/settings-dialog.tsx`의 설정 아이콘 버튼에 `aria-label="Settings"` 추가(테스트 셀렉터를 위해 발견한 실제 접근성 공백 — 아이콘 전용 버튼에 접근 가능한 이름이 없었음).
5. `.gitignore`에 Playwright 산출물(`/test-results/`, `/playwright-report/`, `/playwright/.cache/`) 추가.
6. 빌드 산출물(`.next/static/chunks`)에 `OPENAI_API_KEY`/`XAI_API_KEY` 문자열이 없음을 grep으로 확인(서버 env 키가 클라이언트 번들에 인라인되지 않음).

### 시행착오

- 최초 작성한 테스트는 "문서 생성하기" 클릭 직후 `page.waitForEvent("download")`를 걸어 전부 타임아웃났다. 실제로는 그 클릭이 "Document Ready!" 화면으로 전환만 시키고, 진짜 다운로드는 그 화면의 "Download Document" `<a>` 링크를 클릭해야 발생한다(앱 자체는 정상 동작 — 테스트의 이벤트 대기 위치가 틀렸던 것, page snapshot으로 확인 후 수정).

### AC 검증

- [x] 기존 provider 선택/BYOK happy path와 validation/provider failure path E2E가 있다.
- [x] 다운로드한 DOCX의 placeholders/values가 CLI fixture와 일치한다 — core `extractDocumentText`로 재추출해 입력/AI-fill 값이 그대로 렌더링됨을 확인(수동 입력 경로, fake-provider 경로 둘 다).
- [x] build, lint, typecheck, test가 통과한다.

### 검증 로그

- `pnpm test:e2e` → 4 tests 통과 (chromium, 로컬 dev 서버 자동 기동/종료).
- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm lint` → 0 errors.
- `pnpm test`(vitest) → 12 files / 57 tests 통과, coverage 80% threshold 통과.
- `pnpm build` → 성공.
- `.next/static/chunks`에 `OPENAI_API_KEY`/`XAI_API_KEY` 없음 확인.
