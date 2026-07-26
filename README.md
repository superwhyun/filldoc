# RepGen - AI 기반 문서 자동 생성 시스템

Word 템플릿의 플레이스홀더를 AI가 자동으로 채워주는 Next.js 기반 문서 생성 도구입니다.

## 🚀 주요 기능

- **스마트 플레이스홀더**: `{{keyword}}` 또는 `{{keyword:작성지침}}` 형식 지원
- **AI 자동 채우기**: OpenAI GPT-5 또는 xAI Grok-4-Fast로 내용 자동 생성
- **OpenAI 파일 검색 기반 처리**: 긴 입력은 `file_search`로 관련 근거를 검색해 채움
- **다중 파일 업로드**: 여러 참고 문서를 한 번에 업로드 (Drag & Drop 지원)
- **Word 파일 지원**: .docx 파일에서 텍스트 자동 추출
- **실시간 편집**: AI가 생성한 내용을 바로 수정 가능

## 🤖 AI 에이전트가 CLI로 쓰기 (브라우저 없이)

Hermes 같은 AI 에이전트는 브라우저나 Next 서버 없이, 이 저장소를 전역 CLI로 설치해서 바로 쓸 수 있다.

```bash
npm install -g git+https://github.com/superwhyun/RepGen.git
```

`repgen-extract-doc`, `repgen-render-doc`, `repgen-fill-doc`, `repgen-extract-text`, `repgen-templatize-doc`, `repgen-build-template`, `repgen-analyze-doc` 커맨드가 어느 작업 디렉토리에서든 바로 실행된다.

전체 커맨드 목록, 파라미터, 데이터 형식, 에러 처리 방식은 [`.skills/filldoc/SKILL.md`](./.skills/filldoc/SKILL.md)에 정리되어 있다. **에이전트는 이 저장소 링크만 받았다면 README보다 그 파일을 먼저 읽고 그대로 따라 하면 된다.**

## 📋 사용법 (웹 UI)

### 1️⃣ 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/superwhyun/RepGen.git
cd RepGen

# 의존성 설치
npm install
# 또는
pnpm install

# 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 접속

### 2️⃣ API 키 설정

