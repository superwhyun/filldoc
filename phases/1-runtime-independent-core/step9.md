# Step 9: blocking-fix-ci-gates

## 배경

`vitest.config.ts`에 80% coverage threshold가 설정돼 있었지만 `coverage.enabled`가
꺼져 있어 일반 `pnpm test`(= goal.json의 auto_check)로는 강제되지 않았다. 또한
PDF 추출 경로(`extractDocumentText`의 `.pdf` 분기), dot-notation 표 loop의 render-time
XML 전처리(`render-template.ts`의 `preProcessXml`), web adapter(`app/api/generate-document`)는
어떤 테스트로도 exercise되지 않고 있었다.

## 읽어야 할 파일

- `vitest.config.ts`, `goal.json`
- `packages/core/src/extract-document-text.ts`, `packages/core/src/render-template.ts`
- `app/api/generate-document/route.ts`

## 모듈 할당

- module: `document-core`
- owned_paths:
  - `vitest.config.ts`
  - `tests/document-core/fixtures.ts`
  - `tests/document-core/pdf-loop-regression.test.ts` (신규)
  - `tests/web/generate-document-route.test.ts` (신규)
  - `phases/1-runtime-independent-core/index.json`
  - `phases/1-runtime-independent-core/module-map.json`
- forbidden_paths: core/adapter 구현 파일의 런타임 동작 변경(coverage를 올리려고 로직을 바꾸지 않는다)

## 작업

1. `vitest.config.ts`의 `coverage.enabled`를 `true`로 켜서 `pnpm test`(goal.json auto_check) 실행마다 80% 라인/브랜치/함수/구문 threshold가 실제로 강제되게 한다.
2. `tests/document-core/fixtures.ts`에 두 개의 fixture 생성기를 추가한다:
   - `createDocxTable(header, rowCells)`: dot-notation 표 loop(`{{tasks.name}}` 류)를 가진 docx.
   - `createPdf(text)`: 바이트 오프셋을 직접 계산해 만드는 최소 유효 단일 페이지 PDF(외부 라이브러리·바이너리 fixture 파일 불필요).
3. PDF 회귀 테스트를 추가한다: 정상 PDF 텍스트 추출, 손상된 PDF에 대한 에러 래핑.
4. loop 회귀 테스트를 추가한다: 표 dot-notation 템플릿을 배열 데이터로 렌더링해 각 행이 실제로 전개되는지 렌더링 결과 텍스트로 검증한다 (기존 테스트는 `inspectTemplate`의 구조 파싱만 검증했고, render-time XML 전처리는 커버되지 않았다).
5. web adapter 회귀 테스트를 추가한다: `app/api/generate-document`의 POST 핸들러를 `next/server`의 `NextRequest`로 직접 호출해 정상 렌더링(200), 누락 데이터 차단(400 + missing 목록), `allowPartial` 통과(200) 세 가지를 검증한다.
6. web 테스트가 `@/lib/server/*` alias를 해석하도록 `vitest.config.ts`에 `resolve.alias`(`@` → 프로젝트 루트, tsconfig의 `paths`와 동일)를 추가한다.

## 계약 및 베이스라인

- 테스트 추가만 한다. `extractDocumentText`, `renderTemplate`, `app/api/generate-document`의 런타임 동작은 바꾸지 않는다.
- MODULE.md의 "test runner: Vitest ... coverage 최소 80%, 모든 테스트는 로컬 바이너리 fixture만 쓰고 provider를 호출하지 않는다" 계약을 그대로 지킨다 — PDF/loop fixture는 모두 in-process로 생성되고 네트워크 호출이 없다.

## Acceptance Criteria

- [ ] `pnpm test`가 coverage를 포함해서 실행되고 lines/branches/functions/statements 80% threshold를 통과한다.
- [ ] `pnpm exec tsc --noEmit --pretty false` 통과.
- [ ] `pnpm lint`에 새 error 없음.
- [ ] PDF 추출 성공/실패 경로가 모두 테스트로 커버된다.
- [ ] 표 dot-notation loop가 실제 배열 데이터로 렌더링되는 경로가 테스트로 커버된다.
- [ ] `app/api/generate-document`의 200/400/allowPartial 분기가 모두 테스트로 커버된다.

## 검증 절차

1. `pnpm test` (coverage 포함) 실행 후 threshold 통과 여부 확인.
2. `pnpm exec tsc --noEmit --pretty false`
3. `pnpm lint`

## 검증 결과

- `pnpm test` → 7 files / 36 tests 통과. Coverage(`packages/core/src`): 전체 lines 88.38% / branches 84.21% / functions 81.57% / statements 88.38% — 80% threshold 모두 통과 (exit code 0).
  - 이번 step 전: `extract-document-text.ts` 68.51%→92.59%, `render-template.ts` 65.11%→93.02% (lines).
- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm lint` → 0 errors.

## 금지사항

- coverage 수치를 올리기 위해 core/adapter의 런타임 로직을 바꾸지 않는다.
- typed error code 시스템 도입은 이번 step 범위가 아니다 (Step 7의 deferred_backlog 참고).
