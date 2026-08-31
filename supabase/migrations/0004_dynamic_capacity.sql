-- ============================================================================
--  0004 — 정원 자동 산정: (로그인 총원 ÷ 분반 수), 관리자가 OPEN 하는 시점에 고정
--  0001~0003 실행 후 이 파일을 실행하세요.
-- ============================================================================

-- ---------- 로그인 인원 기록 ------------------------------------------
create table if not exists public.attendees (
  id         uuid primary key default gen_random_uuid(),
  ranch_name text not null,
  user_name  text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists uniq_attendee
  on public.attendees (ranch_name, user_name);

alter table public.attendees enable row level security;
-- 정책 없음 → anon/authenticated 직접 접근 차단. 이름은 노출하지 않는다.

-- 인원 수만 공개 (PII 없음)
create or replace view public.attendee_stats as
  select count(*)::int as total from public.attendees;
grant select on public.attendee_stats to anon, authenticated;

-- 로그인 기록 함수 (서버 /api/login 에서 호출). 중복은 무시.
create or replace function public.record_attendee(p_ranch text, p_name text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  p_ranch := btrim(coalesce(p_ranch, ''));
  p_name  := btrim(coalesce(p_name, ''));
  if p_ranch = '' or p_name = '' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  insert into public.attendees (ranch_name, user_name)
  values (p_ranch, p_name)
  on conflict (ranch_name, user_name) do nothing;
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function public.record_attendee(text, text) from public, anon, authenticated;
grant  execute on function public.record_attendee(text, text) to service_role;

-- ---------- app_settings 확장 --------------------------------------
alter table public.app_settings
  add column if not exists capacity_per_class     int,   -- OPEN 시 고정된 분반당 정원
  add column if not exists attendee_count_at_open int;   -- 고정 당시 로그인 총원

-- ---------- admin_set_status: OPEN 시 정원 고정 -------------------
create or replace function public.admin_set_status(p_password text, p_status text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attendees int;
  v_classes   int;
  v_cap       int;
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;
  if p_status not in ('CLOSED', 'OPEN', 'FINISHED') then
    return jsonb_build_object('ok', false, 'error', 'BAD_STATUS');
  end if;

  if p_status = 'OPEN' then
    select total into v_attendees from public.attendee_stats;
    select count(*)::int into v_classes from public.classes;

    if coalesce(v_classes, 0) = 0 then
      return jsonb_build_object('ok', false, 'error', 'NO_CLASSES');
    end if;
    if coalesce(v_attendees, 0) = 0 then
      return jsonb_build_object('ok', false, 'error', 'NO_ATTENDEES');
    end if;

    -- 올림(ceil): 균등 분배 시 전원이 한 곳은 신청 가능하도록
    v_cap := greatest(ceil(v_attendees::numeric / v_classes)::int, 1);

    update public.classes
      set max_capacity = v_cap
      where max_capacity is distinct from v_cap;
    update public.app_settings
      set status = 'OPEN',
          capacity_per_class = v_cap,
          attendee_count_at_open = v_attendees,
          updated_at = now()
      where id = 1;

    return jsonb_build_object(
      'ok', true, 'status', 'OPEN',
      'capacity_per_class', v_cap, 'attendees', v_attendees, 'classes', v_classes
    );
  end if;

  update public.app_settings set status = p_status, updated_at = now() where id = 1;
  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

-- ---------- admin_reset: 로그인 인원 / 고정 정원도 초기화 --------
create or replace function public.admin_reset(p_password text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;
  delete from public.registrations where true;
  delete from public.attendees    where true;
  update public.classes set current_count = 0 where current_count <> 0;
  update public.app_settings
    set status = 'CLOSED',
        capacity_per_class = null,
        attendee_count_at_open = null,
        updated_at = now()
    where id = 1;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- admin_upsert_class: 정원 파라미터 제거 --------------
-- 새 부스는 현재 고정 정원(capacity_per_class)으로 생성, 이후엔 OPEN 시 일괄 재산정.
create or replace function public.admin_upsert_class(p_password text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id   uuid;
  v_name text := btrim(coalesce(p_payload->>'name', ''));
  v_main text := btrim(coalesce(p_payload->>'instructor', ''));
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;
  if v_name = '' or v_main = '' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  v_id := nullif(p_payload->>'id', '')::uuid;

  if v_id is null then
    insert into public.classes
      (name, instructor, instructor_sub, description, location, materials, max_capacity, sort_order)
    values
      (v_name, v_main,
       nullif(btrim(coalesce(p_payload->>'instructor_sub','')), ''),
       nullif(btrim(coalesce(p_payload->>'description','')), ''),
       nullif(btrim(coalesce(p_payload->>'location','')), ''),
       nullif(btrim(coalesce(p_payload->>'materials','')), ''),
       coalesce((select capacity_per_class from public.app_settings where id = 1), 1),
       coalesce((select max(sort_order) from public.classes), 0) + 1)
    returning id into v_id;
  else
    update public.classes set
      name           = v_name,
      instructor     = v_main,
      instructor_sub = nullif(btrim(coalesce(p_payload->>'instructor_sub','')), ''),
      description    = nullif(btrim(coalesce(p_payload->>'description','')), ''),
      location       = nullif(btrim(coalesce(p_payload->>'location','')), ''),
      materials      = nullif(btrim(coalesce(p_payload->>'materials','')), ''),
      sort_order     = coalesce((p_payload->>'sort_order')::int, sort_order)
    where id = v_id;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
