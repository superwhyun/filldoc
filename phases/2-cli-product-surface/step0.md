# Step 0: cli-contract

## 읽어야 할 파일

- `goal.json`, `phases/baselines/1-runtime-independent-core.json`
- `docs/modules/document-core/MODULE.md`, `package.json`, 기존 `scripts/*.ts`
- `phases/2-cli-product-surface/module-map.json`

## 모듈 할당

- module: `cli-surface`
- owned_paths: `docs/modules/cli-surface/MODULE.md`, `docs/modules/registry.json`, `phases/2-cli-product-surface/module-map.json`
- read_contracts: `docs/modules/document-core/MODULE.md`
- forbidden_paths: production CLI/core/web source

## 계약 및 베이스라인

- 대상 배치는 pnpm workspace의 `packages/core`, `packages/providers`(legacy fill-doc 전용), `apps/cli`, `apps/web`다.
- CLI는 Node 22 이상, 파일 경로/표준 입출력/환경변수만 어댑트한다.
- 성공 결과는 stdout JSON, 진단은 stderr, exit code는 `0` 성공·`2` 인자/입력 오류·`3` 처리 오류·`4` provider/credential 오류로 고정한다.

## 작업

기존 7개 `repgen-*` 명령의 인자와 결과를 표로 고정한다. AI-agent 기본 흐름은 `extract-doc/extract-text → agent 판단 → render-doc`이며 API 키를 요구하지 않는다. 새 command manifest와 `--json`, `--help`, `--version` 정책을 기록하고, 키 우선순위는 legacy `fill-doc`에만 기록한다.

## Acceptance Criteria

- [ ] 7개 명령의 legacy 인자/출력/오류 호환성 표가 있다.
- [ ] agent 기본 흐름(`extract`, `render`, `templatize`, `build-template`)이 network/provider 없이 가능하다고 명시된다.
- [ ] module-map과 registry ref가 실제 module 문서를 가리킨다.

## 검증 절차

1. 기존 scripts의 parse/출력 동작을 문서와 대조한다.
2. module-map ref를 확인하고 phase validator를 실행한다.

## 금지사항

- 이 단계에서 명령 동작 또는 package configuration을 변경하지 않는다.
