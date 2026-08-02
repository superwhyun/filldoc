# Step 3: web-regression

## 읽어야 할 파일

- web-adapter MODULE.md, API/UI tests, Phase 2 CLI E2E baseline

## 모듈 할당

- module: `web-adapter`
- owned_paths: Playwright/E2E configuration and fixtures, web verification scripts
- read_contracts: web API and CLI result contracts
- forbidden_paths: business logic changes

## 계약 및 베이스라인

- E2E uses a fake provider and fixture credentials; no live AI key is required. BYOK request는 fixture key가 adapter 경계를 넘지 않는지도 검증한다.
- Web output must be semantically equal to the core/CLI fixture output.

## 작업

핵심 흐름(템플릿 선택/업로드, placeholder 확인, 자료 업로드, fill 또는 direct render, 편집, download)과 API failure states를 browser E2E로 검증한다.

## Acceptance Criteria

- [ ] 기존 provider 선택/BYOK happy path와 validation/provider failure path E2E가 있다.
- [ ] 다운로드한 DOCX의 placeholders/values가 CLI fixture와 일치한다.
- [ ] build, lint, typecheck, test가 통과한다.

## 검증 절차

1. fake provider를 포함한 browser E2E를 실행한다.
2. download 파일을 core extract로 검사한다.
3. build artifact에서 secret/API key가 없음을 검사한다.

## 금지사항

- live provider 또는 사용자 credentials를 사용하지 않는다.
