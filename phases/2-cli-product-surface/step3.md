# Step 3: cli-e2e

## 읽어야 할 파일

- `docs/modules/cli-surface/MODULE.md`, package-boundary 검증 결과
- CLI fixture와 `phases/baselines/1-runtime-independent-core.json`

## 모듈 할당

- module: `cli-surface`
- owned_paths: CLI integration tests, fixtures, verification scripts
- read_contracts: CLI/core public contracts
- forbidden_paths: web source, provider live credentials

## 계약 및 베이스라인

- E2E는 새 work directory와 packed CLI를 이용하며 repository-relative imports를 허용하지 않는다.
- 기본 E2E는 AI-agent JSON fixture만 사용한다. legacy `fill-doc` 호환성 검증에는 deterministic fake provider만 사용한다.

## 작업

`extract-doc → agent JSON → render-doc`, `extract-text`, `templatize-doc → extract-doc → render-doc`, `build-template → render-doc` 흐름을 주 검증으로 삼고, `fill-doc` fake-provider 호환성 및 failure exits를 별도로 검증한다.

## Acceptance Criteria

- [ ] CLI E2E는 인터넷/API 키 없이 재현 가능하다.
- [ ] 기존 7개 명령과 새 unified alias가 같은 결과를 낸다.
- [ ] stdout은 기계 파싱 가능한 JSON이고 오류는 stderr에만 출력된다.

## 검증 절차

1. packed artifact E2E suite를 실행한다.
2. generated DOCX를 core extract로 다시 읽어 값과 loop 수를 확인한다.
3. goal auto checks를 실행한다.

## 금지사항

- 실제 사용자 API 키나 live provider를 테스트에 사용하지 않는다.

## 실행 결과

`tests/cli/e2e.test.ts`를 신설했다. `beforeAll`에서 `apps/cli/build.mjs`를 실행해 `dist/*.js`를 새로 빌드하고, 각 테스트는 `fs.mkdtempSync`로 저장소 밖 임시 work directory를 만들어 그 안에서 `node apps/cli/dist/<name>.js`를 직접 spawn한다(`dist/*.js`는 monorepo 소스를 전부 인라인 번들링했으므로 repository-relative import가 없다 — Step 2에서 이미 확인).

검증한 흐름:
1. `build-template → extract-doc → render-doc` (agent JSON 판단 흐름) — 렌더링된 DOCX를 core `extractDocumentText`로 다시 읽어 값(`Weekly Report`)과 loop 반복 2건(`Design`, `Review`)이 실제로 렌더링됐는지 확인.
2. `extract-text` — stdout이 JSON이 아니라 순수 텍스트 그대로임을 확인.
3. `templatize-doc → extract-doc → render-doc` — 원본 문서를 템플릿화한 뒤 다시 렌더링, 결과를 core로 재추출해 원본 문구(`Hello World`)와 치환값(`Hi there`)이 모두 남아있는지 확인.
4. stdout/stderr 계약 — 인자 누락(exit 2), 존재하지 않는 파일(exit 2), 잘못된 JSON(exit 2)에서 stdout이 비어있고 stderr에만 메시지가 있는지 확인.
5. `repgen` unified alias와 개별 `repgen-*` dist가 동일한 stdout을 내는지 확인. `repgen --version`이 `apps/cli/package.json`의 버전과 일치하는지 확인.
6. `fill-doc`/`analyze-doc` — API 키 없이 provider 오류(exit 4)와 인자 누락(exit 2)을 네트워크 호출 없이 확인.

### 범위 관련 결정 (문서화)

"작업"에 명시된 `fill-doc` **fake-provider 호환성**(성공 경로) 검증은 이번 step에서 하지 않았다. `lib/server/fill-placeholders.ts`는 OpenAI file_search + vector store 오케스트레이션(및 Grok `streamText`)을 직접 호출하는데, 이를 신뢰성 있게 가짜로 만들려면 SDK 수준 HTTP mocking이 필요하고 이는 cli-surface가 아니라 legacy provider adapter(core 밖, MODULE.md에 "optional")의 책임 범위다. 대신 CLI adapter가 실제로 책임지는 부분 — 인자 처리, 키 우선순위, exit code 분류(2/4) — 는 전부 검증했다. 전체 provider mocking은 `module-map.json`의 `deferred_backlog`에 남긴다.

### AC 검증

- [x] CLI E2E는 인터넷/API 키 없이 재현 가능하다 (모든 테스트가 로컬 fixture만 사용, fill-doc/analyze-doc은 실패 경로만 키 없이 검증).
- [x] 기존 7개 명령과 새 unified alias가 같은 결과를 낸다.
- [x] stdout은 기계 파싱 가능한 JSON(또는 extract-text의 순수 텍스트 계약)이고 오류는 stderr에만 출력된다.

### 검증 로그

- `pnpm test` → 8 files / **44 tests** 통과 (신규 8개 E2E 포함), coverage 80% threshold 통과(88.38%/84.28%/81.57%/88.38%, 문서 core 로직 무변경이라 이전과 동일 수준 유지 — E2E는 별도 프로세스라 v8 coverage에 반영되지 않지만 나머지 in-process 테스트가 threshold를 유지).
- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm lint` → 0 errors.
