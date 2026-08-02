# Step 0: core-contracts

## 목적

문서 엔진을 HTTP, React, 파일 경로, 환경변수와 분리하는 public contract를 확정한다. 구현은 하지 않는다.

## 읽어야 할 파일

- `goal.json`, `AGENTS.md`, `phases/baselines/0-docx-to-template.json`
- `lib/server/*.ts`, `lib/client-template-generator.ts`, `scripts/*.ts`, `app/api/*/route.ts`
- `phases/1-runtime-independent-core/module-map.json`

## 모듈 할당

- module: `document-core`
- owned_paths:
  - `docs/modules/document-core/MODULE.md`
  - `docs/modules/registry.json`
  - `phases/1-runtime-independent-core/module-map.json`
- read_contracts:
  - `phases/baselines/0-docx-to-template.json`
  - `lib/server/*.ts`, `lib/client-template-generator.ts`, `scripts/*.ts`, `app/api/*/route.ts`
- forbidden_paths:
  - `app/`, `components/`, `scripts/`, `lib/`의 구현 파일

## 작업

1. 각 기존 명령/API의 입력, 성공 DTO, 오류와 side effect를 inventory로 기록한다.
2. `packages/core`의 Buffer/Uint8Array 기반 API와 AI-agent가 소비할 JSON input/output schema를 정한다.
3. 오프라인 보장 범위를 `inspect`, `extract`, `render`, `templatize`, `build-template`로 명시한다. `fill-doc`은 core 밖의 기존 호환 provider 기능으로 표기한다.
4. web은 transport adapter이고, core에 Next/React/Web API/파일시스템 import가 없다는 경계를 계약에 적는다.
5. workspace target(`packages/core`, `packages/providers`, `apps/cli`, `apps/web`), Node 22+, Vitest coverage 80%를 contract에 기록한다.

## 계약 및 베이스라인

- Phase 0의 CLI 계약은 보존 대상이며, 변경이 필요하면 호환 shim 또는 이후 별도 contract-change step으로 기록한다.
- 이 step이 만든 문서가 이후 core 구현의 유일한 public contract다.

## Acceptance Criteria

- [ ] `document-core` MODULE.md가 agent JSON contract, public type, 오류, runtime boundary, workspace target, 호환성 정책을 명시한다.
- [ ] 기존 7개 CLI와 4개 문서 API route의 호환성 inventory가 있다.
- [ ] module-map ref와 registry 항목이 실제 문서를 가리킨다.
- [ ] `python3 /Users/whyun/.codex/skills/harness/framework/scripts/validate_phase.py 1-runtime-independent-core --root .`가 통과한다.

## 검증 절차

1. inventory의 각 항목을 source와 대조한다.
2. module-map의 문서 ref가 존재함을 확인한다.
3. phase validator를 실행하고 step status를 갱신한다.

## 금지사항

- 이 단계에서 production 코드 또는 package manager 설정을 변경하지 않는다.
