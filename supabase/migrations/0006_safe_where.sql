-- ============================================================================
--  0006 — Supabase pg_safeupdate 가드 대응
--  WHERE 없는 DELETE/UPDATE 가 "DELETE requires a WHERE clause" 로 막히므로
--  admin_reset / admin_set_status 를 WHERE 포함 버전으로 재정의.
--  0001~0005 실행 후 이 파일을 실행하세요.
-- ============================================================================

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
