# Step 7: review-fix-npm-git-install-prepare-script

## 읽어야 할 파일

- `apps/cli/package.json`, `apps/cli/build.mjs`
- `.gitignore`

## 배경

Phase 2가 마감(`RepGen-phase2-done`)된 뒤, 사용자가 외부 배포 시나리오(`npm install`로
설치해 AI 에이전트가 skill로 사용)를 확인하는 과정에서 재리뷰를 수행했다.

- `apps/cli/dist/*.js`는 빌드 산출물이라 `.gitignore`에 등록돼 있어 git에 커밋되지 않는다.
- `apps/cli/package.json`의 `bin` 필드는 전부 `./dist/*.js`를 가리키는데, `scripts`에는
  `"build"`만 있고 `"prepare"`가 없었다.
- npm/pnpm이 git URL(`git+https://...#branch:apps/cli` 형태 포함)에서 패키지를 설치할 때
  `dist`처럼 커밋되지 않은 빌드 산출물을 만들어내는 유일한 공식 경로는 설치 중 자동 실행되는
  `prepare` 생명주기 스크립트다. 이게 없으면 `npm install -g "git+...#main:apps/cli"`는
  클론은 성공하지만 `dist/`가 없는 채로 끝나 `bin` 심볼릭 링크가 깨진 경로를 가리키게 된다.
- `apps/cli/src/*.ts`는 `../../../lib/server/*.ts`, `../../packages/core/src/*.ts`처럼
  모노레포 상위 경로를 상대 경로로 import한다(esbuild가 이걸 번들에 흡수). npm이 git
  subdirectory 설치 시 리포 전체를 클론한 뒤 `apps/cli`를 패키지 루트로 다루므로, `prepare`
  시점에는 상위 디렉터리 소스가 디스크에 존재해 번들링이 가능하고, 이후 `files: ["dist"]`
  덕분에 최종 설치물에는 `dist/`만 남는다.

## 모듈 할당

- module: `cli-surface`
- owned_paths: `apps/cli/package.json`
- forbidden_paths: `apps/cli/src/*`(로직 변경 없음), `apps/cli/build.mjs`(그대로 재사용)

## 계약 및 베이스라인

- CLI의 공개 명령/exit code/credential 계약은 바꾸지 않는다. 설치 메커니즘만 고친다.
- `bin` 엔트리가 가리키는 `dist/*.js` 경로는 그대로 유지한다.

## 작업

1. `apps/cli/package.json`의 `scripts`에 `"prepare": "node build.mjs"`를 추가한다.
2. `esbuild`를 `devDependencies`에서 `dependencies`로 옮긴다 — `prepare`는 해당 패키지를
   *설치하는 소비자* 환경에서 실행되는데, npm/pnpm은 의존성으로 설치되는 패키지의
   `devDependencies`는 설치하지 않는다(그 패키지를 직접 개발할 때만 설치). `devDependencies`에
   둔 채로는 `prepare`가 실행되는 시점에 `esbuild`가 없어 빌드가 실패한다(실제로 로컬
   `git clone` + `npm install -g <경로>` 재현 테스트에서 `ERR_MODULE_NOT_FOUND: esbuild`로
   확인됨).

## 실제 발견한 추가 사실 (계획 대비 정정)

