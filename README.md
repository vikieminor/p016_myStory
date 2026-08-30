# 나의 이야기 (My Story)

질문으로 자신의 이야기를 기록하고 출판용 PDF를 만드는 웹서비스입니다.

## 실행

```bash
npm run dev
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다.

## 데이터베이스 연결 (Supabase)

1. Supabase SQL Editor에서 [`supabase-schema.sql`](./supabase-schema.sql)을 실행합니다.
2. [`.env.example`](./.env.example)을 `.env`로 복사하고 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_ANON_KEY`, `ADMIN_TOKEN`을 채운 뒤 `USE_SUPABASE=true`를 설정합니다. `SUPABASE_ANON_KEY`는 브라우저 Supabase Auth client에 사용되는 공개 키이며, `SUPABASE_SECRET_KEY`와 `ADMIN_TOKEN`은 서버에만 보관합니다.
3. 서버를 재시작합니다. 시작 로그가 `Supabase`로 표시되면 연결된 상태입니다.

`USE_SUPABASE=true`가 아니면 `data/`의 JSON 파일을 사용해 로컬에서 동일하게 동작합니다.

관리자에서 `#admin/reviews`에 처음 접근하면 `ADMIN_TOKEN`을 입력합니다. 토큰은 현재 브라우저 탭의 session storage에만 저장되며, 서버의 service role key는 브라우저로 전달되지 않습니다.

공통 로그인 화면은 `#login`, Moments 작성 화면은 `#moments`에서 Supabase Auth를 사용합니다. 이메일 로그인과 Google 로그인을 사용하려면 Supabase Auth의 Google provider를 활성화하고, `SUPABASE_ANON_KEY`를 설정해야 합니다. 로그인한 사용자 중 관리자가 `moment_authors.is_active` 권한을 부여한 사용자만 Moments를 작성할 수 있습니다. `SUPABASE_ANON_KEY`만 브라우저 Auth client에 전달되며, service role key는 전달되지 않습니다.

PDF 출판은 별도 변환 라이브러리 없이 브라우저 인쇄 창을 열어 **PDF로 저장**하도록 구현했습니다.
