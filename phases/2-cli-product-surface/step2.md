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

## 실행 결과

1. `apps/cli/build.mjs`(esbuild) 신설: `apps/cli/src/*.ts` 8개 entry를 `dist/*.js`로 번들링한다. 진짜 npm 배포 패키지(`docx`, `docxtemplater`, `pizzip`, `pdf-parse`, `openai`, `@ai-sdk/xai`, `ai`)만 external로 남기고, monorepo-internal 소스(`packages/core/src/*`, `lib/server/*`, `lib/client-template-generator.ts`)는 번들에 인라인한다.
   - 시행착오: entry 소스에 이미 `#!/usr/bin/env node` shebang이 있는데 esbuild `banner`로 또 추가해서 shebang이 중복돼 `SyntaxError`가 났다 — `banner` 옵션을 제거해 해결.
2. `apps/cli/package.json`을 pack 가능한 최종 형태로 갱신: `files: ["dist"]`, `bin`이 `dist/*.js`를 가리킴, `engines.node >= 22`, production `dependencies`에 core/legacy provider가 실제 쓰는 npm 패키지만 나열, `devDependencies.esbuild`.
3. root `package.json`과 `packages/core/package.json`에도 `engines.node >= 22`를 추가해 workspace 전체에 Node 버전 정책을 명시했다.
4. `pnpm install --frozen-lockfile` 통과 확인 후, 루트의 기존 npm `package-lock.json`을 제거했다 (`git rm -f`).
5. `.gitignore`에 `apps/cli/dist`(빌드 산출물) 추가.

### AC 검증

- [x] `pnpm install --frozen-lockfile`이 통과한다.
- [x] `pnpm --filter @repgen/cli pack --pack-destination <temp>`가 성공한다.
- [x] tarball manifest에 Next/React/UI 의존성 및 repo source가 포함되지 않는다.
- [x] 깨끗한 임시 프로젝트에서 packed CLI를 설치하고 `--version`을 실행할 수 있다.

### 검증 로그

- `pnpm install --frozen-lockfile` → `Scope: all 3 workspace projects` / `Already up to date`.
- `pnpm --filter @repgen/cli pack --pack-destination <temp>` → `repgen-cli-0.1.0.tgz` 생성. Tarball Contents: `dist/*.js`(8개) + `package.json`뿐 — repo 소스 없음.
- tarball 내 `package.json`의 `dependencies`에 `next`/`react`/`radix`/`tailwind` 문자열 grep 결과 없음(`description` 필드 오탐 제외 시 0건).
- 새 임시 디렉터리에 `npm init -y && npm install <tarball>` → 81 packages 설치, Next/React 없음(`node_modules`에서 grep 확인).
- 설치된 `./node_modules/.bin/repgen --version` → `0.1.0`, exit 0.
- 설치된 `./node_modules/.bin/repgen-extract-doc`, `repgen-build-template`를 fixture로 실행 → 정상 stdout JSON, exit 0.
- `pnpm build`(Next production build) → 여전히 성공(패키지 경계 변경이 web 빌드에 영향 없음 확인).
- `pnpm exec tsc --noEmit --pretty false` / `pnpm test`(coverage 80% threshold) / `pnpm lint` → 모두 통과, Phase 1 수치와 동일(핵심 로직 무변경).
