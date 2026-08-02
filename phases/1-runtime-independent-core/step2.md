# Step 2: core-regression-tests

## 읽어야 할 파일

- `goal.json`, `docs/modules/document-core/MODULE.md`
- Step 1 baseline의 public API와 기존 template fixtures

## 모듈 할당

- module: `document-core`
- owned_paths: `packages/core/**/*.test.ts`, test runner/configuration, test fixtures
- read_contracts: `docs/modules/document-core/MODULE.md`
- forbidden_paths: web UI, CLI contract change

## 계약 및 베이스라인

- 테스트는 core의 public API와 agent JSON fixture만 사용한다.
- 이전 CLI 성공 계약은 Phase 2에서 별도 검증한다.

## 작업

core public API를 대상으로 placeholder 단일값·dot-loop·명시 loop, 누락값, 손상 DOCX, 지원하지 않는 소스와 template validation을 테스트한다. 테스트는 네트워크/API 키 없이 결정적으로 실행한다.

## Acceptance Criteria

- [ ] 테스트는 core만 import하며 Next 서버가 필요 없다.
- [ ] 각 public operation의 성공과 주요 실패 케이스가 있다.
- [ ] `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit --pretty false`가 통과한다.

## 검증 절차

1. 새 테스트가 네트워크 없이 실행되는지 확인한다.
2. auto check를 실행한다.
3. 실패 시 fixture/contract 불일치를 좁혀 수정하고 step status를 갱신한다.

## 금지사항

- 실 API 호출을 테스트에 넣지 않는다.
