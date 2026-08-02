# Step 1: api-adapters

## 읽어야 할 파일

- `docs/modules/web-adapter/MODULE.md`, core/provider contracts
- `app/api/*/route.ts`, package server configuration

## 모듈 할당

- module: `web-adapter`
- owned_paths: `app/api/**/route.ts`, server-only web adapter modules, route tests
- read_contracts: `document-core`, provider contracts
- forbidden_paths: React components and CLI command code

## 계약 및 베이스라인

- route는 validation→core call→HTTP response만 수행한다.
- provider credential은 web adapter boundary에서만 검증한다. 서버 env와 BYOK request credential을 모두 지원하되, core에는 credential을 전달하지 않는다.

## 작업

기존 extract/fill/generate/template routes를 shared DTO validator와 core 호출로 이관한다. fill route의 provider adapter만 server env 또는 BYOK credential을 사용한다. 파일 이름, MIME, 크기, template path traversal을 검증하고 오류를 안전한 HTTP 응답으로 변환한다.

## Acceptance Criteria

- [ ] route production source에 DOCX XML 조작, prompt 생성, provider SDK 직접 호출이 없다.
- [ ] invalid request, unsupported upload, missing server credential, core error가 계약된 status/body를 반환한다.
- [ ] API key가 response, server log, core DTO, generated file에 포함되지 않는다.

## 검증 절차

1. route contract tests를 실행한다.
2. static search와 build output으로 browser secret 누출이 없는지 확인한다.
3. lint/typecheck/test를 실행한다.

## 금지사항

- UI interaction 흐름을 이 단계에서 바꾸지 않는다.
