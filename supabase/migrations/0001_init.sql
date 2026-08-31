-- ============================================================================
--  연합목장 공통사 수강신청 — 초기 스키마 / 함수 / RLS
--  Supabase 대시보드 > SQL Editor 에 그대로 붙여넣어 실행하세요.
-- ============================================================================

-- ---------- 테이블 ----------------------------------------------------------

create table if not exists public.classes (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  instructor    text not null,
  description   text,
  location      text,
  materials     text,
  max_capacity  int  not null check (max_capacity > 0),
  current_count int  not null default 0 check (current_count >= 0),
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.registrations (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes(id) on delete cascade,
  ranch_name text not null,
  user_name  text not null,
  seq        bigint generated always as identity,   -- 전체 신청 순번
  created_at timestamptz not null default now()
);

-- 1인 1클래스: (목장, 이름) 조합은 전체에서 단 1건
create unique index if not exists uniq_reg_person
  on public.registrations (ranch_name, user_name);
create index if not exists idx_reg_class
  on public.registrations (class_id, seq);

-- 신청 상태 (공개 읽기 가능, Realtime 대상)
create table if not exists public.app_settings (
  id         int  primary key default 1,
  status     text not null default 'CLOSED'
             check (status in ('CLOSED','OPEN','FINISHED')),
  updated_at timestamptz not null default now(),
  constraint app_settings_one_row check (id = 1)
);
insert into public.app_settings (id) values (1)
  on conflict (id) do nothing;

-- 관리자 비밀번호 (어떤 역할에도 접근 권한을 주지 않음 → SECURITY DEFINER 함수로만 확인)
create table if not exists public.admin_secret (
  id       int  primary key default 1,
  password text not null default '0000',
  constraint admin_secret_one_row check (id = 1)
);
insert into public.admin_secret (id, password) values (1, '0000')
  on conflict (id) do nothing;

-- ---------- RLS -----------------------------------------------------------

alter table public.classes       enable row level security;
alter table public.registrations enable row level security;
alter table public.app_settings  enable row level security;
alter table public.admin_secret  enable row level security;

drop policy if exists "read classes"  on public.classes;
drop policy if exists "read regs"     on public.registrations;
drop policy if exists "read settings" on public.app_settings;

create policy "read classes"  on public.classes       for select using (true);
create policy "read regs"     on public.registrations for select using (true);
create policy "read settings" on public.app_settings  for select using (true);
-- classes/registrations/app_settings : INSERT/UPDATE/DELETE 정책 없음 → 함수로만 변경
-- admin_secret : 어떤 정책도 없음 → anon/authenticated 완전 차단

revoke all on public.admin_secret from anon, authenticated;

-- ---------- 함수: 신청 -----------------------------------------------------
-- 대상 클래스 row 를 FOR UPDATE 로 잠가 동일 클래스 신청을 직렬화한다.
-- 정원이 1자리 남아도 동시 클릭 시 초과 신청이 불가능하다.

create or replace function public.register_for_class(
  p_class_id uuid,
  p_ranch_name text,
  p_user_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_max    int;
  v_cnt    int;
  v_seq    bigint;
begin
  p_ranch_name := btrim(coalesce(p_ranch_name, ''));
  p_user_name  := btrim(coalesce(p_user_name, ''));
  if p_ranch_name = '' or p_user_name = '' or p_class_id is null then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  select status into v_status from public.app_settings where id = 1;
  if v_status is distinct from 'OPEN' then
    return jsonb_build_object('ok', false, 'error', 'NOT_OPEN');
  end if;

  -- 🔒 클래스 row 잠금
  select max_capacity, current_count
    into v_max, v_cnt
  from public.classes
  where id = p_class_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'CLASS_NOT_FOUND');
  end if;

  if exists (
    select 1 from public.registrations
    where ranch_name = p_ranch_name and user_name = p_user_name
  ) then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_REGISTERED');
  end if;

  if v_cnt >= v_max then
    return jsonb_build_object('ok', false, 'error', 'FULL');
  end if;

  insert into public.registrations (class_id, ranch_name, user_name)
  values (p_class_id, p_ranch_name, p_user_name)
  returning seq into v_seq;

  update public.classes
  set current_count = current_count + 1
  where id = p_class_id;

  return jsonb_build_object('ok', true, 'seq', v_seq);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_REGISTERED');
end;
$$;

-- ---------- 함수: 취소 -----------------------------------------------------

create or replace function public.cancel_registration(
  p_ranch_name text,
  p_user_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class uuid;
begin
  p_ranch_name := btrim(coalesce(p_ranch_name, ''));
  p_user_name  := btrim(coalesce(p_user_name, ''));

  -- 취소도 클래스 row 를 잠가 카운터 정합성 유지
  select c.id into v_class
  from public.classes c
  join public.registrations r on r.class_id = c.id
  where r.ranch_name = p_ranch_name and r.user_name = p_user_name
  for update of c;

  if v_class is null then
    return jsonb_build_object('ok', false, 'error', 'NO_REGISTRATION');
  end if;

  delete from public.registrations
  where ranch_name = p_ranch_name and user_name = p_user_name;

  update public.classes
  set current_count = greatest(current_count - 1, 0)
  where id = v_class;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- 함수: 관리자 ------------------------------------------------

create or replace function public.admin_verify(p_password text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_secret where id = 1 and password = p_password);
$$;

create or replace function public.admin_set_status(p_password text, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;
  if p_status not in ('CLOSED','OPEN','FINISHED') then
    return jsonb_build_object('ok', false, 'error', 'BAD_STATUS');
  end if;
  update public.app_settings set status = p_status, updated_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

create or replace function public.admin_reset(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;
  delete from public.registrations;
  update public.classes set current_count = 0;
  update public.app_settings set status = 'CLOSED', updated_at = now() where id = 1;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- 실행 권한 ----------------------------------------------------
-- 신청/취소는 서버(service_role)에서 호출하지만 anon 도 호출 가능하도록 열어둔다
-- (판정 로직이 함수 내부에 있으므로 안전). 관리자 함수는 service_role 만.

grant execute on function public.register_for_class(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.cancel_registration(text, text)      to anon, authenticated, service_role;
grant execute on function public.admin_verify(text)                   to service_role;
grant execute on function public.admin_set_status(text, text)         to service_role;
grant execute on function public.admin_reset(text)                    to service_role;

-- ---------- Realtime ----------------------------------------------------
-- classes(정원 카운트) / app_settings(오픈 상태) 변경을 브라우저로 push.
-- 이미 publication 에 포함돼 있으면 조용히 건너뛴다.
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.classes'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.app_settings'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.registrations'; exception when duplicate_object then null; end;
end $$;
