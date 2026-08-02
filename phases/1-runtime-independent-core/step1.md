# Step 1: core-extraction

## 읽어야 할 파일

- `goal.json`, `phases/baselines/0-docx-to-template.json`
- `docs/modules/document-core/MODULE.md`
- core contract가 inventory로 지목한 `lib/server/*`, `lib/client-template-generator.ts`

## 모듈 할당

- module: `document-core`
- owned_paths: `packages/core/**`, 기존 core 소스의 re-export/호환 shim, 관련 package 설정
- read_contracts: `docs/modules/document-core/MODULE.md`
- forbidden_paths: `app/page.tsx`, `components/**`, CLI 인자/출력 변경

## 계약 및 베이스라인

- Step 0의 document-core contract를 변경하지 않는다.
- 기존 import path는 다음 phase의 CLI/web 소비자가 전환할 때까지 compatibility shim으로만 유지한다.

## 작업

1. `packages/core`에 template, sources, rendering, templatize, template-builder와 shared contracts를 만든다.
2. AI 호출은 core로 옮기지 않는다. 기존 `fill-placeholders`는 후속 호환 provider adapter로 남기고 core는 agent가 이미 결정한 JSON만 받는다.
3. 기존 `lib/server/*` 소비자를 단일 core 구현으로 전환한다. 호환 re-export는 이 단계에서만 허용한다.
4. `client-template-generator.ts`의 Node 공용 로직은 File/Blob 변환과 분리한다.

## Acceptance Criteria

- [ ] core production source에 `next`, `react`, `window`, `document`, `File`, `Blob`, `localStorage`, Node 파일 경로 import가 없다.
- [ ] 기존 template extract/render/templatize 결과의 호환 fixture가 유지된다.
- [ ] lint와 typecheck가 통과한다.

## 검증 절차

1. 금지 import 탐색과 fixture 비교를 실행한다.
2. `pnpm lint`, `pnpm exec tsc --noEmit --pretty false`를 실행한다.
3. 변경 파일이 owned_paths 안에 있는지 확인하고 step status를 갱신한다.

## 금지사항

- CLI 표면 또는 웹 UI 행동을 바꾸지 않는다.
