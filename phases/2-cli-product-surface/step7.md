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

`apps/cli/package.json`의 `scripts`에 `"prepare": "node build.mjs"`를 추가해, npm/pnpm이
패키지를 설치할 때(devDependencies인 `esbuild` 설치 후) 자동으로 `dist/`를 빌드하게 한다.

## Acceptance Criteria

- [ ] `node build.mjs`가 `apps/cli`에서 정상 동작해 8개 entry를 `dist/`에 생성한다(기존 동작 유지 확인).
- [ ] git 커밋된 상태를 `git+file://` 로컬 URL로 실제 설치해, `prepare`가 자동 실행되어
      `dist/*.js`가 생성되고 `repgen --version`이 정상 동작하는지 검증한다(실제 GitHub
      원격에는 접근하지 않음).

## 검증 절차

1. `cd apps/cli && node build.mjs` — 빌드 자체가 여전히 성공하는지 확인.
2. 이 변경을 커밋한 뒤, 로컬 bare 클론 + `git+file://` URL로 `apps/cli` 서브디렉터리를
   임시 디렉터리에 `npm install`하여 `prepare`가 자동으로 `dist/`를 만드는지, 설치된
   `repgen` 바이너리가 실제로 동작하는지 확인한다.

## 검증 결과

(아래 실행 후 채움)

## 금지사항

- 실제 GitHub 원격(superwhyun/RepGen)에 push하거나 npm publish하지 않는다.
- CLI 명령의 stdout/stderr/exit code 계약을 바꾸지 않는다.
