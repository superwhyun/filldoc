---
name: filldoc
description: Build, extend, and debug filldoc features that fill user templates with structured data. Use when tasks involve template upload/parsing, placeholder mapping, preview generation, fill APIs, validation rules, error handling, or export output for template+data workflows.
---

# FillDoc

Implement and improve end-to-end template filling in filldoc with safe, incremental changes and clear verification.

## Workflow

1. Confirm scope and constraints
- Keep existing working behavior intact.
- Clarify input template format, expected output format, and data schema assumptions.

2. Trace the current flow before editing
- Locate upload, parsing, mapping, fill execution, preview, and export code paths.
- Document the exact request/response shapes and where validation occurs.

3. Apply minimal, reversible changes
- Prefer surgical edits over broad refactors.
- Preserve existing naming and project conventions.
- Keep user-facing errors clear and developer logs actionable.

4. Validate the fill behavior
- Run lint/build commands relevant to the changed area.
- Verify happy path: template + valid data -> correct filled output.
- Verify failure paths: missing placeholders, malformed data, unsupported template type.

5. Report outcomes clearly
- Summarize touched files and behavior changes.
- Call out remaining edge cases and follow-up items.

## Implementation Rules

- Keep template parsing and field mapping deterministic.
- Normalize placeholder keys before matching.
- Fail fast on schema mismatch with explicit messages.
- Avoid hidden defaults that silently drop fields.
- Preserve backward compatibility for existing template payloads unless explicitly asked to break it.

## Output Contract Checklist

Before finishing, confirm:
- Input template is accepted or rejected with a clear reason.
- Data-to-placeholder mapping is visible and debuggable.
- Filled output preserves template structure and formatting constraints.
- API and UI expose consistent error semantics.

## CLI (브라우저/Next 서버 없이, 어디서든 실행)

아래 7개 커맨드가 전역에 설치되어 있으면 **어느 작업 디렉토리에서든** 저장소 위치를 몰라도 바로 쓸 수 있다 (`cd`도, `npm --prefix`도 필요 없음):

- `filldoc-extract-doc` — 템플릿의 placeholder 목록 조회 (AI 키 불필요)
- `filldoc-render-doc` — 이미 정해진 값으로 템플릿 렌더링 (AI 키 불필요)
- `filldoc-fill-doc` — 원본 자료를 주고 filldoc 자체 AI로 채우기 (OpenAI/Grok 키 필요)
- `filldoc-extract-text` — 임의 문서(.docx/.pdf/.txt/.md)에서 순수 텍스트만 추출 (AI 키 불필요)
- `filldoc-templatize-doc` — 예시 문서의 원본 서식(폰트/스타일)을 유지한 채 템플릿으로 변환 (AI 키 불필요, 예시 문서가 있을 때 기본)
- `filldoc-build-template` — 예시 문서 없이 템플릿 스펙(JSON)만으로 docx를 새로 조립 (AI 키 불필요)
- `filldoc-analyze-doc` — 예시 문서를 filldoc 자체 AI에 통째로 넘겨 템플릿 생성 (OpenAI/Grok 키 필요, 보통 안 씀)

모든 명령이 공유하는 unified alias `filldoc <subcommand> [...args]`도 있다 (예: `filldoc extract-doc --template ...`).
`filldoc --version`으로 버전만 확인할 수도 있다.

### 오류 처리 (exit code)

성공은 항상 exit `0`이고, 성공 결과 JSON은 stdout에만 출력된다. 실패는 원인에 따라 exit code가 갈린다 (자세한 표는 `docs/modules/cli-surface/MODULE.md` 참고):

| code | 의미 | 예시 |
| --- | --- | --- |
| `2` | 인자 누락/오형식, 지정한 입력 파일을 찾거나 읽을 수 없음 | `--template` 누락, 파일 경로 오타 |
| `3` | 처리 오류 | 템플릿 문법 오류, 렌더링에 필요한 값 누락(`--allow-partial` 없이), edit target 미발견, JSON 파싱 실패 |
| `4` | provider/credential 오류 (`fill-doc`/`analyze-doc`만 해당) | API 키 없음/오류 |

오류 메시지는 항상 stderr에 `오류: <메시지>` 형태로 출력된다. 스크립트에서 결과를 파싱할 때는 stdout만 읽으면 된다.

### 설치 (새 환경, 권장)

CLI는 `apps/cli`(Next/React 등 웹 의존성이 전혀 없는 독립 패키지, 의존성 7개, 루트 저장소 대비 훨씬 가볍다)에 있다. npm/pnpm은 git URL에서 서브디렉터리만 골라 설치하는 기능을 지원하지 않으므로, 저장소를 clone한 뒤 `apps/cli`에서 전역 설치한다:

