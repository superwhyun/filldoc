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

## 실행 결과

Step 0~3 완료 후 Phase 리뷰 게이트(2회, `phases/2-cli-product-surface/step5.md`에 1회차 finding과 수정 기록)를 통과한 뒤 최종 검증을 재실행하고 `phases/baselines/2-cli-product-surface.json`을 작성했다.

- `pnpm lint` → 0 errors.
- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm test`(coverage 포함, packed CLI E2E 포함) → 8 files / **45 tests** 통과, coverage 80% threshold 통과.
- baseline에 기록한 내용: public command contract(7개 명령 + unified alias + exit code 표), package boundary 검증(pack/install/lockfile/engines), Phase 3 adapter 입력(exit code 원칙, BYOK 패턴, 미이관 legacy provider 위치), legacy wrapper 제거 조건, known issues(fake-provider mocking 범위, typed error code 미구현, packages/providers 미추출), review gate 결과.
- `phases/index.json`의 `1-runtime-independent-core` → `2-cli-product-surface`를 `completed`로 갱신.
- `phases/project-manifest.json`에 Phase 2 항목 추가.
- `git tag RepGen-phase2-done` 생성.

### AC 검증

- [x] goal auto checks와 packed CLI E2E가 통과한다.
- [x] baseline이 public command contract와 Phase 3 adapter 입력을 기록한다.
