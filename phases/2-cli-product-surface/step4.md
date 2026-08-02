# Step 4: phase-close

## 읽어야 할 파일

- `goal.json`, `docs/modules/cli-surface/MODULE.md`, 모든 Phase 2 verification result

## 모듈 할당

- module: `cli-surface`
- owned_paths: module/registry metadata, `phases/baselines/2-cli-product-surface.json`, phase status files
- forbidden_paths: production behavior

## 계약 및 베이스라인

- Phase 3은 CLI/core public contract만 소비하며 CLI 내부 구현을 재탐색하지 않는다.

## 작업

검증 결과와 install artifact 정보, legacy wrapper 제거 조건, 보류한 BYOK 요구를 baseline에 기록한다.

## Acceptance Criteria

- [ ] goal auto checks와 packed CLI E2E가 통과한다.
- [ ] baseline이 public command contract와 Phase 3 adapter 입력을 기록한다.

## 검증 절차

1. 모든 required check를 재실행한다.
2. phase validator를 실행하고 상태를 완료로 갱신한다.

## 금지사항

- live publish 또는 legacy wrapper 제거를 하지 않는다.
