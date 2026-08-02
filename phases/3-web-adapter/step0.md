# Step 0: web-contract

## 읽어야 할 파일

- `goal.json`, `phases/baselines/2-cli-product-surface.json`
- `docs/modules/document-core/MODULE.md`, `docs/modules/cli-surface/MODULE.md`
- existing `app/api/*/route.ts`, `components/settings-dialog.tsx`, `lib/client-template-generator.ts`

## 모듈 할당

- module: `web-adapter`
- owned_paths: `docs/modules/web-adapter/MODULE.md`, `docs/modules/registry.json`, `phases/3-web-adapter/module-map.json`
- read_contracts: core and CLI public contracts
- forbidden_paths: production API/UI source

## 계약 및 베이스라인

- 웹은 input decode/HTTP status/response encode와 UI state만 담당하며 document semantics를 소유하지 않는다.
- 기존 provider 선택과 BYOK 흐름을 유지한다. 키는 웹 어댑터가 provider 호출에만 전달하며 core DTO/문서/다운로드 결과에는 포함하지 않는다.
- 기존 localStorage "remember" 동작은 호환 모드로 유지하되, 명시적 사용자 동의·마스킹·로그 금지·XSS 방어를 요구한다. 서버 환경변수 provider도 병행 지원한다.

## 작업

HTTP DTO와 core DTO의 변환, 오류→status mapping, 업로드 제한, 서버 template 접근 제어, streaming/download 응답, web BYOK/server credential policy를 문서화한다.

## Acceptance Criteria

- [ ] 각 API route의 request/response/error mapping이 core contract와 연결되어 있다.
- [ ] BYOK와 서버 env provider의 입력 경계, 비노출·비로그 정책, 저장 호환 정책이 명시된다.
- [ ] upload size/type limits와 error sanitization이 명시된다.

## 검증 절차

1. 현 route/component 행동을 contract inventory와 대조한다.
2. module-map ref와 phase validator를 확인한다.

## 금지사항

- 이 단계에서 UI 또는 route 구현을 바꾸지 않는다.