1. 우측 상단 **⚙️ Settings** 버튼 클릭
2. API 키 입력:
   - **OpenAI**: `sk-`로 시작하는 키 (https://platform.openai.com/api-keys)
   - **Grok**: `xai-`로 시작하는 키 (https://console.x.ai)
3. 기본 AI 제공자 선택
4. **저장** 클릭

### 3️⃣ 템플릿 작성

Word 문서에 플레이스홀더를 작성합니다:

**기본 형식:**
```
{{company}}
{{date}}
```

**작성 지침 포함:**
```
{{title:문서 제목을 20자 이내로 작성}}
{{abstract:문서 개요를 300자 이내로 요약}}
{{summary:핵심 내용을 500자 이내로 요약}}
```

### 4️⃣ 문서 생성 과정

#### Step 1: 템플릿 업로드
- **Choose File** 클릭 또는 파일을 드래그하여 .docx 템플릿 업로드
- 자동으로 플레이스홀더 추출

#### Step 2: 플레이스홀더 확인
- 추출된 플레이스홀더 목록 확인
- 작성 지침이 있는 경우 함께 표시됨
- **Continue to Data Upload** 클릭

#### Step 3: 참고 자료 업로드
- 데이터 파일을 업로드 (여러 파일 선택 가능)
  - 텍스트 파일: .txt, .md
  - Word 문서: .docx
  - PDF 문서: .pdf
- 파일을 드래그 앤 드롭으로 추가
- 업로드된 파일 목록 확인
- **AI로 자동 채우기** 클릭

> 💡 **Tip**: Word 및 PDF 파일을 업로드하면 자동으로 텍스트를 추출하여 AI에 전달합니다.

### OpenAI 처리 방식 (현재 구현)

OpenAI 선택 시, 긴 텍스트를 프롬프트에 그대로 넣지 않고 아래 순서로 처리합니다.

1. 추출된 텍스트를 임시 파일로 업로드
2. 벡터 스토어 생성 및 인덱싱
3. `file_search`로 관련 근거 검색
4. GPT-5가 검색 결과를 바탕으로 플레이스홀더 채움
5. 처리 후 업로드 파일/벡터 스토어 즉시 정리(cleanup)

추가 동작:
- OpenAI 경로는 JSON Schema 기반 구조화 출력으로 파싱 안정성을 높입니다.
- `file_search` 실패 시 기존 inline 프롬프트 방식으로 1회 fallback 합니다.
- cleanup은 재시도(backoff) 로직으로 안정성을 높였습니다.

`/api/fill-placeholders` 응답에는 다음 필드가 포함될 수 있습니다.
- `filledPlaceholders`: 최종 채워진 값
- `evidence`: `file_search`가 찾은 근거 텍스트 목록
- `processing`: `usedFallback`, `fallbackReason`, `cleanup` 상태 등 실행 메타데이터

#### Step 4: 내용 편집
- AI가 자동으로 생성한 내용 확인
- 분석 메타 정보(file_search 사용 여부, fallback 여부) 확인
- 필요하면 근거 보기에서 검색된 텍스트 샘플 확인
- 필요시 각 항목을 직접 수정
- **Generate Document** 클릭

#### Step 5: 문서 다운로드
- 생성된 Word 문서 다운로드
- **Start Over**로 새 문서 작성

## 🎯 플레이스홀더 작성 팁

### 작성 지침 활용
AI가 더 정확한 내용을 생성하도록 구체적인 지침을 제공하세요:

```
❌ {{summary}}
✅ {{summary:문서의 핵심 내용을 3-5개 문단으로 요약하되, 기술적 용어는 쉽게 풀어서 설명}}

❌ {{date}}
✅ {{date:오늘 날짜를 YYYY-MM-DD 형식으로 기재}}

❌ {{author}}
✅ {{author:제1저자의 이름, 소속, 이메일을 한 줄로 작성}}
```

### 일반적인 플레이스홀더 예시

**문서 메타정보:**
```
{{version:문서 버전, 없으면 1.0}}
{{date:작성 날짜, YYYY-MM-DD 형식}}
{{author:작성자 이름}}
```

**문서 내용:**
```
{{title:문서 제목, 20자 이내}}
{{abstract:개요, 300자 이내}}
{{introduction:도입부, 배경과 목적을 설명}}
{{methodology:방법론, 연구/개발 방법 설명}}
{{results:결과 요약}}
{{conclusion:결론 및 향후 계획}}
```

**프로젝트 정보:**
```
{{project_name:프로젝트명}}
{{objective:프로젝트 목표를 3-5개 항목으로}}
{{timeline:주요 마일스톤과 일정}}
{{budget:예산 개요}}
```

### 표(Table) 만들기 - 더욱 편리해진 마법의 문법! ⭐
 
 이제 복잡한 `{{#루프}}...{{/루프}}` 태그를 직접 적을 필요가 없습니다. 점(.)을 활용한 직관적인 문법을 사용하세요.
 
 #### ✅ 가장 권장하는 방법 (Dot Notation)
 
 Word에서 표를 만들고 각 칸에 **`{{표이름.항목이름}}`** 형식으로 적기만 하세요:
 
 | 순번 | 과업 내용 | 담당자 |
 | :--- | :--- | :--- |
 | `{{tasks.no}}` | `{{tasks.name}}` | `{{tasks.owner}}` |
 
 **시스템이 알아서 처리하는 마법:**
 - `tasks.`으로 시작하는 태그들이 한 행에 있으면, 이 행 전체가 데이터 개수량만큼 자동으로 반복됩니다.
 - 사용자는 `#`이나 `/`를 적지 않아도 됩니다.
 - AI가 데이터를 채워주면, 화면에서 엑셀처럼 표 형식으로 바로 수정할 수 있습니다.
 
 #### 💡 AI 지침 추가하기
 표 전체에 대한 지침을 주고 싶다면 첫 번째 칸에 적어주세요:
 `{{tasks.no:업무 일정 5개를 추출해줘}}`
 
 #### ❌ 예전 방식 (Mustache 문법 - 여전히 지원은 됨)
 ```
 | {{#tasks}}{{no}}{{/tasks}} | {{name}} | {{owner}} |
 ```
 예전 방식은 Word에서 칸 너비를 많이 차지하고 복잡하지만, 기존 템플릿과의 호환성을 위해 여전히 작동은 합니다. 하지만 **점(.) 문법**이 훨씬 깔끔하고 강력합니다.

## 🛠️ 기술 스택

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui
- **AI**: OpenAI SDK (GPT-5), xAI SDK (Grok-4)
- **문서 처리**: docxtemplater, pizzip, pdf-parse
- **개발 도구**: nodemon, ESLint

## 📁 프로젝트 구조

```
RepGen/
├── app/
│   ├── api/
│   │   ├── extract-placeholders/  # 플레이스홀더 추출
│   │   ├── extract-text/          # Word 텍스트 추출
│   │   ├── fill-placeholders/     # AI 자동 채우기
│   │   └── generate-document/     # 문서 생성
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── template-upload.tsx        # 템플릿 업로드
│   ├── placeholder-list.tsx       # 플레이스홀더 목록
│   ├── data-upload.tsx            # 데이터 파일 업로드
│   ├── content-editor.tsx         # 내용 편집
│   └── settings-dialog.tsx        # API 키 설정
└── AGENTS.md                      # 에이전트 가이드라인
```

## 🔑 API 키 관리

### OpenAI API Key
- 발급: https://platform.openai.com/api-keys
- 형식: `sk-`로 시작
- 모델: `gpt-5.2` (Responses API 사용)

### Grok API Key
- 발급: https://console.x.ai
- 형식: `xai-`로 시작
- 모델: `grok-4-fast-non-reasoning` (빠른 non-reasoning 모델)

> ⚠️ **보안**: API 키는 브라우저의 localStorage에 저장되며, 서버로 전송되지 않습니다.

## 🐛 문제 해결

### API 키 오류
```
Incorrect API key provided
```
- Settings에서 API 키가 올바른 형식인지 확인 (sk- 또는 xai- 시작)
- 키를 다시 복사해서 붙여넣기

### Word 파일 업로드 오류
```
Failed to extract text from Word document
```
- .docx 형식인지 확인 (.doc 형식은 지원하지 않음)
- 파일이 암호화되지 않았는지 확인

### Duplicate open tag 오류
```
Duplicate open tag, expected one open tag
```
- Word 문서에서 `{{` 또는 `}}` 가 중복되지 않았는지 확인
- 플레이스홀더를 한 번에 입력 (복사-붙여넣기 권장)

## 📝 개발 가이드

### 환경 설정
```bash
# nodemon으로 개발 서버 실행 (자동 재시작)
npm run dev

# 일반 Next.js 개발 서버
npm run dev:next

# 빌드
npm run build

# 프로덕션 실행
npm run start
```

### 코드 스타일
- `"use client"` 지시어 사용 (클라이언트 컴포넌트)
- `@/` 경로 별칭 사용
- `type` over `interface`
- 에러 로그는 `[v0]` 접두사 사용

자세한 내용은 [AGENTS.md](./AGENTS.md) 참조

## 📄 라이선스

MIT License

## 🤝 기여

이슈와 PR은 언제나 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 문의

프로젝트 링크: https://github.com/superwhyun/RepGen
