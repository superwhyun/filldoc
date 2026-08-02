# Step 3: phase-close

## 읽어야 할 파일

- `goal.json`, `docs/modules/document-core/MODULE.md`
- `phases/1-runtime-independent-core/module-map.json`
- Step 0–2 verification results

## 모듈 할당

- module: `document-core`
- owned_paths: `docs/modules/document-core/MODULE.md`, `docs/modules/registry.json`, `phases/baselines/1-runtime-independent-core.json`, phase status files
- forbidden_paths: production behavior changes

## 계약 및 베이스라인

- 이 step은 production 구현을 바꾸지 않는다.
- baseline은 Phase 2가 재탐색하지 않고 CLI 전환을 시작할 수 있을 정도의 public surface를 제공한다.

## 작업

모든 auto check와 core boundary audit를 재실행하고, 모듈 문서·registry·baseline·phase 상태를 마감한다.

## Acceptance Criteria

- [ ] 모든 Phase 1 auto check가 통과한다.
- [ ] baseline은 public API, legacy shim, test command, Phase 2에 남은 책임을 기록한다.
- [ ] Phase 1 status만 `completed`로 변경한다.

## 검증 절차

1. `goal.json`의 auto_checks를 실행한다.
2. phase validator를 실행한다.
3. baseline을 검토하고 phase/step status를 갱신한다.

## 금지사항

- 기능 추가나 contract 변경을 섞지 않는다.
