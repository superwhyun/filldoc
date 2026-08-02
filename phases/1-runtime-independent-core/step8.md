# Step 8: blocking-fix-single-template-builder

## 배경

`packages/core/src/build-template.ts`의 `buildTemplateFromSpec`은 Step 1에서 이미
core로 추출됐지만, 웹/legacy 소비자인 `lib/client-template-generator.ts`는 여전히
`createStyledDocx` + `normalizeConflictingPlaceholderKeys` + `toHeadingLevel` +
`tableCell` 등 거의 동일한 DOCX 조립 로직을 자체적으로 들고 있었다 (690줄).
web(`components/template-upload.tsx`)과 legacy CLI(`repgen-analyze-doc` → `scripts/analyze-doc.ts`)가
서로 다른 조립기를 쓰는 상태였다.

## 읽어야 할 파일

- `packages/core/src/build-template.ts`
- `lib/client-template-generator.ts`
- `components/template-upload.tsx`, `scripts/analyze-doc.ts` (소비자)

## 모듈 할당

- module: `document-core`
- owned_paths:
  - `packages/core/src/build-template.ts`
  - `lib/client-template-generator.ts`
  - `tests/lib/client-template-generator.test.ts` (신규)
  - `phases/1-runtime-independent-core/index.json`
  - `phases/1-runtime-independent-core/module-map.json`
- forbidden_paths: `components/template-upload.tsx`, `scripts/analyze-doc.ts`의 외부 호출 시그니처(변경 없이 유지)

## 작업

1. `packages/core/src/build-template.ts`의 `Packer.toBuffer`(Node `Buffer` 전제, JSZip이 `nodebuffer` 출력을 지원하려면 브라우저에 `Buffer` polyfill이 필요해 기본 Next 클라이언트 번들에서는 깨짐)를 `Packer.toArrayBuffer`(Node/브라우저 공통 지원)로 교체해 core가 브라우저에서도 안전하게 실행되게 한다.
2. `lib/client-template-generator.ts`에서 DOCX 조립 로직 전부(`createStyledDocx`, `tableCell`, `toHeadingLevel`, `normalizeConflictingPlaceholderKeys`, `splitByPlaceholderSegments`, `PlaceholderUsage`, `TemplateBlock`/`TemplateGenerationJson` 중복 타입 정의, `docx` 패키지 직접 import)를 제거한다.
3. 남은 코드(AI 프롬프트 빌더, OpenAI/Grok 호출, JSON 파싱)는 core의 `buildTemplateFromSpec`을 호출하고 반환된 `Uint8Array`를 `File`로 감싸는 얇은 adapter로 재작성한다 (`assembleFile` 헬퍼).
4. 기존 3개 export(`generateTemplateDocx`, `buildTemplateFromSpec`, `generateTemplateFromSample`)의 파일명 기본값 정책(각각 `ai-template-*`, `template-*`, `sample-template-*` 접두사)과 외부 시그니처는 그대로 보존한다.
5. 새 wrapper의 실제 바이트 왕복(파일 생성 → `inspectTemplate`로 재파싱)을 검증하는 테스트를 추가한다.

## 계약 및 베이스라인

- `components/template-upload.tsx`의 `generateTemplateDocx` 호출 시그니처, `scripts/analyze-doc.ts`의 `generateTemplateFromSample` 호출 시그니처는 변경하지 않는다.
- 문서 조립 규칙(heading level, table border, repeating_section loop tag 처리)은 core의 기존 구현을 그대로 따르므로 산출물 DOCX의 시각적 결과는 Step 1~2에서 검증된 것과 동일하다.

## Acceptance Criteria

- [ ] `pnpm exec tsc --noEmit --pretty false` 통과.
- [ ] `pnpm test` 통과 (신규 `tests/lib/client-template-generator.test.ts` 포함).
- [ ] `pnpm lint`에 새 error 없음.
- [ ] `lib/client-template-generator.ts`에 `docx` 패키지 직접 import가 없다 (`grep -n "from \"docx\"" lib/client-template-generator.ts` 결과 없음).
- [ ] `packages/core/src/build-template.ts`가 유일한 DOCX 조립 구현이다.

## 검증 절차

1. `pnpm exec tsc --noEmit --pretty false`
2. `pnpm test`
3. `pnpm lint`
4. `grep -n "from \"docx\"" lib/client-template-generator.ts` (빈 결과 확인)

## 검증 결과

- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm test` → 5 files / 30 tests 통과 (신규 3 tests 포함, `buildTemplateFromSpec` wrapper의 File 왕복·파일명 기본값 정책을 실제로 검증).
- `pnpm lint` → 0 errors.
- `lib/client-template-generator.ts`: 690줄 → 306줄, `docx` 패키지 import 제거 확인.

## 금지사항

- `components/template-upload.tsx`, `scripts/analyze-doc.ts`의 외부 호출 계약을 바꾸지 않는다.
- AI 프롬프트 문구, OpenAI/Grok 호출 방식은 이번 step의 범위가 아니므로 그대로 둔다.