애초 가정("`npm install -g git+https://...#branch:apps/cli`처럼 git URL에 `#commit-ish:subdirectory`
fragment를 붙이면 서브디렉터리만 설치된다")은 **틀렸다** — 실제로 `npm pack`/`npm install -g`로
로컬 `git+file://` 리모트에 대해 검증한 결과, npm은 이 fragment의 서브디렉터리 부분을 완전히
무시하고 **리포 루트 전체**(`package.json` name="repgen", `next` 등 58개 의존성 포함, 213개 파일)를
설치했다. pnpm은 아예 `refactoring:apps/cli`를 하나의 commit-ish로 해석하려다 실패했다
(`Could not resolve refactoring:apps/cli to a commit`). 즉 plain npm/pnpm은 git 리포의
서브디렉터리만 설치하는 기능을 제공하지 않는다 — 이건 apps/cli 패키지 설계의 문제가 아니라
npm/pnpm 자체의 근본적 한계다.

따라서 이번 step은 "git URL 한 줄 설치"를 고치는 게 아니라, 실제로 동작하는 두 가지 경로를
확정하고 검증하는 것으로 범위를 좁혔다:

- **경로 A (레지스트리 없이, 지금 바로 되는 방법)**: `git clone`으로 전체 리포를 받은 뒤, `cd apps/cli && npm install -g .`(또는 `npm install` 후 `npm link`)를 실행한다. `npm install`은
  로컬 패키지 자신의 `dependencies`(esbuild 포함)를 설치한 뒤 `prepare`를 실행해 `dist/`를
  만들고, 그 상태에서 `-g .`(또는 `npm link`)로 전역 바인딩한다. **로컬 클론 리포로 실제
  재현해 `repgen --version`, `repgen-extract-doc --template <실제 template-basic.docx>`가
  정상 동작함을 확인했다.**
- **경로 B (한 줄 `npm install` 원함)**: `apps/cli`를 별도 npm 레지스트리 패키지로
  `npm publish`해야 한다. 이건 외부 레지스트리에 실제로 게시하는 행위라 사용자의 명시적
  승인 없이는 수행하지 않는다 — 이번 step에서는 수행하지 않았고, `known_issue`로 baseline에
  남긴다.

## Acceptance Criteria

- [x] `node build.mjs`가 `apps/cli`에서 정상 동작해 8개 entry를 `dist/`에 생성한다(기존 동작 유지 확인).
- [x] `esbuild`를 `dependencies`로 옮긴 뒤, 로컬 `git clone` + `cd apps/cli && npm install -g .`로
      실제 설치를 재현해 `prepare`가 자동으로 `dist/*.js`를 생성하고, 설치된 `repgen`/
      `repgen-extract-doc` 바이너리가 실제 템플릿 파일에 대해 정상 동작하는지 검증한다
      (실제 GitHub 원격에는 접근하지 않음, 로컬 클론만 사용).
- [x] `pnpm install`(워크스페이스 재설치)도 여전히 `apps/cli`의 `prepare`를 정상 실행한다.
- [x] `pnpm test`, `pnpm exec tsc --noEmit --pretty false`, `pnpm lint`가 통과한다.

## 검증 절차

1. `cd apps/cli && node build.mjs` — 빌드 자체가 여전히 성공하는지 확인.
2. `git+file://` 로컬 URL로 `npm pack`/`npm install -g` 실행 → 서브디렉터리 fragment가
   무시되고 루트 전체가 설치됨을 확인(가정이 틀렸음을 증명).
3. `git clone` (스크래치 디렉터리) → `cd apps/cli && npm install` → `prepare`가 `dist/`를
   만드는지, `node dist/repgen.js --version`이 동작하는지 확인.
4. `npm install -g --prefix <임시 prefix> .`로 전역 바인딩 후, 심볼릭 링크가
   `dist/repgen.js` 등을 정확히 가리키는지, 실제 리포의 `template/template-basic.docx`에 대해
   `repgen-extract-doc`이 정상 동작하는지 확인.
5. 루트에서 `pnpm install`, `pnpm exec tsc --noEmit --pretty false`, `pnpm lint`, `pnpm test`
   재실행.

## 검증 결과

- `npm pack "git+file:///.../refactoring#refactoring:apps/cli"` → 서브디렉터리 무시, 루트
  패키지(name="repgen", 213 files, next 포함) 전체가 tarball에 담김을 확인(가정 반증).
- `pnpm add "git+file:///.../refactoring#refactoring:apps/cli"` → `Could not resolve
  refactoring:apps/cli to a commit` 오류로 실패(가정 반증).
- esbuild를 devDependencies에 둔 채 `npm install -g <로컬경로>` → `ERR_MODULE_NOT_FOUND: esbuild`로
  `prepare`가 실패함을 재현.
- esbuild를 dependencies로 옮긴 뒤 스크래치 디렉터리에 `git clone` → `cd apps/cli && npm install`
  → `prepare`가 `node build.mjs`를 자동 실행, 8개 entry가 `dist/`에 생성됨. `node dist/repgen.js
  --version` → `0.1.0` 정상 출력.
- `npm install -g --prefix <임시> .` → `bin/repgen` 등 8개 심볼릭 링크가
  `lib/node_modules/@repgen/cli/dist/*.js`를 정확히 가리킴. `repgen-extract-doc --template
  <실제 template-basic.docx>` → placeholder JSON을 정상 출력(exit 0).
- 루트 `pnpm install` → `apps/cli prepare$ node build.mjs`가 워크스페이스 설치 중 정상 실행됨을 재확인.
- `pnpm exec tsc --noEmit --pretty false` → 오류 없음. `pnpm lint` → 0 errors. `pnpm test` →
  12 files / 57 tests 통과, coverage 80% threshold 통과(회귀 없음, 로직 변경 없이 설치
  메타데이터만 수정했으므로 기존 테스트 결과 그대로 유지).

## 금지사항

- 실제 GitHub 원격(superwhyun/RepGen)에 push하거나 npm publish하지 않는다.
- CLI 명령의 stdout/stderr/exit code 계약을 바꾸지 않는다.
