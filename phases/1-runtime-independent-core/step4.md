# Step 4: blocking-fix-test-foundation

## 읽어야 할 파일

- `AGENTS.md`, `goal.json`, `docs/modules/document-core/MODULE.md`
- `phases/1-runtime-independent-core/index.json`, `step1.md`, `step2.md`
- 현재 `lib/server/{extract-placeholders,extract-text,generate-document,templatize-document}.ts`

## 모듈 할당

- module: `document-core`
- owned_paths:
  - `package.json`, lockfile, Vitest configuration
  - `tests/document-core/**`, fixture files
  - `phases/1-runtime-independent-core/index.json`
- read_contracts:
  - `docs/modules/document-core/MODULE.md`
- forbidden_paths:
  - production `lib/`, `scripts/`, `app/`, `components/` source

## 계약 및 베이스라인

- 이 step은 production behavior를 변경하지 않는다. 현재 구현을 기준으로 characterization test를 먼저 고정한다.
- 테스트는 network/API key 없이 실행하며, 테스트 runner는 Vitest다.
- 이 step이 통과하면 Step 1을 `pending`으로 복구한다. Step 2는 coverage와 실패 경로를 확장하는 역할로 유지한다.

## 작업

1. Vitest와 `pnpm test` script를 추가한다.
2. 최소 DOCX fixture를 생성·관리해 placeholder extract, strict render data, dot-loop render, templatize, text extract의 현재 성공 결과를 test로 고정한다.
3. fixture는 소스 제어 가능하고 결정적이어야 하며 provider를 호출하지 않는다.

## Acceptance Criteria

- [ ] `pnpm test`가 네트워크/API 키 없이 통과한다.
- [ ] core public contract의 각 기본 operation에 최소 한 개의 characterization test가 있다.
- [ ] 테스트는 현재 legacy output의 관찰 가능한 동작을 고정하며 production source를 수정하지 않는다.
- [ ] Step 1 status가 `pending`으로 복구된다.

## 검증 절차

1. 새 테스트를 현재 구현에 대해 RED 없이 통과시키는 characterization baseline으로 확인한다.
2. `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit --pretty false`를 실행한다.
3. 변경 경로가 owned_paths 안에 있는지 확인하고 Phase index 상태를 갱신한다.

## 금지사항

- core implementation, CLI contract, 웹 UI를 수정하지 않는다.
- provider 호출 또는 live credential을 테스트에 넣지 않는다.
