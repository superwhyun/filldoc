# Step 6: review-fix-runcli-lifecycle-doc

## 읽어야 할 파일

- `apps/cli/src/lib/cli-support.ts`, `apps/cli/src/repgen.ts`
- `tests/cli/e2e.test.ts`

## 배경

Phase 2가 마감(`RepGen-phase2-done`)된 뒤 사용자 요청으로 재리뷰를 수행했다. 코드를 다시 정독하며 다음을 확인했다:

- `apps/cli/src/repgen.ts`는 `repgen <subcommand>` dispatch 시 대상 명령 모듈을 `await import(...)`하지만, 대상 모듈은 자기 자신의 `runCli(main)`을 모듈 최상단에서 "fire and forget"으로 호출한다. `await import(...)`는 모듈의 동기 최상위 코드 실행이 끝나는 즉시 resolve되므로, 대상 명령의 실제 비동기 작업(파일 I/O, provider 호출 등)이 끝나기 전에 `repgen.ts`의 `main()`이 먼저 반환된다.
- 현재는 `runCli()`가 **성공 시 `process.exit()`를 호출하지 않기 때문에** 문제가 없다 — Node의 이벤트 루프가 대상 명령의 pending promise가 남아있는 한 프로세스를 살려두고, 실패 시에는 대상 명령 자신의 `runCli()` catch가 `process.exit(code)`를 직접 호출해 정상적으로 종료된다.
- 하지만 이 정상 동작은 **암묵적인 불변조건**(성공 시 `process.exit(0)`을 호출하지 않는다)에 의존한다. 이 불변조건이 코드에 문서화돼 있지 않아서, 누군가 "성공 시에도 exit code를 명시하자"는 자연스러워 보이는 개선을 하면 `repgen <subcommand>` dispatch 경로에서 대상 명령의 작업이 조용히 잘려나가는 silent failure가 생길 수 있다. 직접 명령(`repgen-fill-doc` 등)은 영향받지 않고, 오직 `repgen` unified alias를 통한 dispatch만 깨진다.
- 이 경로에 대한 회귀 테스트도 부족했다: 기존 E2E는 `repgen extract-doc`(성공)과 `repgen bogus-command`(repgen 자체 오류)만 검증했고, dispatch된 하위 명령 자신이 비동기 작업 이후 실패하는 경로는 검증하지 않았다.

## 모듈 할당

- module: `cli-surface`
- owned_paths: `apps/cli/src/lib/cli-support.ts`, `tests/cli/e2e.test.ts`
- forbidden_paths: 명령 파일들의 로직 변경(불필요, 계약 동일 유지)

## 계약 및 베이스라인

- exit code 계약(0/2/3/4)과 stdout/stderr 분리 계약은 바꾸지 않는다. 문서화와 테스트 보강만 한다.

## 작업

1. `cli-support.ts`의 `runCli()`에 성공 시 `process.exit(0)`을 호출하지 않는 이유와, 이를 바꿀 때 `repgen <subcommand>` dispatch 경로(`tests/cli/e2e.test.ts`)를 반드시 재검증해야 한다는 주석을 추가한다.
2. `tests/cli/e2e.test.ts`에 `repgen fill-doc`(실제 파일 읽기 → placeholder 추출 → API 키 검사까지 비동기 작업을 거친 뒤 실패)이 exit code 4로 정상 전파되는지 검증하는 테스트를 추가한다.

## Acceptance Criteria

- [ ] `pnpm test`(coverage 포함)가 통과하고, 신규 회귀 테스트가 실제로 실행된다.
- [ ] `pnpm exec tsc --noEmit --pretty false`, `pnpm lint`가 통과한다.

## 검증 절차

1. `apps/cli/build.mjs`로 재빌드한다.
2. `pnpm test`, `pnpm exec tsc --noEmit --pretty false`, `pnpm lint`를 실행한다.

## 검증 결과

- `pnpm test` → 8 files / **46 tests** 통과(신규 회귀 테스트 1개 포함), coverage 80% threshold 통과.
- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm lint` → 0 errors.
- 실제 동작은 이전부터 정상이었음(코드 동작 변경 없음, 문서화+테스트 보강). 수동으로 `node apps/cli/dist/repgen.js fill-doc --template ./tpl.docx --data ./tpl.docx --output ./x.docx`(API 키 없음) 실행 시 exit 4, `오류: API 키가 없습니다...`만 stderr에 출력됨을 재확인.

## 금지사항

- 명령 파일들의 exit code 분류나 stdout 스키마를 바꾸지 않는다.
