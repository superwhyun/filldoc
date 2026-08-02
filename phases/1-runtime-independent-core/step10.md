# Step 10: phase-reclose

## 배경

Step 6~9로 리뷰가 지적한 blocking issue(workspace 설치 가능성, core 계약/export
불일치, 웹·CLI 중복 template builder, coverage 미강제/PDF·loop·web 회귀 부재)를
모두 해소했다. Phase 1을 다시 마감한다.

## 읽어야 할 파일

- `phases/1-runtime-independent-core/index.json`, `step6.md`~`step9.md`
- `docs/modules/document-core/MODULE.md`

## 모듈 할당

- module: `document-core`
- owned_paths:
  - `phases/index.json`
  - `phases/1-runtime-independent-core/index.json`
  - `phases/baselines/1-runtime-independent-core.json`
  - `phases/project-manifest.json` (신규)
  - `phases/1-runtime-independent-core/step10.md`
- forbidden_paths: 구현 코드 전체 (이번 step은 마감 전용, 코드 변경 없음)

## 작업

1. 전체 검증(`pnpm exec tsc --noEmit --pretty false`, `pnpm test`, `pnpm lint`)을 재실행해 Step 6~9의 누적 결과가 여전히 통과하는지 최종 확인한다.
2. `phases/baselines/1-runtime-independent-core.json`을 Step 9까지 반영한 최신 public export/route/known_issues로 다시 쓴다 (기존 파일은 review 이전, 최초 phase-close 시점의 stale 버전이었다).
3. `phases/project-manifest.json`을 신설해 phase별 baseline 위치와 상태를 추적한다 (이전에 없었음).
4. `phases/index.json`의 `1-runtime-independent-core` 항목을 `completed`로 되돌린다.
5. `git tag RepGen-phase1-done`을 남긴다.

## 계약 및 베이스라인

- 이 step은 코드 변경 없이 검증·문서화·태깅만 한다.

## Acceptance Criteria

- [ ] `pnpm exec tsc --noEmit --pretty false` 통과.
- [ ] `pnpm test`(coverage 포함) 통과.
- [ ] `pnpm lint`에 새 error 없음.
- [ ] `phases/index.json`의 Phase 1 상태가 `completed`.
- [ ] `phases/baselines/1-runtime-independent-core.json`이 Step 9까지의 실제 상태를 반영.
- [ ] `git tag RepGen-phase1-done`이 존재.

## 검증 절차

1. `pnpm exec tsc --noEmit --pretty false`
2. `pnpm test`
3. `pnpm lint`
4. `git tag -l | grep RepGen-phase1-done`

## 검증 결과

- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm test` → 7 files / 36 tests 통과, coverage 80% threshold 통과.
- `pnpm lint` → 0 errors.
- baseline/manifest 갱신, `phases/index.json` Phase 1 `completed`로 갱신.
- `git tag RepGen-phase1-done` 생성.

## 금지사항

- 이 step에서 새 기능이나 리팩터링을 추가하지 않는다 (범위: 마감 문서화와 태깅뿐).
