# Step 1: api-adapters

## 읽어야 할 파일

- `docs/modules/web-adapter/MODULE.md`, core/provider contracts
- `app/api/*/route.ts`, package server configuration

## 모듈 할당

- module: `web-adapter`
- owned_paths: `app/api/**/route.ts`, server-only web adapter modules, route tests
- read_contracts: `document-core`, provider contracts
- forbidden_paths: React components and CLI command code

## 계약 및 베이스라인

- route는 validation→core call→HTTP response만 수행한다.
- provider credential은 web adapter boundary에서만 검증한다. 서버 env와 BYOK request credential을 모두 지원하되, core에는 credential을 전달하지 않는다.

## 작업

기존 extract/fill/generate/template routes를 shared DTO validator와 core 호출로 이관한다. fill route의 provider adapter만 server env 또는 BYOK credential을 사용한다. 파일 이름, MIME, 크기, template path traversal을 검증하고 오류를 안전한 HTTP 응답으로 변환한다.

## Acceptance Criteria

- [ ] route production source에 DOCX XML 조작, prompt 생성, provider SDK 직접 호출이 없다.
- [ ] invalid request, unsupported upload, missing server credential, core error가 계약된 status/body를 반환한다.
- [ ] API key가 response, server log, core DTO, generated file에 포함되지 않는다.

## 검증 절차

1. route contract tests를 실행한다.
2. static search와 build output으로 browser secret 누출이 없는지 확인한다.
3. lint/typecheck/test를 실행한다.

## 금지사항

- UI interaction 흐름을 이 단계에서 바꾸지 않는다.

## 실행 결과

1. `lib/server/resolve-provider-credential.ts` 신설: BYOK(요청 `apiKey`) > 서버 env(`OPENAI_API_KEY`/`XAI_API_KEY`) 순으로 credential을 결정하고, 둘 다 없으면 `MissingProviderCredentialError`를 던진다. `app/api/fill-placeholders`가 이걸로 `apiKey`를 optional로 바꿨다(기존엔 필수).
2. `lib/server/upload-limits.ts` 신설: `MAX_UPLOAD_BYTES = 20MB`, `assertUploadSize()`가 `content: number[]` 길이를 검사해 초과 시 `UploadTooLargeError`를 던진다. `extract-placeholders`, `extract-text`, `generate-document` 3개 라우트에 적용, 초과 시 413.
3. `app/api/generate-template/route.ts` 신설: `lib/client-template-generator.ts`의 `generateTemplateDocx`를 서버에서 호출(이 함수는 이미 Node/브라우저 양쪽에서 동작 — Phase 1 step8에서 `Packer.toArrayBuffer`로 이식성 확보해둔 덕분에 새 provider adapter를 안 만들어도 됨). `userRequest` 누락 400, credential 없음 401, DOCX를 attachment로 반환.
4. 모든 라우트 파일에 docxtemplater/pizzip/provider SDK 직접 import·호출이 없음을 grep으로 확인(기존과 동일하게 `lib/server/*`/`lib/client-template-generator.ts`에 위임).
5. 신규 테스트: `resolve-provider-credential.test.ts`(4), `upload-limits.test.ts`(3), `fill-placeholders-route.test.ts`(1, 401 무-네트워크 경로), `generate-template-route.test.ts`(2, 400/401 무-네트워크 경로), `generate-document-route.test.ts`에 413 케이스 추가(1).

### AC 검증

- [x] route production source에 DOCX XML 조작, prompt 생성, provider SDK 직접 호출이 없다.
- [x] invalid request(400), unsupported upload(413), missing server credential(401), core error(400/500)가 계약된 status/body를 반환한다.
- [x] API key가 response/server log/core DTO/generated file에 포함되지 않음 — 모든 route/lib 파일에 `console.*(apiKey`류 패턴 없음(grep 확인), 응답 body에 key를 echo하는 코드 없음.

### 검증 로그

- `pnpm test` → 12 files / **57 tests** 통과 (신규 11개 포함), coverage 80% threshold 통과.
- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm lint` → 0 errors.
- `pnpm build`(Next production build) → 성공, `/api/generate-template` 라우트가 정상 등록됨.
