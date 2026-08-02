# Step 7: blocking-fix-core-contract

## 배경

`packages/core`의 `renderTemplate`이 MODULE.md 계약에 없는 legacy positional overload를
갖고 있었고, `validateRenderData`는 export만 되어 있을 뿐 어떤 adapter도 호출하지 않아
"strict render-data validation"이 실제로 강제되지 않았다.

## 읽어야 할 파일

- `docs/modules/document-core/MODULE.md`
- `packages/core/src/render-template.ts`, `packages/core/src/validate-render-data.ts`
- `lib/server/generate-document.ts`, `scripts/render-doc.ts`, `app/api/generate-document/route.ts`

## 모듈 할당

- module: `document-core`
- owned_paths:
  - `packages/core/src/render-template.ts`
  - `lib/server/generate-document.ts`
  - `lib/server/validate-render-data.ts` (신규)
  - `scripts/render-doc.ts`
  - `app/api/generate-document/route.ts`
  - `tests/document-core/render-templatize.test.ts`
  - `tests/document-core/characterization.test.ts`
  - `tests/document-core/validate-render-data.test.ts` (신규)
  - `docs/modules/document-core/MODULE.md`
  - `phases/1-runtime-independent-core/index.json`
  - `phases/1-runtime-independent-core/module-map.json`
- forbidden_paths: `lib/client-template-generator.ts`, template-builder 관련 파일 (step 8 범위)

## 작업

1. `renderTemplate`의 legacy positional overload(`(templateContent, placeholders)`)를 제거하고 계약에 명시된 단일 signature `renderTemplate(input: { template, data })`만 남긴다.
2. 내부 소비자(`lib/server/generate-document.ts`, 두 개 core 테스트 파일)를 object-form 호출로 전환한다.
3. `scripts/render-doc.ts`의 인라인 "누락 key 필터" 로직을 core의 `validateRenderData`로 교체해 중복 판정 로직을 제거한다.
4. `app/api/generate-document/route.ts`(web adapter)에 `validateRenderData`를 연결해 CLI와 동일하게 기본적으로 strict(누락 시 차단)하게 만들고, `allowPartial` 옵션을 추가한다. 웹 adapter 접근을 위해 `lib/server/validate-render-data.ts` re-export 래퍼를 신설한다(기존 `lib/server/extract-placeholders.ts` 패턴과 동일).
5. `validateRenderData` 단위 테스트를 추가한다.
6. `MODULE.md`의 `POST /api/generate-document` 계약 행을 실제 동작(요청에 `allowPartial` 추가, 누락 데이터 400)과 일치하도록 갱신한다.
7. MODULE.md에 문서화된 typed error code 표(`INVALID_TEMPLATE` 등)는 아직 구현되지 않았음을 `module-map.json`의 `deferred_backlog`에 남긴다 (범위 초과, 별도 contract-change step 필요).

## 계약 및 베이스라인

- `inspectTemplate`/`renderTemplate`/`templatizeDocument`/`extractDocumentText`/`buildTemplateFromSpec`의 런타임 동작(순수 문서 처리 결과)은 바꾸지 않는다 — signature 정리와 adapter 배선만 한다.
- `repgen-render-doc`의 stdout 성공 계약(`{ output, filledKeys }`)과 exit code 정책은 그대로 유지한다. stderr 경고 문구는 `validateRenderData`가 생성하는 문구로 대체될 수 있다(계약 대상 아님).

## Acceptance Criteria

- [ ] `pnpm exec tsc --noEmit --pretty false` 통과.
- [ ] `pnpm test` 통과 (신규 `validate-render-data.test.ts` 포함).
- [ ] `pnpm lint`에 새 error 없음.
- [ ] `renderTemplate`을 legacy positional 형태로 호출하는 코드가 저장소에 남아있지 않다.
- [ ] `app/api/generate-document`가 누락 데이터에 대해 400을 반환한다(코드 리뷰로 확인, e2e는 Step 9 범위).

## 검증 절차

1. `pnpm exec tsc --noEmit --pretty false`
2. `pnpm test`
3. `pnpm lint`
4. `grep -rn "renderTemplate(" --include=*.ts` 로 legacy positional 호출 잔존 여부 확인.

## 검증 결과

- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm test` → 4 files / 27 tests 통과 (신규 3 tests 포함).
- `pnpm lint` → 0 errors.
- `renderTemplate(` grep → 모든 호출부가 `{ template, data }` object-form.

## 금지사항

- `lib/client-template-generator.ts`의 중복 template 조립 로직은 건드리지 않는다 (Step 8).
- typed error code 시스템 전체를 이번 step에서 구현하지 않는다 — 범위를 벗어나면 새 `blocking-fix`/`contract-change` step으로 append한다.
