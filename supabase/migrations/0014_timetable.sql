-- ============================================================================
--  0014 — 부스별 타임테이블(시간표)
--    classes.timetable : [{ "start": "17:00", "end": "17:20", "activity": "..." }, ...]
--    각 일정의 start 는 앞 일정의 end 와 이어진다(관리 UI 에서 체인 처리).
--  0001~0013 실행 후 이 파일을 실행하세요.
-- ============================================================================

alter table public.classes
  add column if not exists timetable jsonb not null default '[]'::jsonb;

create or replace function public.admin_upsert_class(p_password text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id   uuid;
  v_name text := btrim(coalesce(p_payload->>'name', ''));
  v_main text := btrim(coalesce(p_payload->>'instructor', ''));
  v_cap  int  := nullif(btrim(coalesce(p_payload->>'capacity_cap', '')), '')::int;
  v_tt   jsonb := case
                    when jsonb_typeof(p_payload->'timetable') = 'array'
                      then p_payload->'timetable'
                    else '[]'::jsonb
                  end;
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
       max_capacity, capacity_cap, timetable, sort_order)
    values
      (v_name, v_main,
       nullif(btrim(coalesce(p_payload->>'instructor_sub','')), ''),
       nullif(btrim(coalesce(p_payload->>'description','')), ''),
       nullif(btrim(coalesce(p_payload->>'location','')), ''),
       nullif(btrim(coalesce(p_payload->>'materials','')), ''),
       coalesce(
         least((select capacity_per_class from public.app_settings where id = 1), v_cap),
         v_cap, 1),
       v_cap,
       v_tt,
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
      timetable      = v_tt,
      sort_order     = coalesce((p_payload->>'sort_order')::int, sort_order)
    where id = v_id;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

notify pgrst, 'reload schema';
