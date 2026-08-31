-- ============================================================================
--  0001 을 이미 실행한 프로젝트용 패치.
--  publishable(anon) 키로 신청/취소/관리 함수를 직접 호출하지 못하게 막는다.
--  앱은 항상 서버 API Route(secret key)를 거치므로 동작에 영향 없음.
--  새로 설치하는 경우 0001_init.sql 에 이미 반영돼 있으니 실행 불필요.
-- ============================================================================

revoke execute on function public.register_for_class(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.cancel_registration(text, text)      from public, anon, authenticated;
revoke execute on function public.admin_verify(text)                   from public, anon, authenticated;
revoke execute on function public.admin_set_status(text, text)         from public, anon, authenticated;
revoke execute on function public.admin_reset(text)                    from public, anon, authenticated;

grant execute on function public.register_for_class(uuid, text, text) to service_role;
grant execute on function public.cancel_registration(text, text)      to service_role;
grant execute on function public.admin_verify(text)                   to service_role;
grant execute on function public.admin_set_status(text, text)         to service_role;
grant execute on function public.admin_reset(text)                    to service_role;

-- (선택) 신청자 명단을 브라우저에 노출하지 않으려면 아래 주석을 해제.
--  단, 관리자 페이지가 브라우저 클라이언트로 명단을 읽고 있으므로
--  그 경우 명단 조회도 서버 라우트로 옮겨야 한다.
-- drop policy if exists "read regs" on public.registrations;
