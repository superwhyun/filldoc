---
id: cli-surface
version: 0.1.0
parent: none
persona: cli-surface
status: implemented
contract_version: 0.1.0
---

# cli-surface

filldoc의 `filldoc-*` 명령들을 공식 제품 인터페이스로 고정한다. CLI는 파일 경로,
표준 입출력, 환경변수만 다루는 어댑터이며 문서 처리 규칙은 `document-core`
([document-core MODULE.md](../document-core/MODULE.md))에만 있다. AI provider 호출은
`filldoc-fill-doc`/`filldoc-analyze-doc`에 한정된 legacy 선택 기능이다.

## Contract

### Runtime boundary

- 대상 배치는 pnpm workspace의 `packages/core`(문서 엔진), `apps/cli`(이 모듈),
  `apps/web`(Phase 3), 그리고 legacy AI 호출 코드(`lib/server/fill-placeholders.ts`,
  `lib/client-template-generator.ts`)다. `packages/providers`로의 추가 추출은 이번
  phase 범위 밖이며, cli-surface는 위 legacy 코드를 그대로 소비한다.
- CLI는 Node 22 이상에서 실행되고, `node:fs`/`node:path`/표준 입출력/환경변수만
  어댑트한다. document 처리 로직을 CLI가 직접 구현하지 않는다.
- 성공 결과는 stdout에 JSON으로 출력한다(`filldoc-extract-text`, `filldoc-fill-doc`의
  경고 로그 등 예외는 표 참고). 진단/경고/에러는 stderr에만 출력한다.
- **Exit code 정책 (신규 계약, Step 1에서 구현)**:
  | code | 의미 |
  | --- | --- |
  | `0` | 성공 |
  | `2` | 인자 누락/오형식, 지정한 입력 파일을 찾거나 읽을 수 없음 |
  | `3` | 처리 오류 (손상된 문서, 템플릿 문법 오류, edit target 미발견, JSON 파싱 실패 등) |
  | `4` | provider/credential 오류 (`fill-doc`/`analyze-doc`에서만 발생) |

  기존 모든 명령은 오류 시 `process.exit(1)` 하나로 뭉뚱그려져 있었다 — Step 1에서
  공유 `CliUsageError`(2)/`CliProcessingError`(3)/`CliProviderError`(4) 타입과 공통
  `runCli()` 래퍼로 통일한다. 메시지 문구와 stdout 성공 JSON 스키마는 바꾸지 않는다.

### 명령 인벤토리 (legacy 호환성 표)

| 명령 | 필수 인자 | 성공 stdout | 실패 시 | AI 키 |
| --- | --- | --- | --- | --- |
| `filldoc-extract-doc` | `--template <.docx>` | `{ placeholders: [{key, description?, isLoop?, fields?}] }` | 문법 오류 → stderr 목록, exit ≠0 | 불필요 |
| `filldoc-extract-text` | `--file <.docx\|.pdf\|.txt\|.md>` | 텍스트 그대로 (JSON 아님) | 미지원/빈 내용/손상 → stderr, exit ≠0 | 불필요 |
| `filldoc-render-doc` | `--template`, (`--data` \| `--data-json`), `--output`, `--allow-partial`? | `{ output, filledKeys }` | 누락 값 기본 차단(`--allow-partial`로 우회), 잘못된 입력 → stderr, exit ≠0 | 불필요 |
| `filldoc-templatize-doc` | `--source`, (`--edits` \| `--edits-json`), `--output` | `{ output, placeholderCount, templateValid, templateValidationError? }` | edit target 미발견/JSON 오류 → stderr, exit ≠0 | 불필요 |
| `filldoc-build-template` | (`--spec` \| `--spec-json`), `--output`, `--template-name`? | `{ output, placeholderCount, templateValid, templateValidationError? }` | 스펙/JSON 오류 → stderr, exit ≠0 | 불필요 |
| `filldoc-analyze-doc` | `--source`, `--output`, `--provider`?, `--api-key`?, `--template-name`? | `{ output, placeholderCount, repeatingSectionKeys, tableLoopKeys, templateValid, ... }` | 소스 읽기/AI 응답 파싱/provider 오류 → stderr, exit ≠0 | 필요 (`--api-key` 또는 `OPENAI_API_KEY`/`XAI_API_KEY`) |
| `filldoc-fill-doc` | `--template`, `--data <file1,file2,...>`, `--output`, `--provider`?, `--api-key`? | `{ output, provider, usedFileSearch, usedFallback, fallbackReason, evidenceCount, placeholderCount, unresolvedKeys }` | 템플릿 문법/provider/입력 오류 → stderr, exit ≠0 | 필요 (`--api-key` 또는 `OPENAI_API_KEY`/`XAI_API_KEY`) |

### AI-agent 기본 흐름 (키 불필요)

```text
filldoc-extract-doc(template.docx) -> { placeholders }
filldoc-extract-text(source) -> text
agent가 값 또는 edits를 직접 판단
filldoc-render-doc(template, data) -> filled.docx
filldoc-templatize-doc(source, edits) -> template.docx
filldoc-build-template(spec) -> template.docx
```

위 4개 명령(`extract-doc`, `extract-text`, `render-doc`, `templatize-doc`) +
`build-template`은 네트워크나 provider 없이 동작한다. `analyze-doc`/`fill-doc`만
API 키를 요구하는 legacy 경로다.

### 키 우선순위 (legacy `fill-doc`/`analyze-doc`에만 적용)

1. `--api-key` 플래그
2. `--provider openai`면 `OPENAI_API_KEY`, `--provider grok`면 `XAI_API_KEY`
3. 없으면 exit `4`, stderr에 필요한 환경변수 이름 안내

키는 stdout/로그/생성 파일에 절대 포함하지 않는다.

### `--json`/`--help`/`--version` 정책 (신규, Step 1에서 구현)

- 모든 명령은 `--help`를 지원해 `printUsage()` 내용을 stdout에 출력하고 exit `0`.
- `apps/cli`는 `filldoc --version`(unified alias) 하나로 패키지 버전을 stdout에 출력한다.
- 개별 `filldoc-*` 명령은 이미 성공 시 JSON을 stdout에 출력하므로 별도 `--json` 플래그는
  두지 않는다 (기존 동작 유지, 새 플래그 추가로 인한 계약 변경 없음).

### Dependencies

- upstream: `document-core` (packages/core)
- downstream: 없음 (최종 소비자는 사람 또는 외부 AI 에이전트)
- optional: `lib/server/fill-placeholders.ts`, `lib/client-template-generator.ts` (legacy AI provider 호출, `fill-doc`/`analyze-doc` 전용)

## Autonomy

- 내부 구현: 공개 명령 이름·인자·stdout 스키마·exit code 정책을 지키는 범위에서 자유.
- Contract 변경: Phase 2에서 `contract-change` step을 append하고 Phase 3 web-adapter가
  같은 exit code/에러 분류 원칙을 참고하게 한다.
- 타 모듈 MODULE.md: 읽기만, 수정 금지.
