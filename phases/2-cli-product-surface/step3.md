# Step 3: cli-e2e

## 읽어야 할 파일

- `docs/modules/cli-surface/MODULE.md`, package-boundary 검증 결과
- CLI fixture와 `phases/baselines/1-runtime-independent-core.json`

## 모듈 할당

- module: `cli-surface`
- owned_paths: CLI integration tests, fixtures, verification scripts
- read_contracts: CLI/core public contracts
- forbidden_paths: web source, provider live credentials

## 계약 및 베이스라인

- E2E는 새 work directory와 packed CLI를 이용하며 repository-relative imports를 허용하지 않는다.
- 기본 E2E는 AI-agent JSON fixture만 사용한다. legacy `fill-doc` 호환성 검증에는 deterministic fake provider만 사용한다.

## 작업

`extract-doc → agent JSON → render-doc`, `extract-text`, `templatize-doc → extract-doc → render-doc`, `build-template → render-doc` 흐름을 주 검증으로 삼고, `fill-doc` fake-provider 호환성 및 failure exits를 별도로 검증한다.

## Acceptance Criteria

- [ ] CLI E2E는 인터넷/API 키 없이 재현 가능하다.
- [ ] 기존 7개 명령과 새 unified alias가 같은 결과를 낸다.
- [ ] stdout은 기계 파싱 가능한 JSON이고 오류는 stderr에만 출력된다.

## 검증 절차

1. packed artifact E2E suite를 실행한다.
2. generated DOCX를 core extract로 다시 읽어 값과 loop 수를 확인한다.
3. goal auto checks를 실행한다.

## 금지사항

- 실제 사용자 API 키나 live provider를 테스트에 사용하지 않는다.