```bash
git clone https://github.com/superwhyun/filldoc.git
cd filldoc/apps/cli
npm install       # 의존성 설치 + esbuild로 dist/*.js 번들 생성 (prepare 스크립트)
npm install -g .  # dist/*.js를 전역 filldoc-* 커맨드로 심볼릭 링크
```

**두 명령 다 실행해야 한다.** `npm install -g .`만 단독 실행하면 `apps/cli/node_modules`가 아직 없어서 `prepare` 빌드 스크립트가 `esbuild`를 찾지 못해 실패한다(`ERR_MODULE_NOT_FOUND`). 이후 새 버전으로 갱신하고 싶으면 `git pull` 후 같은 두 명령을 다시 실행하면 된다.

### 설치 (이 저장소를 로컬에서 개발/디버깅할 때)

이미 로컬에 clone해서 작업 중인 저장소라면 `apps/cli`에서 `npm link`로 연결해도 된다:

```bash
cd <REPO_ROOT>/apps/cli && npm install && npm link
```

아래 예시의 `<REPO_ROOT>`는 filldoc 저장소를 clone한 절대경로를 뜻한다 (이 `SKILL.md` 파일 경로에서 `.skills/filldoc/SKILL.md` 부분을 뗀 나머지). git 설치본을 쓴다면 이 경로 대신 npm이 전역에 설치한 패키지 경로(`npm root -g`/`filldoc-cli`)를 쓰면 된다.

템플릿 경로는 항상 절대경로를 쓴다: `<REPO_ROOT>/.skills/filldoc/templates/<파일명>.docx`

### 0) 템플릿 목록 조회 / 추가

템플릿은 `.skills/filldoc/templates/`(= 저장소 루트 `template/`의 심볼릭 링크, 즉 완전히 같은 폴더)에 둔다. 웹 UI의 "서버 템플릿" 목록도 같은 폴더를 보므로 여기 저장한 템플릿은 웹/스킬 양쪽에서 바로 보인다.

- "지원하는 템플릿 뭐 있어?" 같은 요청을 받으면 이 폴더를 나열해서 답한다:
  ```bash
  ls <REPO_ROOT>/.skills/filldoc/templates/*.docx
  ```
- "템플릿 하나 만들어서 추가해줘" 같은 요청을 받으면, 새로 만든 `.docx`를 이 폴더 안에 저장한다(별도로 복사해둘 필요 없음 — 심볼릭 링크라 한 번만 저장하면 양쪽에 다 반영됨).

### 0.5) 원하는 템플릿이 없을 때 — 예시 문서로 새 템플릿 만들기, 원본 서식 유지 (권장, AI 키 불필요)

사용자가 "이 문서 형식대로 템플릿 만들어줘" 또는 이미 채워진 문서를 예시로 주면서 "이런 문서 또 만들 수 있게 템플릿화해줘"라고 요청하면 이 경로를 쓴다. 호출하는 에이전트 자신이 이미 LLM이므로 filldoc이 또 OpenAI/Grok을 호출할 필요가 없고, **원본 파일을 그대로 열어서 바뀌는 부분만 치환**하기 때문에 폰트/크기/굵게/밑줄/정렬 등 원본 서식이 그대로 유지된다 (완전히 새로 그리는 게 아님).

```bash
# 1단계: 예시 문서에서 텍스트만 뽑아서 읽기 (AI 키 불필요) — .docx는 직접 못 읽으므로 이걸로 내용 확인
filldoc-extract-text --file ./예시-회의록.docx

# 2단계: 에이전트가 원문을 읽고 "어떤 문단을 뭘로 바꿀지" edits를 직접 만든 뒤 적용 (AI 키 불필요)
filldoc-templatize-doc \
  --source ./예시-회의록.docx \
  --edits ./edits.json \
  --output <REPO_ROOT>/.skills/filldoc/templates/새템플릿.docx
```

`edits.json` 형태:
```json
[
  { "type": "replace", "match": "SC 6/WG 7 N484",
    "runs": [{ "text": "{{doc_number:문서 번호, 예: SC 6/WG 7 N484}}" }] },
  { "type": "replace", "match": "Title:",
    "runs": [{ "text": "Title:" }, { "tab": true }, { "text": "{{doc_title:...}}" }] },
  { "type": "insert-paragraph", "anchorMatch": "Recommendation WG7.1", "position": "before",
    "runs": [{ "text": "{{#recommendations}}" }] },
  { "type": "replace", "match": "Recommendation WG7.1",
    "runs": [{ "text": "Recommendation {{no}}" }, { "tab": true }, { "text": "{{title}}" }] },
  { "type": "replace", "match": "SC 6 experts interested in the following incoming",
    "runs": [{ "text": "{{body}}" }] },
  { "type": "insert-paragraph", "anchorMatch": "SC 6 experts interested in the following incoming", "position": "after",
    "runs": [{ "text": "{{/recommendations}}" }] },
  { "type": "delete-range", "fromMatch": "SC 6 N18437", "toMatch": "China National Body" }
]
```

