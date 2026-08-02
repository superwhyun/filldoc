# Step 2: package-boundary

## 읽어야 할 파일

- `goal.json`, `docs/modules/cli-surface/MODULE.md`
- root `package.json`, lockfile, `apps/cli/package.json`, `packages/*/package.json`

## 모듈 할당

- module: `cli-surface`
- owned_paths: workspace manifests, `pnpm-workspace.yaml`, package exports/bin/files configuration, root scripts
- read_contracts: cli and core MODULE.md
- forbidden_paths: CLI command semantics, web behavior

## 계약 및 베이스라인

- 패키지 매니저는 pnpm 하나로 통일한다. Node 22 이상을 engines로 명시한다.
- CLI publish/install artifact에는 Next, React, Tailwind, Radix가 포함되지 않는다.

## 작업

workspace와 workspace protocol 의존성을 구성하고, CLI package의 `files`, `bin`, production dependencies를 최소화한다. `pnpm pack` 결과를 검사한다. root의 기존 npm lockfile은 pnpm lockfile 생성이 성공한 뒤에만 제거한다.

## Acceptance Criteria

- [ ] `pnpm install --frozen-lockfile`이 통과한다.
- [ ] `pnpm --filter @repgen/cli pack --pack-destination <temp>`가 성공한다.
- [ ] tarball manifest에 Next/React/UI 의존성 및 repo source가 포함되지 않는다.
- [ ] 깨끗한 임시 프로젝트에서 packed CLI를 설치하고 `--version`을 실행할 수 있다.

## 검증 절차

1. pack artifact의 package.json과 파일 목록을 검사한다.
2. 임시 디렉터리 설치·실행을 자동화해 실행한다.
3. lockfile과 root scripts의 일관성을 확인한다.

## 금지사항

- publish, global install, 기존 package-lock 삭제는 명시적 검증 전 수행하지 않는다.
