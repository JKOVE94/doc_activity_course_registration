# 연합목장 공통사 수강신청

청년부 연합목장모임 공통사 부스 **선착순 수강신청** 웹 서비스.
동시 접속 80~100명 규모에서 정원 초과 없이 안전하게 신청을 처리합니다.

- **Frontend**: Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · lucide-react
- **Backend/DB**: Next.js Route Handlers + Supabase (PostgreSQL)
- **배포**: Vercel

## 화면

| 경로 | 설명 |
|---|---|
| `/` | 간이 로그인 (목장 선택 + 이름). 우하단 `관리자 모드` 링크 |
| `/booths` | 부스 소개 (강사/설명/장소/준비물/정원) |
| `/register` | 실시간 수강신청 — 정원 현황, 프로그레스 바, 1인 1클래스 |
| `/admin` | 관리자 대시보드 — 부스 관리(추가·수정·삭제, 사진 3장) / 상태 토글 / 명단 / CSV / 전체 초기화 |

## 동시성(Race Condition) 처리

`register_for_class()` DB 함수가 대상 클래스 row 를 `SELECT ... FOR UPDATE` 로 잠급니다.
같은 부스에 대한 동시 신청은 DB 레벨에서 직렬화되므로, 정원이 1자리 남은 상태에서
여러 명이 동시에 눌러도 **초과 신청이 발생하지 않습니다.**
`registrations (ranch_name, user_name)` 유니크 인덱스가 1인 1클래스를 추가로 강제합니다.

모든 쓰기는 서버 API Route(secret key)를 거쳐 DB 함수로만 실행되며,
클라이언트는 테이블을 읽고 Realtime 구독만 합니다 (RLS 로 직접 쓰기 차단).

### 브라우저에 노출되는 값

`NEXT_PUBLIC_SUPABASE_URL` 과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 는 브라우저로 내려가지만
**의도된 것이며 안전**합니다 (Supabase publishable 키는 공개 공유 가능하도록 설계됨):

- `anon` 역할 권한만 가지며 상승 권한 없음
- 테이블 접근은 RLS 로 제한 — `classes`/`registrations`/`app_settings` 는 **SELECT 만**, 쓰기 정책 없음
- 신청/취소/관리 DB 함수는 `service_role`(secret key) 에게만 `execute` 부여 → publishable 키로 직접 호출 불가
- `admin_secret` 테이블은 모든 역할 접근 차단

Vercel 에서 이 두 변수는 "Config"(비민감)로, `SUPABASE_SECRET_KEY` 는 "Sensitive"로 등록하세요.

## 로컬 실행

### 1. Supabase 프로젝트 생성
1. <https://supabase.com/dashboard> 에서 새 프로젝트 생성
2. **SQL Editor** → 마이그레이션을 순서대로 실행:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_harden_rpc.sql` (0001 을 이미 예전 버전으로 돌린 경우만)
   - `supabase/migrations/0003_class_management.sql` (부스 GUI 관리 + 사진 DB 저장)
3. (선택) `supabase/seed.sql` 실행해 샘플 부스 6개 삽입 — 실제 부스는 관리자 페이지에서 추가
4. 관리자 비밀번호 변경:
   ```sql
   update public.admin_secret set password = '원하는비밀번호' where id = 1;
   ```
5. **Database → Replication** 에서 `classes`, `app_settings`, `registrations` 가
   `supabase_realtime` publication 에 포함됐는지 확인 (마이그레이션이 자동 추가)

### 2. 환경변수
`.env.local` 에 **Project Settings → API Keys**(Publishable and secret API keys 탭) 값 입력:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```
> 레거시 키(`anon` / `service_role` JWT)를 쓰는 경우 `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
> `SUPABASE_SERVICE_ROLE_KEY` 로 넣어도 코드가 fallback 처리한다.

### 3. 개발 서버
```bash
npm install
npm run dev        # http://localhost:3000
```

## Vercel 배포

```bash
npm i -g vercel        # 최초 1회
vercel login
vercel link            # 프로젝트 연결/생성
# 환경변수 3개 등록 (Production + Preview + Development)
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
vercel env add SUPABASE_SECRET_KEY
vercel --prod
```

또는 GitHub 저장소를 Vercel 대시보드에서 Import → Environment Variables 3개 입력 → Deploy.
이후 `main` 브랜치 push 시 자동 배포됩니다.

## 운영 순서 (행사 당일)

1. 관리자 `/admin` 접속 → 상태 **대기**
2. 청년들 로그인 후 `/booths` 에서 부스 확인 (신청 버튼은 비활성)
3. 시작 시각에 관리자가 **오픈** → 실시간 신청 진행
4. 마감 후 관리자가 **종료** → **CSV 다운로드**
5. 다음 행사 전 **전체 초기화**
