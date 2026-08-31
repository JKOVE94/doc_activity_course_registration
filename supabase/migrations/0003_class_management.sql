-- ============================================================================
--  0003 — 부스(클래스) 웹 GUI 관리 + 사진 (별도 테이블에 BLOB 저장)
--  0001/0002 실행 후 이 파일을 실행하세요.
--  (이전 Storage 버전 0003 을 이미 실행했더라도 이 스크립트가 안전하게 정리합니다.)
-- ============================================================================

-- ---------- 컬럼 / 이전 버전 정리 -------------------------------------
alter table public.classes
  add column if not exists instructor_sub text;          -- 보조 담당자
alter table public.classes
  drop column if exists image_urls;                       -- 이전(Storage URL) 방식 제거

do $$
begin
  delete from storage.objects where bucket_id = 'class-images';
  delete from storage.buckets where id = 'class-images';
exception when others then null;   -- storage 스키마 접근 불가 등은 무시
end $$;

-- ---------- 사진 테이블 (bytea) --------------------------------------
create table if not exists public.class_images (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  data         bytea not null,
  content_type text  not null default 'image/jpeg',
  byte_size    int   not null default 0,
  sort         int   not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists idx_class_images_class
  on public.class_images (class_id, sort, created_at);

alter table public.class_images enable row level security;
-- data(바이너리) 노출 방지: 테이블 직접 SELECT 는 열지 않고, 메타만 뷰로 공개
create or replace view public.class_image_meta as
  select id, class_id, content_type, byte_size, sort, created_at
  from public.class_images;
grant select on public.class_image_meta to anon, authenticated;

-- 부스당 최대 3장
create or replace function public.enforce_max_images()
returns trigger language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.class_images where class_id = new.class_id) >= 3 then
    raise exception 'MAX_IMAGES' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists trg_max_images on public.class_images;
create trigger trg_max_images before insert on public.class_images
  for each row execute function public.enforce_max_images();

-- ---------- 함수: 부스 생성/수정 (사진은 별도 관리) ------------------
create or replace function public.admin_upsert_class(p_password text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id   uuid;
  v_name text := btrim(coalesce(p_payload->>'name', ''));
  v_main text := btrim(coalesce(p_payload->>'instructor', ''));
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;
  if v_name = '' or v_main = '' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  v_id := nullif(p_payload->>'id', '')::uuid;

  if v_id is null then
    insert into public.classes
      (name, instructor, instructor_sub, description, location, materials, max_capacity, sort_order)
    values
      (v_name, v_main,
       nullif(btrim(coalesce(p_payload->>'instructor_sub','')), ''),
       nullif(btrim(coalesce(p_payload->>'description','')), ''),
       nullif(btrim(coalesce(p_payload->>'location','')), ''),
       nullif(btrim(coalesce(p_payload->>'materials','')), ''),
       greatest(coalesce((p_payload->>'max_capacity')::int, 1), 1),
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
      max_capacity   = greatest(coalesce((p_payload->>'max_capacity')::int, 1), 1),
      sort_order     = coalesce((p_payload->>'sort_order')::int, sort_order)
    where id = v_id;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.admin_delete_class(p_password text, p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;
  delete from public.classes where id = p_id;   -- class_images / registrations 는 CASCADE
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- 함수: 사진 추가/삭제/조회 -------------------------------
create or replace function public.admin_add_class_image(
  p_password text, p_class_id uuid, p_content_type text, p_base64 text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id    uuid;
  v_bytes bytea;
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;
  if not exists (select 1 from public.classes where id = p_class_id) then
    return jsonb_build_object('ok', false, 'error', 'CLASS_NOT_FOUND');
  end if;

  v_bytes := decode(coalesce(p_base64, ''), 'base64');
  if octet_length(v_bytes) = 0 then
    return jsonb_build_object('ok', false, 'error', 'EMPTY');
  end if;
  if octet_length(v_bytes) > 4 * 1024 * 1024 then
    return jsonb_build_object('ok', false, 'error', 'FILE_TOO_LARGE');
  end if;

  begin
    insert into public.class_images (class_id, data, content_type, byte_size, sort)
    values (
      p_class_id, v_bytes,
      coalesce(nullif(p_content_type, ''), 'image/jpeg'),
      octet_length(v_bytes),
      coalesce((select max(sort) + 1 from public.class_images where class_id = p_class_id), 0)
    )
    returning id into v_id;
  exception when check_violation then
    return jsonb_build_object('ok', false, 'error', 'MAX_IMAGES');
  end;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.admin_delete_class_image(p_password text, p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;
  delete from public.class_images where id = p_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- 이미지 바이트 조회 (라우트 핸들러에서 호출, base64 로 반환)
create or replace function public.get_class_image(p_id uuid)
returns table (content_type text, base64 text)
language sql security definer set search_path = public stable
as $$
  select content_type, encode(data, 'base64')
  from public.class_images
  where id = p_id;
$$;

-- ---------- 실행 권한 (service_role 전용) --------------------------
revoke execute on function public.admin_upsert_class(text, jsonb)                  from public, anon, authenticated;
revoke execute on function public.admin_delete_class(text, uuid)                   from public, anon, authenticated;
revoke execute on function public.admin_add_class_image(text, uuid, text, text)    from public, anon, authenticated;
revoke execute on function public.admin_delete_class_image(text, uuid)             from public, anon, authenticated;
revoke execute on function public.get_class_image(uuid)                            from public, anon, authenticated;

grant  execute on function public.admin_upsert_class(text, jsonb)                  to service_role;
grant  execute on function public.admin_delete_class(text, uuid)                   to service_role;
grant  execute on function public.admin_add_class_image(text, uuid, text, text)    to service_role;
grant  execute on function public.admin_delete_class_image(text, uuid)             to service_role;
grant  execute on function public.get_class_image(uuid)                            to service_role;
