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

/** 명령의 main()을 실행하고, 계약된 exit code로 종료한다. */
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
