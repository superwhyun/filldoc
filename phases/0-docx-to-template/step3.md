# Step 3: skill-docs

## 읽어야 할 파일

- `.skills/filldoc/SKILL.md` (기존 CLI 문서화 섹션 구조)
- `AGENTS.md`의 Skills 섹션
- `scripts/analyze-doc.ts` (Step 2 결과, `--help`/인자 확인용)

## 모듈 할당

- module: `template-analyzer`
- owned_paths:
  - `.skills/filldoc/SKILL.md` (섹션 추가만)
- read_contracts:
  - `scripts/analyze-doc.ts`의 CLI 인자 계약
- forbidden_paths:
  - `scripts/`, `lib/` (문서화만, 구현 변경 없음)

## 계약 및 베이스라인

- 기존 SKILL.md의 "1) Hermes 같은 AI 에이전트가 호출할 때" / "2) RepGen 자체 AI 호출로 채울 때" 섹션 구조와 톤을 그대로 따른다.

## 작업

### 1. `.skills/filldoc/SKILL.md`에 새 섹션 추가

"템플릿이 아직 없을 때" 같은 제목으로, 기존 "0) 템플릿 목록 조회/추가" 섹션 앞이나 뒤에 추가:

```bash
OPENAI_API_KEY=sk-... repgen-analyze-doc \
  --source ./예시-회의록.docx \
  --output /Users/whyun/workspace/SERVICE/RepGen/.skills/filldoc/templates/새템플릿.docx \
  --provider openai
```

- 언제 쓰는지: 사용자가 "이 문서 형식대로 템플릿 만들어줘" 또는 기존에 채워진 문서를 예시로 주면서 "이런 문서 또 만들 수 있게 템플릿화해줘"라고 요청할 때.
- `--output`을 `.skills/filldoc/templates/`(= `template/` symlink) 안에 저장하면 곧바로 `extract-doc`/`render-doc`/`fill-doc`에서 재사용 가능하다는 점을 명시.
- 생성된 템플릿은 AI 추론 결과이므로, 생성 직후 `repgen-extract-doc`으로 placeholder 목록을 사람이 한 번 확인하는 걸 권장한다고 적는다.

### 2. `AGENTS.md` Skills 트리거 예시 갱신 (선택)

"템플릿 생성" 관련 트리거 문구를 한 줄 추가할 수 있으면 추가 (필수 아님, 과하게 손대지 않는다).

## Acceptance Criteria

- [ ] `.skills/filldoc/SKILL.md`에 `repgen-analyze-doc` 사용법이 문서화되어 있다
- [ ] 기존 섹션 내용/구조가 손상되지 않았다 (diff로 확인)

## 검증 절차

1. `.skills/filldoc/SKILL.md` 렌더링해서 새 섹션이 기존 톤/포맷과 일관되는지 확인
2. `phases/0-docx-to-template/index.json`에서 step3 status를 `completed`로 갱신

## 금지사항

- 코드 변경 없이 문서만 수정한다.
- 기존 SKILL.md 섹션의 내용을 삭제/축소하지 않는다.
