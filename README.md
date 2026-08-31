# 연합목장활동 공통사모임 신청

청년부 연합목장모임 공통사 부스 **선착순 수강신청** 웹 서비스.
동시 접속 80~100명 규모에서 정원 초과 없이 안전하게 신청을 처리합니다.

- **Frontend**: Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · lucide-react
- **Backend/DB**: Next.js Route Handlers + Supabase (PostgreSQL)
- **배포**: Vercel

## 화면


| 경로          | 설명                                                            |
| ----------- | ------------------------------------------------------------- |
| `/`         | 간이 로그인 (목장 선택 + 이름). 우하단 `관리자 모드` 링크                          |
| `/booths`   | 부스 소개 (담당자/설명/장소/준비물/사진)                                      |
| `/register` | 실시간 수강신청 — 정원 현황, 프로그레스 바, 1인 1부스                             |
| `/board`    | 실시간 현황판 (인증 불필요, 큰 화면/프로젝터용) — 부스별 정원·신청 인원·신청자 명단            |
| `/admin`    | 관리자 대시보드 — 부스 관리(추가·수정·삭제, 사진 3장) / 상태 토글 / 명단 / CSV / 전체 초기화 |


## 정원 산정

부스별로 정원을 따로 정하지 않습니다. 관리자가 **'오픈'하는 순간**
`ceil(로그인 인원 ÷ 부스 수)`를 계산해 모든 부스에 동일한 정원으로 고정합니다.
(로그인 시 `/api/login` → `attendees` 테이블 기록. '대기'→'오픈'을 다시 하면 그 시점 인원으로 재계산.)

## 동시성 · 성능 (80~100명 동시 신청)

**정원 초과 방지** — `register_for_class()` 가 조건부 원자 UPDATE 로 정원을 확보합니다:
`UPDATE classes SET current_count = current_count + 1 WHERE id = ? AND current_count < max_capacity`.
동시 트랜잭션은 커밋된 최신값으로 WHERE 를 재평가하므로 정원을 넘길 수 없고,
행 락은 이 한 문장 동안만 유지됩니다(임계구역 최소화). `lock_timeout`/`statement_timeout`
으로 폭주 시 빠르게 실패(`BUSY`)합니다. `registrations(ranch_name, user_name)` 유니크
인덱스가 1인 1부스를 이중으로 강제합니다.

**읽기 부하** — 공개 화면은 `GET /api/snapshot` 하나만 폴링하며 Vercel CDN 이 2초
캐시(+SWR)합니다. 접속자가 80명이든 800명이든 원본 DB 에는 초당 1회 미만으로만
요청이 갑니다. Realtime 이벤트는 클라이언트에서 1~1.2초로 합쳐(debounce) 재조회 폭주를 막습니다.

**기타** — 함수 리전 `icn1`(서울), 이미지 `immutable` + 조건부요청(304) 캐시,
로그인 인원 기록은 세션당 1회.

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

1. [https://supabase.com/dashboard](https://supabase.com/dashboard) 에서 새 프로젝트 생성
2. **SQL Editor** → 마이그레이션을 순서대로 실행:
  - `supabase/migrations/0001_init.sql`
  - `supabase/migrations/0002_harden_rpc.sql` (0001 을 이미 예전 버전으로 돌린 경우만)
  - `supabase/migrations/0003_class_management.sql` (부스 GUI 관리 + 사진 DB 저장)
  - `supabase/migrations/0004_dynamic_capacity.sql` (정원 자동 산정 + 로그인 인원 기록)
  - `supabase/migrations/0005_public_snapshot.sql` (공개 화면 통합 조회 함수 — 로딩 속도)
  - `supabase/migrations/0006_safe_where.sql` (pg_safeupdate 대응 — reset/오픈 함수 WHERE 보강)
  - `supabase/migrations/0007_reset_feedback.sql` (초기화 삭제 건수 반환)
  - `supabase/migrations/0008_reset_scope_and_demo.sql` (초기화에 부스 포함 + 테스트 데이터 생성 함수)
  - `supabase/migrations/0009_register_perf.sql` (신청/취소 동시성 최적화)
  - `supabase/migrations/0010_attendee_rename.sql` (일반 유저 이름/목장 변경)
  - `supabase/migrations/0011_seed_scenarios.sql` (테스트 데이터 시나리오 3종)
  - `supabase/migrations/0012_reload_schema.sql` (PostgREST 스키마 캐시 갱신)

   > 함수를 바꾼 뒤 `Could not find the function ... in the schema cache` 오류가 나면
   > `notify pgrst, 'reload schema';` 를 SQL Editor 에서 실행하세요 (0012).
3. 실제 부스는 관리자 페이지 &amp;lsquo;부스 관리&amp;rsquo;에서 추가. 테스트는 관리자 &amp;lsquo;테스트 데이터 생성&amp;rsquo; 버튼으로 샘플 세팅.
4. 관리자 비밀번호 변경:
  ```sql
   update public.admin_secret set password = '원하는비밀번호' where id = 1;
  ```
5. **Database → Replication** 에서 `classes`, `app_settings`, `registrations` 가
supabase_realtime` publication 에 포함됐는지 확인 (마이그레이션이 자동 추가)

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

1. 관리자 `/admin` 접속 → 부스 관리에서 부스/사진 등록, 상태 **대기**
2. 청년들 로그인(인원 집계) 후 `/booths` 에서 부스 확인 (신청 버튼은 비활성)
3. **전원 로그인 완료 후** 관리자가 **오픈** → 그 시점 인원으로 분반당 정원 확정, 실시간 신청 진행
4. 마감 후 관리자가 **종료** → **CSV 다운로드**
5. 다음 행사 전 **전체 초기화** (신청·로그인 인원·고정 정원 모두 리셋)

