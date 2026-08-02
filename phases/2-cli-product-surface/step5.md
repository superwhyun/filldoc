# Step 5: review-fix-repgen-error-handling

## 읽어야 할 파일

- `apps/cli/src/repgen.ts`, `apps/cli/src/lib/cli-support.ts`
- `apps/cli/src/extract-doc.ts` (다른 명령 파일의 `runCli()` 사용 패턴 참고)

## 배경

Phase 2 리뷰 게이트 1회차(`framework/docs/REVIEW.md` 워크플로우, `RepGen-phase1-done..HEAD` diff 대상)에서 발견:

`apps/cli/src/repgen.ts`의 `main()`이 다른 6개 명령 파일과 달리 `runCli()`로 감싸이지 않고 `main()`을 그냥 호출하고 있었다. 그 결과:
- `--version` 처리 중 `apps/cli/package.json`을 못 읽는 등 예상치 못한 오류가 나면 `오류: <메시지>` 형식이 아니라 raw Node stack trace가 stderr에 그대로 출력된다.
- exit code가 계약된 2/3/4가 아니라 Node의 기본 unhandled rejection 처리에 맡겨져 일관되지 않는다.
- 실제로 이전 세션에서 `apps/cli/package.json`이 없던 시점에 `repgen --version`을 실행했을 때 이 문제가 그대로 재현됐다 (raw `Error: ENOENT...` stack trace).

## 모듈 할당

- module: `cli-surface`
- owned_paths: `apps/cli/src/repgen.ts`, `tests/cli/e2e.test.ts`
- forbidden_paths: 다른 6개 명령 파일(이미 `runCli()` 사용 중, 변경 불필요)

## 계약 및 베이스라인

- 나머지 6개 명령 파일이 이미 지키고 있는 계약(성공은 stdout JSON/exit 0, 실패는 stderr `오류: <메시지>`/exit 2·3·4)을 `repgen.ts`에도 동일하게 적용한다. 새로운 계약을 만들지 않는다.

## 작업

1. `repgen.ts`에 `CliUsageError`/`runCli`를 `./lib/cli-support.ts`에서 import.
2. "알 수 없는 명령" 처리를 `console.error` + `process.exit(2)` 직접 호출에서 `throw new CliUsageError(...)`로 변경.
3. 파일 마지막의 `main()` 호출을 `runCli(main)`으로 교체.
4. `tests/cli/e2e.test.ts`에 회귀 방지 테스트 추가: 알 수 없는 subcommand 실행 시 exit 2, stdout 비어있음, stderr에 `오류: 알 수 없는 명령입니다: ...` 형식, raw stack trace(`"at "` 문자열) 없음을 확인.

## Acceptance Criteria

- [ ] `apps/cli/dist/repgen.js bogus-command` 실행 시 exit code `2`, stderr에 `오류:` 접두사가 붙은 메시지만 출력되고 raw stack trace가 없다.
- [ ] `pnpm test`(coverage 포함), `pnpm exec tsc --noEmit --pretty false`, `pnpm lint` 모두 통과한다.

## 검증 절차

1. `apps/cli/build.mjs`로 재빌드한다.
2. `node apps/cli/dist/repgen.js bogus-command`를 직접 실행해 exit code와 stderr 형식을 확인한다.
3. `pnpm test`, `pnpm exec tsc --noEmit --pretty false`, `pnpm lint`를 실행한다.

## 검증 결과

- 재빌드(`node apps/cli/build.mjs`) 후 `node apps/cli/dist/repgen.js bogus-command` 수동 실행 → exit 2, stderr에 `오류: 알 수 없는 명령입니다: bogus-command`만 출력, stack trace 없음.
- `pnpm test` → 8 files / **45 tests** 통과(신규 회귀 테스트 1개 포함), coverage 80% threshold 통과.
- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm lint` → 0 errors.

## 금지사항

- 이번 fix 범위를 벗어나는 다른 명령 파일의 로직을 바꾸지 않는다.
