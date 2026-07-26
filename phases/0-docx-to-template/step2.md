# Step 2: cli-wrapper

## 읽어야 할 파일

- `docs/modules/template-analyzer/MODULE.md`
- `lib/client-template-generator.ts`의 `generateTemplateFromSample` (Step 1 결과, public contract만)
- `scripts/fill-doc.ts`, `scripts/extract-doc.ts`, `scripts/render-doc.ts` — 기존 CLI 3종의 인자 파싱/에러 처리/shebang 컨벤션 (그대로 재사용)
- `package.json`의 `bin`/`scripts` 필드

## 모듈 할당

- module: `template-analyzer`
- owned_paths:
  - `scripts/analyze-doc.ts` (신규)
  - `package.json` (`bin.repgen-analyze-doc`, `scripts.analyze-doc` 추가)
- read_contracts:
  - `lib/client-template-generator.ts`의 `generateTemplateFromSample`
  - `lib/server/extract-text.ts`의 `extractTextFromBuffer`
- forbidden_paths:
  - `lib/client-template-generator.ts` (Step 1에서 완료, 이 step은 소비만)
  - `lib/server/` 내부 로직 수정

## 계약 및 베이스라인

- 기존 3개 CLI(`extract-doc.ts`/`render-doc.ts`/`fill-doc.ts`)와 동일한 관례를 따른다: `#!/usr/bin/env -S node --experimental-strip-types` shebang, `chmod +x`, 수동 `--key value` 파싱, 성공 시 stdout JSON 요약, 실패 시 stderr 메시지 + `process.exit(1)`.
- import는 `.ts` 확장자를 명시한다 (네이티브 ESM 실행 특성, 기존 스크립트와 동일).

## 작업

### 1. `scripts/analyze-doc.ts` 작성

```
repgen-analyze-doc --source <예시.docx> --output <새템플릿.docx> [--provider openai|grok] [--api-key <key>] [--template-name <이름>]
```

흐름:
1. `--source` 파일을 읽어 `extractTextFromBuffer(buffer, filename)`로 텍스트 추출 (`lib/server/extract-text.ts` 재사용, `.docx`/`.pdf`/`.txt`/`.md` 모두 소스로 허용).
2. API 키 확인 (`--api-key` > `OPENAI_API_KEY`/`XAI_API_KEY` env, 기존 `fill-doc.ts`의 `resolveApiKey` 패턴 그대로 재사용).
3. `generateTemplateFromSample({ provider, apiKey, sourceText, templateName })` 호출.
4. 결과 `file`(File 객체)을 `Buffer`로 변환해 `--output` 경로에 저장.
5. stdout에 `{ output, placeholderCount, loopKeys }` 요약 출력 (`spec.blocks`를 훑어 loop/table 개수 등 참고 정보 뽑아도 됨 — 과하게 정교할 필요 없음).

### 2. `package.json` 갱신

- `scripts.analyze-doc`: `"tsx scripts/analyze-doc.ts"`
- `bin.repgen-analyze-doc`: `"./scripts/analyze-doc.ts"`

`npm link`는 이미 되어 있으므로 재실행하면 새 bin이 바로 잡힌다 (필요 시 `npm link` 재실행 안내만 남긴다).

## Acceptance Criteria

```bash
npx tsc --noEmit --pretty false
```
- [ ] `repgen-analyze-doc --source <WG7 예시.docx> --output /tmp/template-wg-recommendations.docx` 실행 시 성공적으로 템플릿 docx가 생성된다 (실제 API 키로 1회 실행 확인)
- [ ] 생성된 템플릿을 `repgen-extract-doc`으로 검증했을 때 `recommendations` loop key가 존재하고 `no`/`title`/`body` 등 필드가 잡힌다
- [ ] `node_modules/.bin/tsx scripts/analyze-doc.ts` (저장소 안) 와 `repgen-analyze-doc` (전역) 둘 다 동일하게 동작한다

## 검증 절차

1. `npx tsc --noEmit --pretty false`
2. 실제 WG7 Recommendations 문서로 end-to-end 실행 (Step 4에서 더 정밀 검증하지만, 이 step에서도 최소 1회 스모크 확인)
3. `phases/0-docx-to-template/index.json`에서 step2 status를 `completed`로 갱신

## 금지사항

- `lib/client-template-generator.ts` 내부를 이 step에서 수정하지 않는다.
- 새 npm 의존성을 추가하지 않는다 (기존 `docx`/`lib/server/*`만으로 구현).
