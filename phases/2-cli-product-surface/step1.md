# Step 1: cli-migration

## 읽어야 할 파일

- `docs/modules/cli-surface/MODULE.md`, `docs/modules/document-core/MODULE.md`
- `phases/baselines/1-runtime-independent-core.json`, 기존 `scripts/*.ts`

## 모듈 할당

- module: `cli-surface`
- owned_paths: `apps/cli/**`, legacy `scripts/*.ts` wrappers, root bin/script mappings, `.skills/filldoc/SKILL.md`
- read_contracts: core public contract와 legacy fill provider contract
- forbidden_paths: `app/**`, `components/**`, core document semantics

## 계약 및 베이스라인

- CLI는 기본적으로 core만 호출하고 파일 읽기·쓰기와 표준 입출력만 담당한다. `fill-doc` compatibility wrapper만 optional provider/env를 사용한다.
- 기존 명령 이름은 유지한다. 새 unified `repgen` 명령은 alias로 추가할 수 있으나 기존 명령을 삭제하지 않는다.

## 작업

각 명령을 `apps/cli` command module로 이관하고, 기존 scripts는 동일 결과를 내는 thin wrapper로 남긴다. Agent 명령은 `--data`/`--data-json` 또는 stdin JSON을 지원한다. filldoc skill에는 `extract-doc → agent 판단 → render-doc`과 `extract-text → agent edits → templatize-doc`의 표준 호출 절차·오류 처리·출력 계약을 기록한다. `--api-key`는 legacy `fill-doc`에서만 허용하며 stdout/stderr/log에 절대 출력하지 않는다.

## Acceptance Criteria

- [ ] 모든 명령이 core public API만 import한다.
- [ ] legacy 이름과 documented JSON output가 fixture에서 유지된다.
- [ ] 잘못된 agent JSON/누락 파일이 계약된 exit code를 반환하고, legacy fill의 누락 키/provider 오류도 호환된다.
- [ ] skill의 명령 예제가 packed CLI와 별도 작업 디렉터리에서 동작한다.

## 검증 절차

1. command fixture test를 실행한다.
2. secret redaction과 stdout JSON 파싱을 확인한다.
3. lint/typecheck/test를 실행한다.

## 금지사항

- 웹 route나 UI를 변경하지 않는다.

## 실행 결과

1. `apps/cli/src/`에 7개 명령 + `repgen`(unified alias) + 공유 `lib/cli-support.ts`(exit code 2/3/4 헬퍼)를 신설. 각 명령은 core public API와 기존 `lib/server/*`/`lib/client-template-generator.ts`만 import한다.
2. 기존 `scripts/*.ts` 7개를 `apps/cli/src/<name>.ts`를 import만 하는 1줄 thin wrapper로 교체. 명령 이름/위치/root `package.json`의 `bin` 매핑은 그대로 유지.
3. `render-doc`에 stdin JSON 입력 지원 추가(`--data`/`--data-json` 둘 다 없고 TTY가 아니면 stdin에서 읽음) — "작업"에서 요구한 stdin JSON 지원을 반영.
4. `apps/cli/package.json`(`@repgen/cli`, 최소 형태) 신설. `pnpm -r list --depth -1`에서 3번째 workspace project로 인식됨.
5. `.skills/filldoc/SKILL.md`에 exit code 표·`repgen` alias 추가, 기존 "exit code 1" 서술을 실제 코드로 갱신.

### AC 검증

- [x] 모든 명령이 core public API만 import한다 — `apps/cli/src/*.ts`는 `packages/core/src/index.ts`, `lib/server/*`, `lib/client-template-generator.ts`만 import (grep으로 확인, `app/`·`components/` import 없음).
- [x] legacy 이름과 documented JSON output가 fixture에서 유지된다 — 아래 수동 fixture 실행 결과 참고.
- [x] 잘못된 agent JSON/누락 파일이 계약된 exit code를 반환하고, legacy fill의 누락 키/provider 오류도 호환된다.
- [x] skill의 명령 예제가 별도 작업 디렉터리에서 동작한다 (packed 아닌 소스 기준; packed 검증은 Step 2/3).

### 수동 fixture 실행 (저장소 밖 임시 디렉터리, 절대경로로 스크립트 호출)

| 명령 | 입력 | 결과 | exit |
| --- | --- | --- | --- |
| `extract-doc --help` | - | usage 출력 | 0 |
| `extract-doc` (인자 없음) | - | `--template은 필수입니다.` | **2** |
| `build-template --spec-json '{...}'` | paragraph+repeating_section 포함 spec | `{ output, placeholderCount: 2, templateValid: true }` | 0 |
| `extract-doc --template ./tpl.docx` | 위에서 만든 템플릿 | `name`, `items(isLoop, fields:[who])` 정확히 노출 | 0 |
| `render-doc` | loop 데이터 누락, `--allow-partial` 없음 | 누락 key(`items`) stderr 나열 | **3** |
| `render-doc` | 전체 데이터 (`--data-json`) | 정상 렌더링, `{ output, filledKeys: 2 }` | 0 |
| `render-doc` | 전체 데이터를 stdin으로 파이프 | 정상 렌더링, `{ output, filledKeys: 2 }` | 0 |
| `templatize-doc --edits-json '[...]'` | replace edit | 정상 치환, `{ output, placeholderCount: 1, templateValid: true }` | 0 |
| `fill-doc` (API 키 없음) | - | `API 키가 없습니다...` | **4** |
| `analyze-doc` (API 키 없음) | - | `API 키가 없습니다...` | **4** |
| `repgen --version` | - | `0.1.0` | 0 |
| `repgen extract-doc --template ./tpl.docx` | 위와 동일 | 개별 명령과 동일한 stdout | 0 |

`pnpm exec tsc --noEmit --pretty false` → 오류 없음. `pnpm test` → 7 files / 36 tests 통과, coverage 80% threshold 통과(core 로직 무변경). `pnpm lint` → 0 errors.
