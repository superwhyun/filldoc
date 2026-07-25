---
name: filldoc
description: Build, extend, and debug RepGen features that fill user templates with structured data. Use when tasks involve template upload/parsing, placeholder mapping, preview generation, fill APIs, validation rules, error handling, or export output for template+data workflows.
---

# FillDoc

Implement and improve end-to-end template filling in RepGen with safe, incremental changes and clear verification.

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

RepGen 저장소가 `npm link`로 전역에 연결되어 있어, **어느 작업 디렉토리에서든** 저장소를 몰라도 아래 커맨드를 바로 쓸 수 있다 (`cd`도, `npm --prefix`도 필요 없음):

- `repgen-extract-doc` — 템플릿의 placeholder 목록 조회 (AI 키 불필요)
- `repgen-render-doc` — 이미 정해진 값으로 템플릿 렌더링 (AI 키 불필요)
- `repgen-fill-doc` — 원본 자료를 주고 RepGen 자체 AI로 채우기 (OpenAI/Grok 키 필요)

(연결이 끊겼거나 새 환경이면 저장소에서 `npm link` 한 번 다시 실행하면 됨: `cd /Users/whyun/workspace/SERVICE/RepGen && npm link`)

템플릿 경로는 항상 절대경로를 쓴다: `/Users/whyun/workspace/SERVICE/RepGen/.skills/filldoc/templates/<파일명>.docx`

### 0) 템플릿 목록 조회 / 추가

템플릿은 `.skills/filldoc/templates/`(= 저장소 루트 `template/`의 심볼릭 링크, 즉 완전히 같은 폴더)에 둔다. 웹 UI의 "서버 템플릿" 목록도 같은 폴더를 보므로 여기 저장한 템플릿은 웹/스킬 양쪽에서 바로 보인다.

- "지원하는 템플릿 뭐 있어?" 같은 요청을 받으면 이 폴더를 나열해서 답한다:
  ```bash
  ls /Users/whyun/workspace/SERVICE/RepGen/.skills/filldoc/templates/*.docx
  ```
- "템플릿 하나 만들어서 추가해줘" 같은 요청을 받으면, 새로 만든 `.docx`를 이 폴더 안에 저장한다(별도로 복사해둘 필요 없음 — 심볼릭 링크라 한 번만 저장하면 양쪽에 다 반영됨).

### 1) Hermes 같은 AI 에이전트가 호출할 때 (권장, API 키 불필요)

호출하는 에이전트 자신이 이미 LLM이므로, RepGen이 다시 OpenAI/Grok을 호출할 필요가 없다. **값 채우기는 에이전트가 직접 하고, RepGen은 템플릿에 값을 끼워넣기만 한다.**

```bash
# 1단계: 템플릿에 어떤 placeholder가 있는지 확인 (AI 키 불필요)
repgen-extract-doc --template /Users/whyun/workspace/SERVICE/RepGen/.skills/filldoc/templates/template-basic.docx
# -> { "placeholders": [{ "key": "title", "description": "...", "isLoop": true, "fields": [...] }, ...] }

# 2단계: 에이전트가 스스로 값을 채워서 렌더링 (AI 키 불필요)
repgen-render-doc \
  --template /Users/whyun/workspace/SERVICE/RepGen/.skills/filldoc/templates/template-basic.docx \
  --data-json '{"title":"...", "tasks":[{"no":"1","name":"...","owner":"...","due":"..."}]}' \
  --output ./filled.docx
```

- `render-doc`의 데이터 형식: 일반 placeholder는 문자열, loop(`isLoop: true`) placeholder는 `fields`를 key로 갖는 객체의 배열.
- `--data-json` 대신 `--data <values.json 경로>`로 파일을 넘겨도 된다 (값이 길거나 이스케이핑이 걱정되면 이쪽을 권장).
- **템플릿이 요구하는 key인데 데이터에 없으면 기본적으로 렌더링하지 않고 exit code 1로 중단한다** (어떤 key가 빠졌는지 stderr에 나열). 이건 "이 값을 모른다"는 신호이니, 사용자에게 물어본 뒤 값을 채워서 다시 호출한다. 정말로 비워둬도 되는 경우에만 `--allow-partial`을 추가해서 빈 값으로 진행한다.
- 성공 시 stdout에 `{ output, filledKeys }` JSON을 출력.

### 2) RepGen 자체 AI 호출로 채울 때 (원본 자료를 그대로 넘기고 싶을 때)

호출자가 값을 직접 결정하지 않고, 원본 문서/텍스트만 주고 RepGen이 OpenAI(file_search)/Grok으로 placeholder를 채우게 하고 싶을 때 사용. `extract-placeholders` → `fill-placeholders` → `generate-document`를 한 번에 실행.

```bash
OPENAI_API_KEY=sk-... repgen-fill-doc \
  --template /Users/whyun/workspace/SERVICE/RepGen/.skills/filldoc/templates/template-basic.docx \
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

성공 시 stdout에 `{ output, provider, usedFileSearch, usedFallback, evidenceCount, placeholderCount, unresolvedKeys }` 형태의 JSON 요약을 출력한다. 실패 시 exit code 1과 함께 원인 메시지를 stderr에 출력한다(템플릿 문법 오류, 데이터 파일 읽기 실패, API 키 누락/오류 등 웹 API와 동일한 메시지 체계).

**`unresolvedKeys`**: AI가 근거 자료에서 값을 찾지 못한 필드 목록(빈 값으로 채워짐, 지어내지 않음). 이 목록이 비어있지 않으면, 그 값들을 사용자에게 물어본 뒤 `render-doc`으로 해당 key만 다시 채워 넣는다(전체를 `data-json`에 담아 `render-doc`을 재호출하면 됨).

### 참고: 저장소 안에서 개발/디버깅할 때

`npm run extract-doc -- ...` / `npm run render-doc -- ...` / `npm run fill-doc -- ...` (저장소 루트에서, `tsx`로 실행)도 그대로 남아있다. 전역 커맨드(`repgen-*`)와 완전히 동일한 코드를 실행한다.

## References

- RepGen project conventions: `/Users/whyun/workspace/SERVICE/RepGen/AGENTS.md`
