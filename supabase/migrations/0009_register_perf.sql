-- ============================================================================
--  0009 — 신청/취소 함수 동시성 최적화
--  * 임계구역(행 락 보유 시간)을 최소화: SELECT..FOR UPDATE 대신 조건부 원자 UPDATE
--  * lock_timeout / statement_timeout 으로 지연 폭주 시 빠르게 실패
--  0001~0008 실행 후 이 파일을 실행하세요.
-- ============================================================================

create or replace function public.register_for_class(
  p_class_id uuid,
  p_ranch_name text,
  p_user_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
set lock_timeout = '3s'
set statement_timeout = '8s'
as $$
declare
  v_status  text;
  v_updated int;
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

  -- 1인 1부스: 이미 신청돼 있으면 차단 (유니크 인덱스 조회, 락 없음)
  if exists (
    select 1 from public.registrations
    where ranch_name = p_ranch_name and user_name = p_user_name
  ) then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_REGISTERED');
  end if;

  -- 원자적 정원 확보: 조건부 UPDATE. 행 락은 이 문장 실행 동안만 유지된다.
  -- 동시 트랜잭션은 커밋된 최신 current_count 로 WHERE 를 재평가한다(정원 초과 불가).
  update public.classes
    set current_count = current_count + 1
    where id = p_class_id and current_count < max_capacity;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    if not exists (select 1 from public.classes where id = p_class_id) then
      return jsonb_build_object('ok', false, 'error', 'CLASS_NOT_FOUND');
    end if;
    return jsonb_build_object('ok', false, 'error', 'FULL');
  end if;

  -- 신청 기록. 같은 사람의 동시 중복 클릭은 유니크 인덱스가 차단하며,
  -- 그 경우 아래 EXCEPTION 에서 위 +1 UPDATE 까지 함께 롤백된다(보정 불필요).
  insert into public.registrations (class_id, ranch_name, user_name)
  values (p_class_id, p_ranch_name, p_user_name);

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'ALREADY_REGISTERED');
  when lock_not_available or query_canceled then
    return jsonb_build_object('ok', false, 'error', 'BUSY');
end;
$$;

create or replace function public.cancel_registration(
  p_ranch_name text,
  p_user_name text
) returns jsonb
language plpgsql
security definer
set search_path = public
set lock_timeout = '3s'
set statement_timeout = '8s'
as $$
declare
  v_class uuid;
begin
  p_ranch_name := btrim(coalesce(p_ranch_name, ''));
  p_user_name  := btrim(coalesce(p_user_name, ''));

  delete from public.registrations
  where ranch_name = p_ranch_name and user_name = p_user_name
  returning class_id into v_class;

  if v_class is null then
    return jsonb_build_object('ok', false, 'error', 'NO_REGISTRATION');
  end if;

  update public.classes
    set current_count = greatest(current_count - 1, 0)
    where id = v_class;

  return jsonb_build_object('ok', true);
exception
  when lock_not_available or query_canceled then
    return jsonb_build_object('ok', false, 'error', 'BUSY');
end;
$$;

revoke execute on function public.register_for_class(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.cancel_registration(text, text)      from public, anon, authenticated;
grant  execute on function public.register_for_class(uuid, text, text) to service_role;
grant  execute on function public.cancel_registration(text, text)      to service_role;

-- PostgREST 스키마 캐시 갱신 (함수 시그니처 변경 반영)
notify pgrst, 'reload schema';
