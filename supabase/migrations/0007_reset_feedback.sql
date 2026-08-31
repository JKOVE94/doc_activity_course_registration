-- ============================================================================
--  0007 — admin_reset 이 실제 삭제 건수를 반환하도록 (진단 + 사용자 피드백)
--  0001~0006 실행 후 이 파일을 실행하세요.
-- ============================================================================

create or replace function public.admin_reset(p_password text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_regs      int;
  v_attendees int;
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;

  delete from public.registrations where true;
  get diagnostics v_regs = row_count;

  delete from public.attendees where true;
  get diagnostics v_attendees = row_count;

  update public.classes set current_count = 0 where current_count <> 0;

  update public.app_settings
    set status = 'CLOSED',
        capacity_per_class = null,
        attendee_count_at_open = null,
        updated_at = now()
    where id = 1;

  return jsonb_build_object(
    'ok', true,
    'deleted_registrations', v_regs,
    'deleted_attendees', v_attendees
  );
end;
$$;
