# Step 5: review-fix-credential-error-messages

## 읽어야 할 파일

- `components/template-upload.tsx`, `components/data-upload.tsx`
- `lib/server/resolve-provider-credential.ts`

## 배경

Phase 3 리뷰 게이트 1회차(`framework/docs/REVIEW.md` 워크플로우, `RepGen-phase2-done..HEAD` diff 대상)에서 발견:

Step 2에서 client-side BYOK 키 사전 차단(`if (!apiKey) { alert(...); return }`)을 제거해 서버 env fallback을 실제로 쓸 수 있게 했는데, 그 결과 키가 전혀 없는 가장 흔한 경우(서버 env도 BYOK도 없음) 사용자가 보는 메시지가 서버의 원문 401 메시지("API 키가 없습니다. 요청에 apiKey를 포함하거나 서버에 OPENAI_API_KEY 환경변수를 설정하세요.")로 바뀌었다. 이 메시지는 API 개발자에게는 정확하지만, 일반 사용자에게는 "Settings에서 키를 설정해야 한다"는 실행 가능한 안내가 빠져 있다.

## 모듈 할당

- module: `web-adapter`
- owned_paths: `components/template-upload.tsx`, `components/data-upload.tsx`, `tests/e2e/fake-provider.spec.ts`
- forbidden_paths: API route, credential 해석 로직(서버 메시지 자체는 그대로 유지 — 다른 소비자에게는 여전히 정확한 원문 정보 필요)

## 계약 및 베이스라인

- 서버 응답의 401 body(`{ error: <원문 메시지> }`)는 바꾸지 않는다 — UI에서만 401을 특수 처리해 더 친절한 메시지로 대체한다.

## 작업

`template-upload.tsx`의 `handleGenerateTemplateWithAI`와 `data-upload.tsx`의 `handleGenerate`에서 `response.status === 401`이면 서버 원문 메시지 대신 `Settings에서 {Provider} API 키를 설정해주세요.` 메시지를 throw하도록 수정. 그 외 상태 코드는 기존처럼 서버 메시지를 그대로 사용.

## Acceptance Criteria

- [ ] `pnpm test:e2e`가 통과하고, 401 경로에서 "Settings에서" 문구가 포함된 메시지가 노출되는지 검증하는 테스트가 있다.
- [ ] `pnpm exec tsc --noEmit --pretty false`, `pnpm lint`, `pnpm test`가 통과한다.

## 검증 절차

1. `pnpm exec tsc --noEmit --pretty false`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm test:e2e`

## 검증 결과

- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm lint` → 0 errors.
- `pnpm test` → 12 files / 57 tests 통과, coverage 80% threshold 통과.
- `pnpm test:e2e` → 4 tests 통과, `fake-provider.spec.ts`의 401 테스트가 "Settings에서" / "API 키를 설정해주세요" 문구를 확인하도록 갱신됨.

## 금지사항

- 서버 401 응답의 body 형태를 바꾸지 않는다 (다른 API 소비자와의 계약 유지).
