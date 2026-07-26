# Step 0: bootstrap-and-contract

## 읽어야 할 파일

- `/AGENTS.md`
- `/docs/HARNESS.md` (하네스 프레임워크 저장소 쪽; RepGen에는 사본 없음 — 개념만 참고)
- `lib/client-template-generator.ts` — 기존 "자연어 요청 → 템플릿 생성" 파이프라인 전체 (재사용 대상)
- `lib/server/extract-text.ts` — docx/pdf/txt 텍스트 추출 (재사용 대상)
- `.skills/filldoc/SKILL.md` — 기존 filldoc 스킬 문서 구조

## 모듈 할당

- module: `template-analyzer`
- owned_paths:
  - `docs/modules/template-analyzer/MODULE.md` (신규)
  - `docs/modules/registry.json` (신규)
  - `phases/0-docx-to-template/module-map.json` (ref 채우기)
- read_contracts:
  - `lib/client-template-generator.ts`의 `generateTemplateDocx` export 시그니처
  - `lib/server/extract-text.ts`의 `extractTextFromBuffer` export 시그니처
- forbidden_paths:
  - 실제 구현 코드 (`lib/client-template-generator.ts` 내부 수정은 Step 1에서)
  - `scripts/` (Step 2)

## 계약 및 베이스라인

- 이 phase는 RepGen 최초의 harness phase다. 의존할 이전 baseline이 없다.
- 기존 웹 UI의 "AI 템플릿 생성"(`components/template-upload.tsx` → `generateTemplateDocx`)은 **절대 깨뜨리지 않는다** — 새 기능은 같은 파일에 추가만 한다.

## 작업

### 1. 기능 정의 (public contract 초안)

**목표**: 실제로 작성된 예시 문서(.docx)를 주면, 그 문서의 구조를 분석해서 재사용 가능한 RepGen 템플릿(.docx, `{{placeholder}}` 포함)을 만들어주는 CLI/스킬 기능을 추가한다.

**재사용 전략**: `lib/client-template-generator.ts`가 이미 가진 파이프라인(프롬프트 → structured JSON → 충돌 키 정규화 → docx 빌드)을 그대로 쓴다. 다른 건 "무엇을 프롬프트로 주는가"뿐이다.
- 기존: `buildPrompt(userRequest, templateName)` — 사용자가 말로 설명한 요구사항
- 신규: `buildAnalyzePrompt(sourceText, templateName)` — 실제 예시 문서에서 추출한 텍스트

**신규 블록 타입 (`repeating_section`)**: 기존 `TemplateBlock` 유니온(heading/paragraph/bullet_list/table/spacer)에는 "표가 아닌, 문단이 여러 번 반복되는 구간"(예: WG 회의록의 Recommendation WG7.1 ~ WG7.14처럼 heading+paragraph 블록이 N번 반복)을 표현할 방법이 없다. 이를 위해 추가:
```ts
type RepeatingSectionBlock = {
  type: "repeating_section"
  loopName: string          // snake_case, {{#loopName}}로 쓰임
  description?: string
  blocks: Array<{ type: "heading" | "paragraph"; level?: 1 | 2 | 3; text: string }>
}
```
`text`에는 반복 안에서 쓰이는 일반 필드 placeholder(`{{no}}`, `{{title}}`, `{{body}}` 등, dot 표기 아님)를 포함한다. `createStyledDocx`는 이 블록을 만나면:
1. `{{#loopName}}` 문자열만 담은 별도 Paragraph를 하나 추가 (다른 텍스트와 절대 같은 Paragraph/TextRun에 섞지 않는다 — 표 안에서 `<w:t>` 문자열 매칭이 깨졌던 기존 버그와 같은 클래스의 문제를 원천 차단하기 위함)
2. `blocks`를 기존 heading/paragraph 렌더링 로직으로 그대로 렌더링
3. `{{/loopName}}` 문자열만 담은 별도 Paragraph를 추가

