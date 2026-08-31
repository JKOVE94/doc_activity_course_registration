-- ============================================================================
--  0008 — 초기화 범위에 부스(classes) 포함 + 테스트(mock) 데이터 생성 함수
--  0001~0007 실행 후 이 파일을 실행하세요.
-- ============================================================================

-- ---------- admin_reset: 부스까지 삭제 ------------------------------
create or replace function public.admin_reset(p_password text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_regs      int;
  v_attendees int;
  v_classes   int;
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;

  delete from public.registrations where true;
  get diagnostics v_regs = row_count;

  delete from public.attendees where true;
  get diagnostics v_attendees = row_count;

  delete from public.classes where true;          -- class_images 는 ON DELETE CASCADE
  get diagnostics v_classes = row_count;

  update public.app_settings
    set status = 'CLOSED',
        capacity_per_class = null,
        attendee_count_at_open = null,
        updated_at = now()
    where id = 1;

  return jsonb_build_object(
    'ok', true,
    'deleted_registrations', v_regs,
    'deleted_attendees', v_attendees,
    'deleted_classes', v_classes
  );
end;
$$;

-- ---------- admin_seed_demo: 테스트용 mock 데이터 ------------------
create or replace function public.admin_seed_demo(p_password text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_class_ids uuid[];
  v_ranches   text[] := array[
    '김대현 목장','전경근 목장','윤주혜 목장','정은희 목장','이서연 목장','박민협 목장',
    '이유리 목장','안병선 목장','채혜숙 목장','성현 목장','윤다솔 목장','이상원 목장'];
  v_names     text[] := array[
    '민준','서연','도윤','지우','예준','하은','시우','서준','하윤','주원',
    '지호','지안','수아','은우','유준','채원','예은','정우','다은','건우',
    '시윤','아린','현우','서율','민서','지윤','우진','수빈','준서','하린',
    '지훈','예린','유찬','서아','도현','시은','재윤','가은','승우','채은'];
  v_seen  text[] := '{}';
  v_ranch text;
  v_name  text;
  i int;
  v_n int := 0;
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;

  -- 전체 초기화
  delete from public.registrations where true;
  delete from public.attendees    where true;
  delete from public.classes      where true;
  update public.app_settings
    set status = 'CLOSED', capacity_per_class = null,
        attendee_count_at_open = null, updated_at = now()
    where id = 1;

  -- 샘플 부스 6개 (정원은 오픈 시 자동 산정되므로 placeholder 1)
  insert into public.classes
    (name, instructor, instructor_sub, description, location, materials, max_capacity, sort_order)
  values
    ('캘리그라피 원데이','김은혜','박소망','붓펜으로 손글씨 카드를 만들어봐요. 초보 환영!','본당 2층 세미나실','없음 (재료 제공)',1,1),
    ('베이킹 클래스','이요한',null,'스콘과 쿠키를 함께 굽고 포장해 갑니다.','교육관 3층 카페','앞치마(선택)',1,2),
    ('풋살 리그','박다윗','정믿음','6:6 미니 게임 토너먼트. 운동화 필수!','체육관','운동복, 운동화',1,3),
    ('보드게임 카페','최사랑',null,'전략/파티 보드게임을 함께 즐겨요.','소그룹실 A','없음',1,4),
    ('기타 입문','정드림','한노래','C·G·Am 코드로 찬양 한 곡 완주하기.','찬양팀 연습실','통기타(대여 5대)',1,5),
    ('사진관 (프로필 촬영)','한빛',null,'조명 세팅된 공간에서 프로필 사진을 찍어드려요.','미디어실','없음',1,6);

  select array_agg(id order by sort_order) into v_class_ids from public.classes;

  -- 가짜 로그인 인원 (목장 랜덤 배정, 조합 중복 회피)
  for i in 1 .. array_length(v_names, 1) loop
    v_name  := v_names[i];
    v_ranch := v_ranches[1 + floor(random() * array_length(v_ranches, 1))::int];
    if (v_ranch || '|' || v_name) = any(v_seen) then
      continue;
    end if;
    v_seen := v_seen || (v_ranch || '|' || v_name);
    insert into public.attendees (ranch_name, user_name)
    values (v_ranch, v_name)
    on conflict (ranch_name, user_name) do nothing;
    v_n := v_n + 1;
  end loop;

  -- 인원의 약 60% 를 랜덤 부스에 신청
  for v_ranch, v_name in
    select ranch_name, user_name from public.attendees
    order by random()
    limit greatest((v_n * 6) / 10, 1)
  loop
    insert into public.registrations (class_id, ranch_name, user_name)
    values (v_class_ids[1 + floor(random() * array_length(v_class_ids, 1))::int], v_ranch, v_name)
    on conflict (ranch_name, user_name) do nothing;
  end loop;

  update public.classes c
    set current_count = (select count(*) from public.registrations r where r.class_id = c.id)
    where c.id = any(v_class_ids);

  return jsonb_build_object(
    'ok', true,
    'classes', array_length(v_class_ids, 1),
    'attendees', (select count(*) from public.attendees),
    'registrations', (select count(*) from public.registrations)
  );
end;
$$;

revoke execute on function public.admin_seed_demo(text) from public, anon, authenticated;
grant  execute on function public.admin_seed_demo(text) to service_role;
