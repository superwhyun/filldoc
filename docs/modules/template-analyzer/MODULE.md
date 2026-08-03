---
id: template-analyzer
version: 1.3.0
parent: none
persona: template-analyzer
status: implemented
contract_version: 1.3.0
---

# template-analyzer

예시로 작성된 실제 .docx 문서를 기반으로, 그 문서와 같은 형식을 반복해서 채워 쓸 수 있는 filldoc 템플릿(.docx, `{{placeholder}}` 포함)을 생성한다.

**v1.1 변경**: 최초 설계(v1.0)는 filldoc이 예시 문서를 자체 AI(OpenAI/Grok)로 분석하는 `generateTemplateFromSample`/`filldoc-analyze-doc` 하나뿐이었다. 호출하는 에이전트(Hermes 등) 자신이 이미 LLM이므로, filldoc이 또 AI를 호출할 필요가 없다는 게 밝혀져(`fill-doc`을 `extract-doc`+`render-doc`으로 쪼갠 것과 같은 이유) 에이전트가 직접 분석해서 스펙을 만들고 filldoc은 조립만 하는 AI-키-불필요 경로(`buildTemplateFromSpec`/`filldoc-build-template`)를 추가했다.

**v1.2 변경**: `buildTemplateFromSpec`은 `docx` 라이브러리로 문서를 처음부터 새로 그리기 때문에 원본 문서의 폰트/스타일이 전혀 반영되지 않는다는 문제가 실사용 중 확인됐다. 예시 문서가 있는 경우를 위해, **원본 docx의 XML을 직접 열어 문단 서식(`pPr`)과 문자 서식(`rPr`)은 그대로 두고 텍스트만 치환/삭제**하는 `templatizeDocument`/`filldoc-templatize-doc`을 추가하고 이걸 기본 경로로 승격했다. `buildTemplateFromSpec`/`filldoc-build-template`은 삭제하지 않고 "참고할 원본이 없어 새로 만드는 경우"용으로 유지한다.

**v1.3 변경(버그 수정)**: v1.2에서 여러 문단에 걸친 루프(`{{#x}}`...`{{/x}}`)를 만들 때 시작/끝 태그를 내용 문단의 `replace` runs에 섞어 넣었더니, docxtemplater의 `paragraphLoop`가 반복 사이 문단 구분(줄바꿈)을 없애버려 반복 항목들이 한 문단으로 붙어버리는 문제가 실사용 중 발견됨. `TemplatizeEdit`에 `insert-paragraph` 타입을 추가해서, 루프 태그는 반드시 앵커 문단 앞/뒤에 별도의 "태그 전용 문단"으로 끼워 넣도록 수정 (`lib/client-template-generator.ts`의 `repeating_section` 렌더링이 처음부터 쓰던 것과 동일한, 검증된 패턴).

## Contract

### Inputs / Exports

`lib/server/templatize-document.ts` (신규, 기본 경로 — AI 키 불필요, 원본 서식 유지):
```ts
export type TemplatizeRun = { text: string } | { tab: true }
export type TemplatizeEdit =
  | { type: "replace"; match: string; runs: TemplatizeRun[] }
  | { type: "delete-range"; fromMatch: string; toMatch: string }
  | { type: "insert-paragraph"; anchorMatch: string; position: "before" | "after"; runs: TemplatizeRun[] }

export function templatizeDocument(originalBuffer: Buffer, edits: TemplatizeEdit[]): Buffer
```
- `match`/`fromMatch`/`toMatch`/`anchorMatch`: 문단의 태그 제거 텍스트에 대한 부분 문자열(includes), 문서 순서상 첫 매칭 사용. 매칭은 항상 원본 문서 기준이라 edits 순서와 무관.
- `replace`: 매칭된 문단을 첫 번째 run의 `rPr`을 재사용한 새 run들로 교체 (`pPr`은 원본 그대로).
- `delete-range`: `fromMatch` 문단부터 그 이후 첫 `toMatch` 문단까지 통째로 삭제. 반복 항목 중 1개만 남기고 나머지를 지울 때 사용.
- `insert-paragraph`: 앵커 문단 앞/뒤에 태그 전용 새 문단을 끼워 넣는다. **여러 문단에 걸친 loop 태그(`{{#x}}`/`{{/x}}`)는 반드시 이 타입으로 별도 문단에 넣어야 한다** — `replace`의 runs에 다른 텍스트와 섞으면 docxtemplater의 `paragraphLoop`가 반복 사이 문단 구분을 없애버려 항목들이 붙어버린다(v1.2의 버그, v1.3에서 수정).