이렇게 하면 `{{#loopName}}`/`{{/loopName}}`이 항상 자기 완결적인 하나의 `<w:t>` 안에 들어가므로, docxtemplater의 loop pairing이 안전하게 동작한다 (표 안 dot-notation을 위한 `preProcessXml`의 정규식 서핑 같은 위험한 문자열 삽입이 필요 없음).

**신규 함수**: `generateTemplateFromSample({ provider, apiKey, sourceText, templateName }): Promise<{ file: File; spec: TemplateGenerationJson }>` — `generateTemplateDocx`와 동일한 파이프라인이되 `buildAnalyzePrompt`를 사용.

**CLI 계약 (Step 2에서 구현, 여기서는 인터페이스만 확정)**:
```
repgen-analyze-doc --source <예시.docx> --output <새템플릿.docx> [--provider openai|grok] [--api-key <key>] [--template-name <이름>]
```
`--source`는 실제로 채워진 예시 문서, `--output`은 결과 템플릿 저장 경로. AI 키 필요 (OPENAI_API_KEY/XAI_API_KEY 또는 --api-key).

### 2. `docs/modules/registry.json` 생성

```json
{
  "schema_version": 1,
  "project": "RepGen",
  "updated_at": null,
  "modules": {
    "template-analyzer": {
      "persona": "template-analyzer",
      "version": "1.0.0",
      "status": "planned",
      "children": [],
      "module_doc": "docs/modules/template-analyzer/MODULE.md"
    }
  }
}
```

### 3. `docs/modules/template-analyzer/MODULE.md` 작성

Contract 섹션에 위 "신규 함수"/"신규 블록 타입"/"CLI 계약"을 그대로 옮겨 적는다 (MODULE.md.tmpl 형식 준수, status: planned).

### 4. `phases/0-docx-to-template/module-map.json` 갱신

`modules[0].ref`(`docs/modules/bootstrap-and-contract/MODULE.md`)를 `docs/modules/template-analyzer/MODULE.md`로 통일하고, 나머지 step(1~4)의 owner_steps는 전부 이 하나의 모듈에 귀속시킨다 (이 phase는 모듈이 사실상 1개, step만 여러 개). `integration_points`에 다음을 채운다:
```json
"integration_points": [
  "lib/client-template-generator.ts: generateTemplateFromSample (신규 export, generateTemplateDocx와 병행)",
  "lib/server/extract-text.ts: extractTextFromBuffer (기존, 그대로 재사용)",
  ".skills/filldoc/templates/ (= template/ symlink): 생성된 템플릿 저장 위치"
]
```

## Acceptance Criteria

- [ ] `docs/modules/registry.json`이 존재하고 `template-analyzer` 모듈이 등록되어 있다
- [ ] `docs/modules/template-analyzer/MODULE.md`가 존재하고 Contract 섹션에 `generateTemplateFromSample` 시그니처, `RepeatingSectionBlock` 타입, CLI 인자 계약이 명시되어 있다
- [ ] `phases/0-docx-to-template/module-map.json`의 `ref` 경로가 실제로 존재하는 파일을 가리킨다
- [ ] placeholder(`{replace-with-...}`)가 남아 있지 않다
- [ ] 기존 `lib/client-template-generator.ts`, `components/template-upload.tsx`는 이 step에서 전혀 수정하지 않는다 (계약 설계만, 구현은 Step 1)

## 검증 절차

1. `docs/modules/registry.json`, `docs/modules/template-analyzer/MODULE.md` 존재 및 내용 확인
2. `phases/0-docx-to-template/module-map.json`의 ref 경로 실제 존재 확인
3. `phases/0-docx-to-template/index.json`에서 step0 status를 `completed`로 갱신

## 금지사항

- 이 step에서 실제 구현 코드(`lib/client-template-generator.ts` 등)를 건드리지 않는다 — 계약/설계 문서만 작성한다.
- 기존 웹 UI의 AI 템플릿 생성 흐름을 변경하지 않는다.
