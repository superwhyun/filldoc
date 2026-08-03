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

## 실행 결과

Step 0~3 완료, 리뷰 게이트 2회(1회차 finding → step5 review-fix, 2회차 no findings) 통과 후 최종 검증을 재실행하고 `phases/baselines/3-web-adapter.json`을 작성했다.

- `pnpm lint` → 0 errors.
- `pnpm exec tsc --noEmit --pretty false` → 오류 없음.
- `pnpm test`(vitest, coverage 포함) → 12 files / 57 tests 통과, coverage 80% threshold 통과.
- `pnpm test:e2e`(Playwright) → 4 tests 통과.
- `pnpm build` → 성공, 클라이언트 청크에 legacy 직접 호출 흔적 없음.
- `docs/modules/{web-adapter,cli-surface}/MODULE.md`와 `docs/modules/registry.json`의 status를 `implemented`로 갱신.
- `phases/index.json`, `phases/project-manifest.json`의 Phase 3 항목을 `completed`로 갱신.
- `git tag RepGen-phase3-done` 생성.

### goal.json 최종 평가

`goal.json`의 7개 `success_criteria`를 Phase 1~3 누적 결과로 재확인:

1. CLI가 인터넷/브라우저/Next.js 없이 문서 처리 전체를 수행 — ✅ (Phase 2)
2. AI 에이전트가 키 없이 extract/render/templatize CLI를 호출 가능 — ✅ (Phase 2)
3. fill-doc이 core 밖 선택적 provider 어댑터로 유지됨 — ✅ (Phase 1/2 미이관 결정 유지)
4. 기존 repgen-* 명령의 인자/stdout JSON 계약 호환 — ✅ (Phase 2, exit code만 명시적 세분화)
5. 웹 UI 흐름 유지 + 문서 처리 규칙은 core 계약만 사용 — ✅ **이번 phase에서 충족** (브라우저의 docxtemplater/pdfjs-dist/직접 AI fetch 전부 제거, `/api/*`로 통일)
6. Claude Code/Codex 등이 filldoc skill로 키 없이 CLI 호출 가능 — ✅ (Phase 2)
7. 코어 단위/통합 검증 + CLI/웹 회귀 검증 자동화 — ✅ **이번 phase에서 충족** (Playwright 웹 E2E 신설)

**판정: `done`** — 7개 success_criteria 모두 충족, `auto_checks`(lint/tsc/test) 통과. `max_phases`(4)에도 도달(Phase 0~3 전부 완료).

### AC 검증

- [x] 3개 phase(1/2/3)의 success criteria와 auto checks가 통과한다.
- [x] core/CLI/web 경계와 credential 정책이 문서화되어 있다 — 각 phase MODULE.md + baseline에 기록.
- [x] phase baseline과 project manifest가 최신이다.