- `match`/`fromMatch`/`toMatch`/`anchorMatch`는 원문 문단에 포함된 부분 문자열이면 된다 (`filldoc-extract-text` 출력에서 그대로 가져다 쓰면 됨). 문서 순서상 처음 매칭되는 문단을 사용하며, 매칭은 항상 원본 문서 기준이라 edits 순서와 무관하다.
- `replace`: 매칭된 문단 내용을 통째로 교체한다. 문단 서식(`pPr`)과 첫 run의 문자 서식(`rPr` — 폰트/크기/굵게 등)은 원본 그대로 유지되고 텍스트만 바뀐다. 탭으로 라벨과 값이 나뉜 문단(`Title:<tab>값`)은 `runs`를 label/tab/value 3개로 나눠 적는다.
- `delete-range`: `fromMatch`가 있는 문단부터 (그 이후 처음 나오는) `toMatch`가 있는 문단까지 통째로 삭제한다. **반복되는 항목(예: recommendation 2~14)은 첫 번째만 loop로 남기고 나머지 전부와, 첫 번째 항목의 부가 세부사항(하위 불릿 등)까지 이 delete-range로 지운다.**
- `insert-paragraph`: 앵커 문단 앞/뒤에 태그 전용 새 문단을 끼워 넣는다. **여러 문단에 걸친 loop 시작/끝 태그(`{{#x}}`/`{{/x}}`)는 반드시 이 타입으로 별도 문단에 넣어야 한다.** `replace`의 runs에 다른 텍스트와 같이 섞으면 docxtemplater가 반복 사이 문단 구분(줄바꿈)을 없애버려서 항목들이 한 문단으로 붙어버린다 — 실제로 겪은 버그이니 반드시 이 패턴을 따른다.
- `--edits` 대신 `--edits-json '<json string>'`도 가능(짧을 때만 권장, 보통은 파일 방식이 안전).
- 성공 시 stdout에 `{ output, placeholderCount, templateValid }` JSON을 출력. `templateValid: false`면 loop 짝(`{{#x}}`/`{{/x}}`) 문제 등이 있다는 뜻.
- 생성 직후 `filldoc-extract-doc`으로 placeholder 목록을, 필요하면 실제로 파일을 열어서(`open <path>`) 서식이 원본과 맞는지 확인한다.

### 0.6) 참고할 예시 문서가 없을 때 — 스펙만으로 템플릿을 처음부터 새로 만들기

참고할 실제 문서가 없어서 원본 서식을 유지할 게 없는 경우(완전히 새로운 형식을 만드는 경우)에만 이 경로를 쓴다. 원본이 있다면 0.5)를 쓴다 — 이쪽은 `docx` 라이브러리로 문서를 새로 그리기 때문에 서식이 filldoc 기본 스타일로 나온다.

```bash
filldoc-build-template \
  --spec ./spec.json \
  --output <REPO_ROOT>/.skills/filldoc/templates/새템플릿.docx
```

`spec.json` 형태 (TemplateGenerationJson, `lib/client-template-generator.ts`):
```json
{
  "title": "문서 제목",
  "blocks": [
    { "type": "paragraph", "text": "{{doc_number:문서 번호, 원문 예시 참고}}" },
    {
      "type": "repeating_section",
      "loopName": "recommendations",
      "blocks": [
        { "type": "heading", "level": 2, "text": "Recommendation {{no}}" },
        { "type": "paragraph", "text": "{{title}}" },
        { "type": "paragraph", "text": "{{body}}" }
      ]
    }
  ]
}
```

- `blocks` 타입: `heading | paragraph | bullet_list | table | spacer | repeating_section`. 표가 아닌 문단 구조가 반복되면 `repeating_section`(loopName + blocks, **반복 횟수만큼 복제하지 말고 1회분만** 작성), 표 형태 반복은 `table` + `{{parent.field}}` dot 표기.
- `--spec` 대신 `--spec-json '<json string>'`도 가능.
- 성공 시 stdout에 `{ output, placeholderCount, templateValid }` JSON을 출력.

### 0.7) filldoc 자체 AI로 예시 문서를 분석시키고 싶을 때 (선택, 보통 안 씀)

에이전트가 직접 분석하지 않고 원본 문서만 던져서 filldoc이 알아서(OpenAI/Grok으로) 템플릿 구조를 추론하게 하고 싶을 때만 사용. 이 경로도 `build-template`과 마찬가지로 문서를 새로 그리므로 원본 서식은 유지되지 않는다.

```bash
OPENAI_API_KEY=sk-... filldoc-analyze-doc \
  --source ./예시-회의록.docx \
  --output <REPO_ROOT>/.skills/filldoc/templates/새템플릿.docx \
  --provider openai
```