`lib/client-template-generator.ts` (기존 v1.1 유지, 참고할 원본이 없을 때용):
```ts
export type TemplateBlock =
  | { type: "heading"; level?: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullet_list"; items: string[] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "spacer"; lines?: number }
  | { type: "repeating_section"; loopName: string; blocks: Array<{ type: "heading" | "paragraph"; level?: 1 | 2 | 3; text: string }> }

export type TemplateGenerationJson = { fileName?: string; title?: string; subtitle?: string; blocks: TemplateBlock[] }

export async function buildTemplateFromSpec(spec: TemplateGenerationJson, templateName?: string): Promise<{ file: File; spec: TemplateGenerationJson }>

// 보조 경로 (AI 키 필요) — filldoc이 자체 AI로 예시 문서를 분석, 서식은 유지 안 됨
function buildAnalyzePrompt(sourceText: string, templateName?: string): string
export async function generateTemplateFromSample(input: {
  provider: TemplateAIProvider; apiKey: string; sourceText: string; templateName?: string
}): Promise<{ file: File; spec: TemplateGenerationJson }>
```

`{{#loopName}}`/`{{/loopName}}`은 각각 독립된 run/문단에만 렌더링한다 (다른 텍스트와 절대 같은 run에 섞지 않음 — `<w:t>` 경계 밖 삽입 버그 클래스 회피).

CLI (기본, AI 키 불필요, 원본 서식 유지):
```
filldoc-extract-text --file <임의문서.docx|.pdf|.txt|.md>
# -> stdout: 순수 텍스트

filldoc-templatize-doc --source <원본.docx> (--edits <edits.json> | --edits-json '<json>') --output <새템플릿.docx>
# -> stdout: { output, placeholderCount, templateValid, templateValidationError? }
```

CLI (원본 없이 새로 만들 때, AI 키 불필요):
```
filldoc-build-template (--spec <spec.json> | --spec-json '<json>') --output <새템플릿.docx> [--template-name <이름>]
# -> stdout: { output, placeholderCount, templateValid, templateValidationError? }
```

CLI (보조, AI 키 필요, 서식 유지 안 됨):
```
filldoc-analyze-doc --source <예시.docx> --output <새템플릿.docx> [--provider openai|grok] [--api-key <key>] [--template-name <이름>]
# -> stdout: { output, placeholderCount, repeatingSectionKeys, tableLoopKeys, templateValid, templateValidationError? }
```

### Errors
- 소스/스펙/edits 파일 읽기 실패, JSON 파싱 실패: 명확한 한국어 메시지 + exit 1
- `templatize-doc`: `match`/`fromMatch`/`toMatch`에 해당하는 문단을 못 찾으면 `TemplatizeError` + exit 1
- API 키 누락(`analyze-doc`만): 기존 `fill-doc.ts`의 `resolveApiKey`와 동일한 에러 메시지 패턴
- AI 응답 파싱 실패(`analyze-doc`만): 기존 `parseGenerationJson`의 에러 재사용
- 생성된 템플릿이 문법 검증 실패 시: exit 0이지만 stdout `templateValid: false` + stderr 경고 (렌더링까지는 막지 않되 눈에 띄게 알림)

### Dependencies
- upstream: 없음 (filldoc 최초 모듈)
- downstream: 없음

## Autonomy
- 내부 구현: 자유 (단, 기존 `generateTemplateDocx`/`buildPrompt`/`createStyledDocx`/`buildTemplateFromSpec`의 기존 동작은 변경 금지 — 추가만)
- Contract 변경: 필요하면 `contract-change` step으로 승격, 별도 협의 대상 없음 (단일 모듈)
- 타 모듈 MODULE.md: 없음 (filldoc 최초 모듈)

## 검증 이력
- 실제 문서(SC 6/WG 7 N484 Draft Recommendations, recommendation 14개)로:
  - v1.1: `filldoc-extract-text` → (에이전트가 스펙 작성) → `filldoc-build-template` → `filldoc-extract-doc` → `filldoc-render-doc`(14개 전량) 왕복 성공. 단 원본 서식 미반영 확인(문제로 지적됨).
  - v1.2: `filldoc-extract-text` → (에이전트가 edits 작성) → `filldoc-templatize-doc` → `filldoc-extract-doc` → `filldoc-render-doc`(14개 전량) 왕복 성공. 원본 폰트/사이즈/굵게/밑줄/정렬 유지 확인 (실제 파일 열어서 육안 확인). 단 loop 태그를 replace runs에 섞어서 반복 항목들이 한 문단으로 붙어버리는 버그 발견(사용자가 렌더링 결과 스크린샷으로 지적).
  - v1.3: `insert-paragraph`로 loop 태그를 별도 문단으로 분리 후 동일 문서로 재검증 — 14개 recommendation이 각각 독립된 문단(제목/본문 분리)으로 정상 렌더링됨을 raw XML 및 실제 파일로 확인. 완전히 다른 구조의 문서(WG7 N599 Agenda, 안건 13개 + Annex 표)로 "억지 매핑" 시나리오도 정상 렌더링 확인.
