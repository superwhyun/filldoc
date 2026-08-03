# Step 8: rename-repgen-to-filldoc

## 읽어야 할 파일

- `apps/cli/package.json`, `apps/cli/build.mjs`, `apps/cli/src/repgen.ts`(→`filldoc.ts`)
- `package.json`(root), `packages/core/package.json`
- `README.md`, `.skills/filldoc/SKILL.md`, `.skills/filldoc/agents/openai.yaml`, `AGENTS.md`
- `docs/modules/{cli-surface,document-core,template-analyzer}/MODULE.md`, `docs/modules/registry.json`
- `tests/cli/e2e.test.ts`, `tests/e2e/*.spec.ts`

## 배경

npm publish 가능성을 사용자와 논의하던 중, 사용자가 제품/CLI 이름을 `RepGen`
대신 `filldoc`으로 바꿔달라고 요청했다. `.skills/filldoc/` 스킬 폴더는 이미
`filldoc`이라는 이름으로 존재했으므로, CLI 커맨드 이름을 여기 맞추는 게
자연스러운 선택이다. 사용자에게 범위(CLI 패키지/커맨드만 vs 프로젝트 전체)를
물었고 "프로젝트 전체"로 답변받았다.

## 모듈 할당

- module: 여러 모듈에 걸친 cross-cutting 변경(cli-surface가 중심이라 이 phase에 배치)
- owned_paths: 아래 "작업" 목록의 모든 파일
- forbidden_paths: 이미 태그된 과거 phase의 `step*.md`/`baseline*.json` 본문, git 커밋 메시지, git 태그, GitHub 저장소 URL(`github.com/superwhyun/RepGen`) — 아래 "변경하지 않은 것" 참고

## 계약 및 베이스라인

- CLI의 인자/exit code/stdout JSON 스키마는 바꾸지 않는다 — 명령 **이름**만 바뀐다
  (`repgen-*` → `filldoc-*`, unified alias `repgen` → `filldoc`).
- 이후 새로 만드는 phase/step의 git 커밋 컨벤션은 `feat(filldoc/stepN): ...`을 쓴다.
  (과거 커밋은 그대로 `RepGen/stepN`으로 남는다 — 이미 만들어진 커밋 메시지는
  git 히스토리 재작성 없이는 바꿀 수 없고, 이번 요청은 히스토리 재작성이 아니다.)

## 작업

1. **CLI 코드**: `apps/cli/src/repgen.ts` → `apps/cli/src/filldoc.ts` rename, 내부 사용법
   텍스트(`repgen` → `filldoc`) 갱신. `apps/cli/src/lib/cli-support.ts`,
   `apps/cli/src/{analyze-doc,build-template,extract-doc,extract-text,fill-doc,render-doc,templatize-doc}.ts`의
   주석/사용법 문자열에서 `repgen-*` → `filldoc-*`, `RepGen` → `filldoc`.
2. **패키지 메타데이터**: `apps/cli/package.json`(name: `filldoc-cli`, bin 8개 전부 `filldoc*`),
   `apps/cli/build.mjs`(ENTRIES의 `"repgen"` → `"filldoc"`), root `package.json`(name:
   `filldoc`, bin 8개), `packages/core/package.json`(name: `@filldoc/core`).
3. **legacy 코드**: `lib/template-storage.ts`(IndexedDB 이름), `lib/server/fill-placeholders.ts`(OpenAI
   업로드 파일/vector store 임시 이름), `lib/client-template-generator.ts`(주석), `scripts/*.ts`(주석).
4. **살아있는 문서**: `README.md`, `.skills/filldoc/SKILL.md`, `.skills/filldoc/agents/openai.yaml`,
   `AGENTS.md`, `docs/modules/{cli-surface,document-core,template-analyzer}/MODULE.md`,
   `docs/modules/registry.json`("project" 필드).
5. **테스트**: `tests/cli/e2e.test.ts`(unified alias 호출/문자열 assertion), `tests/e2e/*.spec.ts`(temp
   dir 접두사, cosmetic).
