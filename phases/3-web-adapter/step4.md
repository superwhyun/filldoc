# Step 4: phase-close

## 읽어야 할 파일

- `goal.json`, `docs/modules/web-adapter/MODULE.md`, all Phase 3 verification results

## 모듈 할당

- module: `web-adapter`
- owned_paths: module/registry metadata, `phases/baselines/3-web-adapter.json`, project manifest and phase status files
- forbidden_paths: production functionality

## 계약 및 베이스라인

- 완료 조건은 goal success criteria와 auto checks가 모두 충족되는 것이다.
- legacy source 제거는 import/bundle/e2e 증거가 있는 경우에만 허용한다.

## 작업

최종 검증을 재실행하고, credential decision, removed compatibility shims, known limitations(BYOK 제외)을 baseline에 기록한다. 목표를 done/continue/stagnated로 평가한다.

## Acceptance Criteria

- [ ] 3개 phase의 success criteria와 auto checks가 통과한다.
- [ ] core/CLI/web 경계와 credential 정책이 문서화되어 있다.
- [ ] phase baseline과 project manifest가 최신이다.

## 검증 절차

1. full test/build/pack/E2E suite를 실행한다.
2. goal evaluation과 phase validator를 실행한다.
3. 상태를 갱신하고 required tag를 생성한다.

## 금지사항

- evidence 없이 legacy shim을 제거하거나 BYOK를 추가하지 않는다.
