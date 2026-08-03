import { describe, expect, it } from "vitest"

import { assertUploadSize, MAX_UPLOAD_BYTES, UploadTooLargeError } from "../../lib/server/upload-limits.ts"

describe("assertUploadSize", () => {
  it("does not throw for content within the limit", () => {
    expect(() => assertUploadSize(new Array(1000).fill(0))).not.toThrow()
  })

  it("does not throw when content is missing/not an array", () => {
    expect(() => assertUploadSize(undefined)).not.toThrow()
  })

  it("throws UploadTooLargeError when content exceeds MAX_UPLOAD_BYTES", () => {
    // sparse array — 실제 원소를 채우지 않고 length만 큰 배열이라 빠르고 가볍다.
    const oversized = new Array(MAX_UPLOAD_BYTES + 1)

    expect(() => assertUploadSize(oversized)).toThrow(UploadTooLargeError)
  })
})
