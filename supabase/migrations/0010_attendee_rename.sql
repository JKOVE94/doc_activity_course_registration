-- ============================================================================
--  0010 — 일반 유저 이름/목장 변경 지원 (로그인 인원 레코드 교체)
--  0001~0009 실행 후 이 파일을 실행하세요.
-- ============================================================================

-- 2-arg 버전 제거 (함수 오버로드 모호성 방지). 4-arg + 기본값으로 통합.
drop function if exists public.record_attendee(text, text);

create or replace function public.record_attendee(
  p_ranch      text,
  p_name       text,
  p_prev_ranch text default null,
  p_prev_name  text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  p_ranch := btrim(coalesce(p_ranch, ''));
  p_name  := btrim(coalesce(p_name, ''));
  if p_ranch = '' or p_name = '' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  p_prev_ranch := btrim(coalesce(p_prev_ranch, ''));
  p_prev_name  := btrim(coalesce(p_prev_name, ''));

  -- 이름/목장 변경: 기존 레코드 제거 (자기 자신으로의 no-op 제외)
  if p_prev_ranch <> '' and p_prev_name <> ''
     and (p_prev_ranch, p_prev_name) is distinct from (p_ranch, p_name) then
    delete from public.attendees
    where ranch_name = p_prev_ranch and user_name = p_prev_name;
    -- 오픈 전 변경이므로 registrations 는 비어 있음. 안전하게 남은 신청도 정리.
    delete from public.registrations
    where ranch_name = p_prev_ranch and user_name = p_prev_name;
  end if;

  insert into public.attendees (ranch_name, user_name)
  values (p_ranch, p_name)
  on conflict (ranch_name, user_name) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.record_attendee(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_attendee(text, text, text, text)
  to service_role;