6. **harness 상태(미래 컨벤션)**: `phases/*/index.json`의 `project` 필드, `phases/project-manifest.json`의
   `project` 필드를 `filldoc`으로 갱신 — 앞으로 만들 phase/step의 커밋 메시지가 이 값을 따른다.

## 변경하지 않은 것 (의도적)

- 이미 완료·태그된 phase의 `step*.md`/`index.json`의 서술 텍스트, `baseline*.json` — 시점 기록이라
  재작성하지 않는다(세션 전체에서 지켜온 원칙과 동일).
- `phases/project-manifest.json`의 `"tag"` 필드(`RepGen-phase{1,2,3}-done`) — 실제 존재하는
  git 태그를 정확히 가리켜야 하므로 그대로 둔다.
- git 커밋 메시지, git 태그 자체 — 재작성/재생성하지 않는다.
- GitHub 저장소 URL(`github.com/superwhyun/RepGen`)과 로컬 clone 디렉터리명(`RepGen/`) — 실제
  원격 저장소 이름을 바꾸는 건 별도의, 훨씬 큰 외부 액션이라 이번 범위 밖이다.
- `goal.json`의 원래 목표 서술("기존 repgen-* 명령") — 리팩터링을 시작하던 시점의 원래 목표
  문구라 재작성하지 않는다.

## Acceptance Criteria

- [x] `apps/cli`에 남은 `repgen` 문자열이 없다(빌드 산출물 제외).
- [x] `node build.mjs`가 8개 entry(`filldoc.js` 포함)를 정상 생성한다.
- [x] `pnpm test`(coverage 포함), `pnpm exec tsc --noEmit --pretty false`, `pnpm lint`,
      `pnpm build`, `pnpm test:e2e`가 모두 통과한다.
- [x] 로컬 `npm install -g .`(apps/cli)로 실제 설치해 `filldoc --version`,
      `filldoc-extract-doc --template <실제 template-basic.docx>`가 정상 동작한다.

## 검증 절차

1. `grep -riIl repgen`로 저장소 전체를 스캔해, 남은 항목이 "변경하지 않은 것"
   목록에만 해당하는지 확인.
2. `apps/cli`에서 `node build.mjs` 재실행.
3. 루트에서 `pnpm exec tsc --noEmit --pretty false`, `pnpm lint`, `pnpm test`,
   `pnpm build`, `pnpm test:e2e` 순서로 실행.
4. 스크래치 디렉터리에 `npm install -g --prefix <tmp> .`(apps/cli)로 설치해
   `filldoc --version`/`filldoc-extract-doc`을 실제 실행.

## 검증 결과

- `grep -riIl -i repgen`(node_modules/.git/dist/coverage/.next 등 제외) → 남은 파일은
  전부 "변경하지 않은 것" 목록과 정확히 일치(과거 phase 기록, GitHub URL, `RepGen/` clone
  디렉터리명, `goal.json` 원문, `project-manifest.json`의 tag 필드).
- `node build.mjs` → `dist/filldoc.js`(81.4kb) 포함 8개 entry 정상 생성.
- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm lint` → 0 errors.
- `pnpm test` → 12 files / 57 tests 통과, coverage 80% threshold 통과(lines/branches/functions/statements
  88.38/84.21/81.57/88.38%, Phase 1/2 이전 수치와 동일 — 로직 변경 없음).
- `pnpm build`(Next production build) → 성공.
- `pnpm test:e2e`(Playwright) → 4 tests 통과.
- 스크래치 디렉터리에 실제 `npm install -g --prefix <tmp> .` 설치 → `filldoc --version` → `0.1.0`,
  `filldoc-extract-doc --template template-basic.docx` → placeholder JSON 정상 출력(exit 0).

## 금지사항

- CLI 명령의 인자/exit code/stdout JSON 스키마를 바꾸지 않는다(이름만 변경).
- 과거 phase의 완료된 step 문서, git 커밋/태그, GitHub 저장소 URL을 재작성하지 않는다.
- 실제 GitHub 원격에 push하거나 npm publish하지 않는다.
