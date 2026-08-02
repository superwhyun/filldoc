# Step 6: blocking-fix-workspace-package

## 배경

Phase 1 review에서 `packages/core`가 pnpm workspace member로 인식되지 않고,
런타임 의존성(docx/docxtemplater/pdf-parse/pizzip)이 package.json에 선언되지 않아
"설치 가능한 패키지"가 아니라는 blocking issue가 발견됨.

## 읽어야 할 파일

- `pnpm-workspace.yaml`, `packages/core/package.json`
- `phases/baselines/0-docx-to-template.json` (기존 install/전역 노출 계약)

## 모듈 할당

- module: `document-core`
- owned_paths:
  - `pnpm-workspace.yaml`
  - `packages/core/package.json`
  - `.gitignore`
  - `phases/1-runtime-independent-core/index.json`
  - `phases/1-runtime-independent-core/module-map.json`
- forbidden_paths: `app/`, `components/`, `scripts/`의 구현 파일, core 소스 로직

## 작업

1. `pnpm-workspace.yaml`에 `packages: ["packages/*", "apps/*"]`를 선언해 `packages/core`를 실제 workspace member로 등록한다.
2. `packages/core/package.json`에 core가 실제로 import하는 런타임 의존성(`docx`, `docxtemplater`, `pdf-parse`, `pizzip`)을 선언해 root hoisting에 암묵적으로 의존하지 않게 한다.
3. `.gitignore`의 `/node_modules`가 루트만 무시하고 workspace 하위 패키지의 `node_modules`(`packages/core/node_modules`)는 무시하지 못하던 문제를 `node_modules`(anchor 제거)로 고친다.

## 계약 및 베이스라인

- 소비자(`lib/server/generate-document.ts`, `scripts/*.ts`)의 import 경로(`packages/core/src/*.ts` 상대 경로)는 이번 step에서 바꾸지 않는다. `@repgen/core` 패키지명으로의 전환은 범위 밖.
- Phase 0의 `bin.repgen-*` 전역 노출 계약은 유지한다.

## Acceptance Criteria

- [ ] `pnpm install`이 루트에서 오류 없이 완료되고 `Scope: all 2 workspace projects`로 `packages/core`를 인식한다.
- [ ] `pnpm -r list --depth -1`에 `@repgen/core`가 별도 workspace project로 나온다.
- [ ] `packages/core/node_modules`에 `docx`, `docxtemplater`, `pdf-parse`, `pizzip`이 실제로 존재한다.
- [ ] `pnpm exec tsc --noEmit --pretty false` 통과.
- [ ] `pnpm test` 통과.
- [ ] `pnpm lint`에 새 error 없음.
- [ ] `git status --porcelain`에 `packages/core/node_modules`가 untracked로 나타나지 않는다.

## 검증 절차

1. `pnpm install` 실행 후 workspace 인식 확인.
2. `pnpm exec tsc --noEmit --pretty false`, `pnpm test`, `pnpm lint` 순서로 실행.
3. `git status --porcelain`으로 `.gitignore` 수정이 `node_modules` 누출을 막는지 확인.

## 검증 결과

- `pnpm install` → `Scope: all 2 workspace projects` / `Already up to date`.
- `pnpm -r list --depth -1` → `repgen@0.1.0`, `@repgen/core` 두 프로젝트 확인.
- `packages/core/node_modules` → `docx`, `docxtemplater`, `pdf-parse`, `pizzip` 존재 확인.
- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm test` → 3 files / 24 tests 통과.
- `pnpm lint` → 0 errors (기존 `coverage/`, `eslint.config.mjs` warning만 존재, 이번 변경과 무관).
- `.gitignore` 수정 후 `git status --porcelain`에 `packages/core/node_modules` 미노출 확인.

## 금지사항

- core 소스의 런타임 동작을 바꾸지 않는다 (types/index export 이외 로직 무변경).
- `@repgen/core` 패키지 소비 방식 전환은 이번 step에서 하지 않는다 (후속 phase 범위).
