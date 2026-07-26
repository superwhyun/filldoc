# Step 1: schema-and-prompt

## 읽어야 할 파일

- `docs/modules/template-analyzer/MODULE.md` (Step 0에서 확정한 contract)
- `phases/0-docx-to-template/module-map.json`
- `lib/client-template-generator.ts` 전체 (수정 대상)

## 모듈 할당

- module: `template-analyzer`
- owned_paths:
  - `lib/client-template-generator.ts` (추가만, 기존 export 삭제/시그니처 변경 금지)
- read_contracts:
  - `docs/modules/template-analyzer/MODULE.md`
- forbidden_paths:
  - `components/` (Step 1에서는 UI 연결 안 함)
  - `scripts/` (Step 2)

## 계약 및 베이스라인

- Step 0에서 확정한 `RepeatingSectionBlock` 타입, `generateTemplateFromSample` 시그니처를 그대로 구현한다. 계약을 바꿔야 할 이유가 생기면 이 step을 `blocked`로 남기고 `contract-change` step을 append한다.
- 기존 `generateTemplateDocx`, `buildPrompt`, `OUTPUT_SCHEMA`, `createStyledDocx` 등은 **동작을 바꾸지 않는다**. 전부 추가(add)만 한다.

## 작업

### 1. 타입 확장

`TemplateBlock` 유니온에 `RepeatingSectionBlock`을 추가한다 (Step 0 정의 그대로). `TemplateGenerationJson`의 `blocks` 배열 타입에 자동 포함됨.

### 2. `OUTPUT_SCHEMA` 확장 (OpenAI strict structured output)

기존 블록 아이템 스키마의 `type` enum에 `"repeating_section"`을 추가하고, `loopName`, `repeatingBlocks`(중첩 heading/paragraph만 허용하는 별도 고정 스키마 — 재귀 참조 피하기 위해 union 재사용하지 말고 `{ type: enum[heading,paragraph], level, text }` 형태로 flat하게 새로 정의) 필드를 최상위 블록 속성에 추가한다. 기존 패턴대로 미사용 필드는 전부 `required`에 포함하고 기본값(null/[])을 명시해야 strict 모드가 통과한다.

### 3. `buildAnalyzePrompt(sourceText: string, templateName?: string): string` 추가

`buildPrompt`와 병행하는 새 함수. 지침:
- 입력은 실제로 작성된 완성 문서의 텍스트다.
- 문서 전체에서 매번 바뀌는 부분(날짜, 이름, 문서번호, 각 항목의 제목/본문 등)과 고정된 상용구(boilerplate)를 구분하라.
- 바뀌는 부분은 `{{snake_case_key:설명}}` placeholder로 바꿔라. 설명은 원문 예시를 참고 자료로 포함해 한국어로 작성하라.
- 문서 안에 유사한 구조(제목+본문)가 여러 번 반복되면(예: 번호 매겨진 항목 목록), 그 반복 전체를 하나의 `repeating_section` 블록으로 표현하라 — **반복 횟수만큼 블록을 복제하지 말고 한 번만** 작성하되, 각 반복 안의 값은 plain `{{field}}` placeholder로 표시하라 (dot 표기 금지 — dot 표기는 표 전용).
- 실제 표(Word 표) 형태의 반복은 기존 `table` 블록 타입을 쓰고, 셀 안에는 `{{parent.field}}` dot 표기를 써라 (기존 방식 그대로).
- 출력 형식은 기존과 동일 (JSON만, 설명/마크다운 금지).

### 4. `generateTemplateFromSample({ provider, apiKey, sourceText, templateName })` 추가

`generateTemplateDocx`와 동일한 파이프라인(`buildAnalyzePrompt` → provider 호출 → `parseGenerationJson` → `normalizeConflictingPlaceholderKeys` → `createStyledDocx`)을 구현. 반환 형태도 동일 (`{ file, spec }`).

`normalizeConflictingPlaceholderKeys`는 `repeating_section` 안의 `blocks[].text`도 순회 대상에 포함해야 한다 (기존 함수가 heading/paragraph/bullet_list/table만 순회하므로 `repeating_section` 케이스 추가 필요).

### 5. `createStyledDocx` 확장

`repeating_section` 블록 처리 추가 (Step 0에 정의한 3단계: `{{#loopName}}` 전용 Paragraph → 내부 blocks 렌더링(기존 heading/paragraph 케이스 재사용) → `{{/loopName}}` 전용 Paragraph). `{{#loopName}}`/`{{/loopName}}`은 반드시 각각 독립된 Paragraph/TextRun에 담는다 — 다른 텍스트와 같은 TextRun에 섞으면 안 된다.

## Acceptance Criteria

```bash
npx tsc --noEmit --pretty false
```
- [ ] `lib/client-template-generator.ts`에 `generateTemplateFromSample`, `buildAnalyzePrompt`가 export/정의되어 있다
- [ ] `RepeatingSectionBlock` 타입이 `TemplateBlock` 유니온에 포함되어 있다
- [ ] 기존 `generateTemplateDocx` export 시그니처가 변경되지 않았다 (하위 호환)
- [ ] `npx tsc --noEmit`이 이 phase 이전과 동일한 결과(기존 무관 에러 1건 제외 클린)를 낸다
- [ ] 실제 검증: WG7 Recommendations 예시 문서(`/Users/whyun/내 드라이브/국제표준화/JTC 1 SC 6/26-07-WG 7/Output/OD-250328-SC6-WG7-N484-Recommendations.docx`)의 텍스트를 `lib/server/extract-text.ts`로 뽑아 `generateTemplateFromSample`을 직접 호출했을 때, 결과 docx가 `recommendations`라는 loop key 하나로 14개 recommendation을 표현하는지 (즉 블록이 14번 반복되지 않는지) 수동 확인

## 검증 절차

1. `npx tsc --noEmit --pretty false` — 클린 확인
2. 임시 스크립트로 `generateTemplateFromSample` 직접 호출 → 결과 docx를 `lib/server/extract-placeholders.ts`의 `extractPlaceholders`로 검증 → `recommendations` 키가 `isLoop: true`이고 fields가 존재하는지 확인
3. 기존 웹 UI 경로(`generateTemplateDocx`, userRequest 모드)가 시그니처/동작 그대로인지 diff로 확인
4. `phases/0-docx-to-template/index.json`에서 step1 status를 `completed`로 갱신

## 금지사항

- 기존 `generateTemplateDocx`/`buildPrompt`/`createStyledDocx`의 **기존 케이스** 동작을 변경하지 않는다 (추가만).
- `components/template-upload.tsx` 등 UI 코드를 수정하지 않는다 (이 step 범위 아님).
- OpenAI strict schema에서 `required` 누락으로 런타임 에러가 나지 않도록, 새로 추가하는 모든 필드를 기존 패턴과 동일하게 `required` 배열에 포함한다.