성공 시 stdout에 `{ output, placeholderCount, repeatingSectionKeys, tableLoopKeys, templateValid }` JSON을 출력한다.

### 1) Hermes 같은 AI 에이전트가 호출할 때 (권장, API 키 불필요)

호출하는 에이전트 자신이 이미 LLM이므로, filldoc이 다시 OpenAI/Grok을 호출할 필요가 없다. **값 채우기는 에이전트가 직접 하고, filldoc은 템플릿에 값을 끼워넣기만 한다.**

```bash
# 1단계: 템플릿에 어떤 placeholder가 있는지 확인 (AI 키 불필요)
filldoc-extract-doc --template <REPO_ROOT>/.skills/filldoc/templates/template-basic.docx
# -> { "placeholders": [{ "key": "title", "description": "...", "isLoop": true, "fields": [...] }, ...] }

# 2단계: 에이전트가 스스로 값을 채워서 렌더링 (AI 키 불필요)
filldoc-render-doc \
  --template <REPO_ROOT>/.skills/filldoc/templates/template-basic.docx \
  --data-json '{"title":"...", "tasks":[{"no":"1","name":"...","owner":"...","due":"..."}]}' \
  --output ./filled.docx
```

- `render-doc`의 데이터 형식: 일반 placeholder는 문자열, loop(`isLoop: true`) placeholder는 `fields`를 key로 갖는 객체의 배열.
- `--data-json` 대신 `--data <values.json 경로>`로 파일을 넘겨도 된다 (값이 길거나 이스케이핑이 걱정되면 이쪽을 권장).
- **템플릿이 요구하는 key인데 데이터에 없으면 기본적으로 렌더링하지 않고 exit code 3으로 중단한다** (어떤 key가 빠졌는지 stderr에 나열). 이건 "이 값을 모른다"는 신호이니, 사용자에게 물어본 뒤 값을 채워서 다시 호출한다. 정말로 비워둬도 되는 경우에만 `--allow-partial`을 추가해서 빈 값으로 진행한다.
- 성공 시 stdout에 `{ output, filledKeys }` JSON을 출력.

### 2) filldoc 자체 AI 호출로 채울 때 (원본 자료를 그대로 넘기고 싶을 때)

호출자가 값을 직접 결정하지 않고, 원본 문서/텍스트만 주고 filldoc이 OpenAI(file_search)/Grok으로 placeholder를 채우게 하고 싶을 때 사용. `extract-placeholders` → `fill-placeholders` → `generate-document`를 한 번에 실행.

```bash
OPENAI_API_KEY=sk-... filldoc-fill-doc \
  --template <REPO_ROOT>/.skills/filldoc/templates/template-basic.docx \
  --data ./minutes.docx,./notes.txt \
  --output ./filled.docx \
  --provider openai
```

옵션:
- `--template` : placeholder가 포함된 `.docx` 템플릿 경로 (필수)
- `--data` : 참고 자료 파일 경로, 콤마로 구분. `.txt`/`.md`/`.docx`/`.pdf` 혼합 가능 (필수)
- `--output` : 결과 `.docx` 저장 경로 (필수)
- `--provider` : `openai`(기본값) 또는 `grok`
- `--api-key` : 생략 시 `OPENAI_API_KEY`(openai) / `XAI_API_KEY`(grok) 환경변수 사용

성공 시 stdout에 `{ output, provider, usedFileSearch, usedFallback, evidenceCount, placeholderCount, unresolvedKeys }` 형태의 JSON 요약을 출력한다. 실패 시 원인 메시지를 stderr에 출력하고 원인별 exit code로 종료한다: 인자/파일 경로 오류는 `2`, 템플릿 문법 오류 등 처리 오류는 `3`, API 키 누락/오류는 `4`.

**`unresolvedKeys`**: AI가 근거 자료에서 값을 찾지 못한 필드 목록(빈 값으로 채워짐, 지어내지 않음). 이 목록이 비어있지 않으면, 그 값들을 사용자에게 물어본 뒤 `render-doc`으로 해당 key만 다시 채워 넣는다(전체를 `data-json`에 담아 `render-doc`을 재호출하면 됨).

### 참고: 저장소 안에서 개발/디버깅할 때

`npm run extract-doc -- ...` / `npm run render-doc -- ...` / `npm run fill-doc -- ...` / `npm run extract-text -- ...` / `npm run templatize-doc -- ...` / `npm run build-template -- ...` / `npm run analyze-doc -- ...` (저장소 루트에서, `tsx`로 실행)도 그대로 남아있다. 전역 커맨드(`filldoc-*`)와 완전히 동일한 코드를 실행한다.

## References

- filldoc project conventions: `<REPO_ROOT>/AGENTS.md`
