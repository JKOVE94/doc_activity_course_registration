-- ============================================================================
--  0013 — 특정 부스에 정원 상한(capacity_cap) 지정
--    기본은 ceil(로그인 인원 ÷ 부스 수). 부스에 상한이 있으면 그보다 크게
--    배정되지 않는다 → max_capacity = LEAST(평균정원, capacity_cap).
--  0001~0012 실행 후 이 파일을 실행하세요.
-- ============================================================================

alter table public.classes
  add column if not exists capacity_cap int check (capacity_cap is null or capacity_cap >= 1);

-- ---------- admin_upsert_class: capacity_cap 반영 --------------------
create or replace function public.admin_upsert_class(p_password text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id   uuid;
  v_name text := btrim(coalesce(p_payload->>'name', ''));
  v_main text := btrim(coalesce(p_payload->>'instructor', ''));
  v_cap  int  := nullif(btrim(coalesce(p_payload->>'capacity_cap', '')), '')::int;
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;
  if v_name = '' or v_main = '' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;
  if v_cap is not null and v_cap < 1 then
    v_cap := null;
  end if;

  v_id := nullif(p_payload->>'id', '')::uuid;

  if v_id is null then
    insert into public.classes
      (name, instructor, instructor_sub, description, location, materials,
       max_capacity, capacity_cap, sort_order)
    values
      (v_name, v_main,
       nullif(btrim(coalesce(p_payload->>'instructor_sub','')), ''),
       nullif(btrim(coalesce(p_payload->>'description','')), ''),
       nullif(btrim(coalesce(p_payload->>'location','')), ''),
       nullif(btrim(coalesce(p_payload->>'materials','')), ''),
       coalesce(
         least(
           (select capacity_per_class from public.app_settings where id = 1),
           v_cap
         ),
         v_cap, 1),
       v_cap,
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
      capacity_cap   = v_cap,
      sort_order     = coalesce((p_payload->>'sort_order')::int, sort_order)
    where id = v_id;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- ---------- admin_set_status: OPEN 시 상한 적용 --------------------
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

    v_cap := greatest(ceil(v_attendees::numeric / v_classes)::int, 1);

    -- 부스별: 평균정원과 상한 중 작은 값
    update public.classes
      set max_capacity = least(v_cap, coalesce(capacity_cap, v_cap))
      where true;

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

notify pgrst, 'reload schema';
