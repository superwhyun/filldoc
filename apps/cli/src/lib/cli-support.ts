/**
 * repgen-* 명령 공통 exit code 정책.
 * docs/modules/cli-surface/MODULE.md의 exit code 표와 동기화되어 있어야 한다.
 */
export class CliUsageError extends Error {}
export class CliProcessingError extends Error {}
export class CliProviderError extends Error {}

function exitCodeFor(error: unknown): number {
  if (error instanceof CliUsageError) return 2
  if (error instanceof CliProviderError) return 4
  return 3
}

/**
 * 명령의 main()을 실행하고, 실패 시에만 계약된 exit code로 종료한다.
 *
 * 성공 시 일부러 process.exit(0)을 호출하지 않는다 — repgen.ts의 unified
 * alias(`repgen <subcommand>`)는 대상 명령 모듈을 동적 import만 하고 그 모듈의
 * runCli(main) 완료를 기다리지 않는다. 성공 종료를 process.exit(0)으로 명시하면
 * 이 프로세스가 즉시 죽어서, 아직 진행 중인 대상 명령의 비동기 작업(파일 쓰기,
 * provider 호출 등)이 잘려나간다. 이벤트 루프가 자연히 비면서 exit 0이 되는
 * 현재 동작에 의존하므로, 이 함수를 고칠 때는 반드시 `repgen <subcommand>`
 * dispatch 경로(tests/cli/e2e.test.ts)까지 다시 검증한다.
 */
export function runCli(main: () => void | Promise<void>): void {
  Promise.resolve()
    .then(main)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`오류: ${message}`)
      if (process.env.DEBUG && error instanceof Error) console.error(error)
      process.exit(exitCodeFor(error))
    })
}
