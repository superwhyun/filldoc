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
