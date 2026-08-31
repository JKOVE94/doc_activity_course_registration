-- ============================================================================
--  0005 — 공개 화면(수강신청/부스소개/현황판)용 통합 스냅샷 함수
--  여러 번의 REST 왕복을 1회 RPC 로 줄여 고지연(모바일/해외 리전) 환경 로딩 개선.
--  0001~0004 실행 후 이 파일을 실행하세요.
-- ============================================================================

create or replace function public.get_public_snapshot(
  p_ranch text default null,
  p_name  text default null
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'status',             s.status,
    'capacity_per_class', s.capacity_per_class,
    'attendees',          (select count(*)::int from public.attendees),
    'classes', coalesce(
      (select jsonb_agg(to_jsonb(c) order by c.sort_order) from public.classes c),
      '[]'::jsonb
    ),
    'images', coalesce(
      (select jsonb_agg(
                jsonb_build_object('id', ci.id, 'class_id', ci.class_id, 'sort', ci.sort)
                order by ci.sort)
       from public.class_images ci),
      '[]'::jsonb
    ),
    'my_class_id', (
      select r.class_id
      from public.registrations r
      where p_ranch is not null and p_name is not null
        and r.ranch_name = btrim(p_ranch)
        and r.user_name  = btrim(p_name)
      limit 1
    )
  )
  from public.app_settings s
  where s.id = 1;
$$;

grant execute on function public.get_public_snapshot(text, text)
  to anon, authenticated, service_role;
