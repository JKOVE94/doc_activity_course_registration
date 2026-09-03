-- ============================================================================
--  0016 — 개발자(dev) 비밀번호 + 참가자(신청 내역) 초기화
--    · admin_secret.dev_password (기본 'admin00') 로 로그인하면 dev 모드
--      → 테스트 도구 / 전체 초기화 사용 가능
--    · 일반 관리자 비밀번호로는 "참가자 초기화"(신청 내역만)만 가능
--  0001~0015 실행 후 이 파일을 실행하세요.
-- ============================================================================

alter table public.admin_secret
  add column if not exists dev_password text not null default 'admin00';

-- 일반/개발자 비밀번호 모두 통과 (기존 함수들이 사용)
create or replace function public.admin_verify(p_password text)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.admin_secret
    where id = 1 and (password = p_password or dev_password = p_password)
  );
$$;

-- 개발자 비밀번호 전용 확인
create or replace function public.admin_is_dev(p_password text)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.admin_secret where id = 1 and dev_password = p_password
  );
$$;

-- 로그인 결과 (ok + dev 여부)
create or replace function public.admin_auth(p_password text)
returns jsonb
language sql security definer set search_path = public
as $$
  select case
    when exists (select 1 from public.admin_secret where id = 1 and dev_password = p_password)
      then jsonb_build_object('ok', true, 'dev', true)
    when exists (select 1 from public.admin_secret where id = 1 and password = p_password)
      then jsonb_build_object('ok', true, 'dev', false)
    else jsonb_build_object('ok', false, 'dev', false)
  end;
$$;

-- 참가자(신청 내역) 초기화 — 부스/로그인 인원/상태는 유지
create or replace function public.admin_clear_registrations(
  p_password  text,
  p_class_id  uuid default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_deleted int;
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;

  if p_class_id is null then
    delete from public.registrations where true;
    get diagnostics v_deleted = row_count;
    update public.classes set current_count = 0 where current_count <> 0;
  else
    delete from public.registrations where class_id = p_class_id;
    get diagnostics v_deleted = row_count;
    update public.classes set current_count = 0 where id = p_class_id and current_count <> 0;
  end if;

  return jsonb_build_object('ok', true, 'deleted', v_deleted);
end;
$$;

revoke execute on function public.admin_is_dev(text)                        from public, anon, authenticated;
revoke execute on function public.admin_auth(text)                          from public, anon, authenticated;
revoke execute on function public.admin_clear_registrations(text, uuid)     from public, anon, authenticated;
grant  execute on function public.admin_is_dev(text)                        to service_role;
grant  execute on function public.admin_auth(text)                          to service_role;
grant  execute on function public.admin_clear_registrations(text, uuid)     to service_role;

notify pgrst, 'reload schema';
