# Step 2: ui-migration

## 읽어야 할 파일

- `docs/modules/web-adapter/MODULE.md`, API adapter contract
- `app/page.tsx`, `components/{template-upload,data-upload,content-editor,settings-dialog}.tsx`

## 모듈 할당

- module: `web-adapter`
- owned_paths: `app/page.tsx`, listed UI components, UI-only hooks/types
- read_contracts: web API DTO contract
- forbidden_paths: core, providers, API route behavior

## 계약 및 베이스라인

- UI는 upload, progress, editable result, download 및 user-facing error만 관리한다.
- browser-side DOCX rendering과 direct OpenAI/xAI fetch를 제거한다. 기존 provider 선택과 명시적 BYOK remember UX는 web adapter에만 유지한다.

## 작업

components를 API DTO와 다운로드 response만 소비하도록 옮기고, 설정 화면에서 server-configured provider와 BYOK를 선택할 수 있게 한다. 기존 template selection, placeholder edit, document download flow를 보존한다.

## Acceptance Criteria

- [ ] browser bundle/source에 direct provider fetch와 duplicated Docxtemplater render logic가 없다. BYOK key handling은 settings/web adapter 경계로 제한된다.
- [ ] 기존 UI의 template upload→placeholder edit→generate/download flow가 동작한다.
- [ ] API 오류가 한국어의 안전한 사용자 메시지로 표시된다.

## 검증 절차

1. component/integration tests를 실행한다.
2. browser bundle과 localStorage usage를 검사한다.
3. core CLI fixture 결과와 web download 결과를 비교한다.

## 금지사항

- document rendering 규칙을 UI에 재도입하지 않는다.
