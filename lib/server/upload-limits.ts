/** docs/modules/web-adapter/MODULE.md의 upload 제약과 동기화되어 있어야 한다. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB

export class UploadTooLargeError extends Error {}

/** JSON body로 넘어온 `content: number[]`가 크기 제한을 넘으면 던진다. */
export function assertUploadSize(content: unknown): void {
  const size = Array.isArray(content) ? content.length : 0
  if (size > MAX_UPLOAD_BYTES) {
    throw new UploadTooLargeError(`업로드 파일이 너무 큽니다 (${size} bytes). 최대 ${MAX_UPLOAD_BYTES} bytes까지 허용됩니다.`)
  }
}
