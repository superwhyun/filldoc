# Step 4: e2e-verification

## 읽어야 할 파일

- `docs/modules/template-analyzer/MODULE.md`
- Step 0~3 산출물 전체 (구현이 아니라 이 step에서 실행/검증만 하므로 코드는 다시 읽지 않고 커맨드로 검증)

## 모듈 할당

- module: `template-analyzer`
- owned_paths:
  - `docs/modules/template-analyzer/MODULE.md` (status를 `implemented`로 갱신)
  - `docs/modules/registry.json` (status/version 갱신)
  - `phases/baselines/0-docx-to-template.json` (신규, phase 마감 baseline)
- read_contracts: 전체 (검증 step)
- forbidden_paths: 없음 (버그 발견 시 해당 owner step 범위 내에서만 수정, 범위를 벗어나면 `blocking-fix` step append)

## 계약 및 베이스라인

- 이 step은 새 기능을 추가하지 않는다. Step 0~3에서 만든 걸 실제 예시 문서로 끝까지 돌려서 검증하고, phase를 마감한다.

## 작업

### 1. 전체 파이프라인 실행

```bash
OPENAI_API_KEY=sk-... repgen-analyze-doc \
  --source "/Users/whyun/내 드라이브/국제표준화/JTC 1 SC 6/26-07-WG 7/Output/OD-250328-SC6-WG7-N484-Recommendations.docx" \
  --output /Users/whyun/workspace/SERVICE/RepGen/.skills/filldoc/templates/template-wg-recommendations.docx \
  --provider openai
```

### 2. 생성된 템플릿 왕복 검증

```bash
repgen-extract-doc --template /Users/whyun/workspace/SERVICE/RepGen/.skills/filldoc/templates/template-wg-recommendations.docx
```
- `recommendations` (또는 AI가 지은 유사한 이름) 이 `isLoop: true`이고 `no`/`title`/`body` 류 필드를 갖는지 확인
- 문서 메타(제목/문서번호/source 등)가 개별 placeholder로 잡히는지 확인

```bash
repgen-render-doc --template .../template-wg-recommendations.docx --data-json '{...}' --output /tmp/round-trip.docx
```
- 2~3개짜리 임의 recommendation 배열로 렌더링해서 표/문단이 정상 반복되는지 열어서 확인 (`repgen-extract-doc`처럼 텍스트로도 확인 가능: `extractTextFromBuffer`로 결과 docx 텍스트 덤프해서 반복 횟수만큼 나오는지 확인)

### 3. 회귀 확인

- 기존 웹 UI "AI 템플릿 생성"(`userRequest` 모드, `generateTemplateDocx`)이 여전히 동작하는지 `next dev`로 최소 1회 확인 (브라우저 또는 API 흐름)
- `npx tsc --noEmit --pretty false` — phase 이전과 동일 수준(무관 에러 1건만) 유지 확인
- `npm run lint` — 에러 없음 유지 확인

### 4. Phase 마감

- `docs/modules/template-analyzer/MODULE.md` status → `implemented`, version bump
- `docs/modules/registry.json`의 `template-analyzer.status` → `implemented`, `updated_at` 채움
- `phases/baselines/0-docx-to-template.json` 작성 (baseline.json.tmpl 형식 준수): 완료 태그, 신규 export 목록(`generateTemplateFromSample`, `RepeatingSectionBlock`), 신규 CLI(`repgen-analyze-doc`), known issues(있으면)
- `phases/index.json`, `phases/0-docx-to-template/index.json`의 status를 `completed`로 갱신

## Acceptance Criteria

- [ ] 실제 WG7 Recommendations 문서로 `repgen-analyze-doc` → `repgen-extract-doc` → `repgen-render-doc` 전체 왕복이 에러 없이 성공한다
- [ ] 생성된 템플릿의 loop 렌더링이 원본 문서의 반복 구조(14개 recommendation)를 표현할 수 있음을 확인했다 (렌더링 시 N개로 정상 반복)
- [ ] 기존 웹 UI AI 템플릿 생성 경로 회귀 없음
- [ ] `npx tsc --noEmit`, `npm run lint` 클린 유지
- [ ] `docs/modules/registry.json`, `docs/modules/template-analyzer/MODULE.md`, `phases/baselines/0-docx-to-template.json`이 최신 상태다
- [ ] `python3 scripts/validate_phase.py 0-docx-to-template --root /Users/whyun/workspace/SERVICE/RepGen` 통과 (harness_framework 루트에서 실행)

## 검증 절차

1. 위 "작업" 1~3을 순서대로 실행하고 결과를 기록한다
2. 문제 발견 시: 범위가 이 step 안이면 즉시 수정, 범위를 벗어나면 `blocking-fix` step을 append하고 이 step은 `blocked`로 남긴다
3. Phase 마감 아티팩트 작성
4. `phases/index.json`, `phases/0-docx-to-template/index.json` 최종 상태 갱신
5. git 커밋 (RepGen 저장소, step 단위)

## 금지사항

- 이 step에서 새로운 기능/옵션을 추가하지 않는다 (검증과 마감만).
- 발견된 버그가 이 phase 범위를 벗어나면(예: 기존 fill-doc 관련) 이 phase에서 고치지 말고 별도 이슈로 남긴다.
