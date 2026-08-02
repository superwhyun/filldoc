# Step 5: blocking-fix-heading-level-typecheck

## 읽어야 할 파일

- `docs/modules/document-core/MODULE.md`
- `lib/client-template-generator.ts`의 `HeadingLevel` import와 `toHeadingLevel`

## 모듈 할당

- module: `document-core`
- owned_paths: `lib/client-template-generator.ts`, `phases/1-runtime-independent-core/index.json`
- forbidden_paths: unrelated source, CLI, web UI

## 계약 및 베이스라인

- `toHeadingLevel`의 런타임 반환값을 바꾸지 않고, TypeScript가 허용하는 정확한 반환 타입만 지정한다.

## 작업

`HeadingLevel` value의 enum-value union을 반환 타입으로 사용한다.

## Acceptance Criteria

- [ ] `./node_modules/.bin/tsc --noEmit --pretty false`가 통과한다.
- [ ] characterization tests가 통과한다.

## 검증 절차

1. 타입 오류를 재현한다.
2. 최소 수정 후 typecheck와 test를 실행한다.
3. Step 4를 pending으로 복구한다.

## 금지사항

- 문서 생성의 runtime behavior를 바꾸지 않는다.
