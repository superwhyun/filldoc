# Step 6: review-fix-txt-md-client-side-read

## 읽어야 할 파일

- `components/data-upload.tsx`

## 배경

`phase-close`(태그 `RepGen-phase3-done`) 이후 사용자 요청으로 재리뷰를 수행했다.

Step 2에서 `.docx`/`.pdf`/`.txt`/`.md` 업로드를 전부 `POST /api/extract-text`로
통일했는데, `.txt`/`.md`는 애초에 core의 파서(docxtemplater/pdf-parse)가 필요
없는 단순 UTF-8 텍스트 읽기라서 서버로 보낼 이유가 없었다. 결과적으로:

- 순수 텍스트 파일까지 `Array.from(new Uint8Array(arrayBuffer))`로 JSON
  직렬화해서 보내는데, 이 표현은 원본 바이트 대비 3~4배 큰 페이로드가 된다
  (숫자 하나당 콤마 포함 평균 3~4바이트).
- 왕복이 필요 없는 케이스에 불필요한 네트워크 latency가 추가됐다.
- "core 로직 중복 제거"라는 원래 목적에도 해당하지 않는다 — `.txt`/`.md`는애초에 core가 하는 일이 `TextDecoder().decode()` 수준이라 브라우저에서 하나 서버에서 하나 "중복 구현"이라 부를 만한 게 없다.

## 모듈 할당

- module: `web-adapter`
- owned_paths: `components/data-upload.tsx`
- forbidden_paths: `.docx`/`.pdf` 처리 경로(그대로 서버 위임 유지)

## 계약 및 베이스라인

- `.docx`/`.pdf`는 계속 `/api/extract-text`(core `extractDocumentText`)에 위임한다 — 이건 실제로 core 파서가 필요한 경우라 그대로 둔다.
- `.txt`/`.md`만 브라우저의 `file.text()`로 되돌리되, 기존 empty-content 검증(`파일 내용이 비어있습니다`)은 그대로 유지한다.

## 작업

`components/data-upload.tsx`의 `processFiles`에서 확장자 분기를 다시 나눈다:
`.docx`/`.pdf` → `extractTextFromFile`(서버 위임), `.txt`/`.md` → `file.text()`(브라우저, empty 체크 유지).

## Acceptance Criteria

- [ ] `pnpm test`, `pnpm test:e2e`가 통과한다 (fake-provider.spec.ts가 `.txt` 데이터 파일 업로드를 쓰므로 이 경로가 실제로 재검증됨).
- [ ] `pnpm exec tsc --noEmit --pretty false`, `pnpm lint`가 통과한다.

## 검증 절차

1. `pnpm exec tsc --noEmit --pretty false`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm test:e2e`

## 검증 결과

- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm lint` → 0 errors.
- `pnpm test` → 12 files / 57 tests 통과, coverage 80% threshold 통과.
- `pnpm test:e2e` → 4 tests 통과 (`fake-provider.spec.ts`가 `.txt` 파일을 업로드하는 경로를 그대로 사용해 회귀 없음을 확인).

## 금지사항

- `.docx`/`.pdf`의 서버 위임 경로를 되돌리지 않는다.
