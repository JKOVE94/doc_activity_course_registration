-- ============================================================================
--  0003 — 부스(클래스) 웹 GUI 관리 + 이미지 업로드
--  0001/0002 를 이미 실행한 프로젝트에서 이 파일만 추가 실행하면 된다.
-- ============================================================================

-- ---------- 컬럼 추가 ----------------------------------------------------
alter table public.classes
  add column if not exists instructor_sub text,                        -- 보조 담당자
  add column if not exists image_urls text[] not null default '{}';    -- 사진 URL (최대 3)

-- instructor = 메인 담당자(필수), instructor_sub = 보조 담당자(선택)

-- ---------- Storage 버킷 (공개 읽기) ------------------------------------
insert into storage.buckets (id, name, public)
values ('class-images', 'class-images', true)
on conflict (id) do nothing;

-- 업로드는 서버(secret key = service_role)가 하므로 별도 정책 불필요.
-- 공개 버킷이라 https://<ref>.supabase.co/storage/v1/object/public/class-images/... 로 읽힘.

-- ---------- 함수: 부스 생성/수정 (upsert) -----------------------------
create or replace function public.admin_upsert_class(
  p_password text,
  p_payload  jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_images text[];
  v_name   text := btrim(coalesce(p_payload->>'name', ''));
  v_main   text := btrim(coalesce(p_payload->>'instructor', ''));
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;

  if v_name = '' or v_main = '' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_INPUT');
  end if;

  v_images := coalesce(
    (select array_agg(value) from jsonb_array_elements_text(p_payload->'image_urls') as t(value)),
    '{}'::text[]
  );
  if coalesce(array_length(v_images, 1), 0) > 3 then
    return jsonb_build_object('ok', false, 'error', 'TOO_MANY_IMAGES');
  end if;

  v_id := nullif(p_payload->>'id', '')::uuid;

  if v_id is null then
    insert into public.classes
      (name, instructor, instructor_sub, description, location, materials,
       max_capacity, image_urls, sort_order)
    values
      (v_name, v_main,
       nullif(btrim(coalesce(p_payload->>'instructor_sub','')), ''),
       nullif(btrim(coalesce(p_payload->>'description','')), ''),
       nullif(btrim(coalesce(p_payload->>'location','')), ''),
       nullif(btrim(coalesce(p_payload->>'materials','')), ''),
       greatest(coalesce((p_payload->>'max_capacity')::int, 1), 1),
       v_images,
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
      image_urls     = v_images,
      sort_order     = coalesce((p_payload->>'sort_order')::int, sort_order)
    where id = v_id;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- ---------- 함수: 부스 삭제 -------------------------------------------
create or replace function public.admin_delete_class(p_password text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.admin_verify(p_password) then
    return jsonb_build_object('ok', false, 'error', 'BAD_PASSWORD');
  end if;
  delete from public.classes where id = p_id;   -- registrations 는 ON DELETE CASCADE
  if not found then
    return jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- 실행 권한 (service_role 전용) ----------------------------
revoke execute on function public.admin_upsert_class(text, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_delete_class(text, uuid) from public, anon, authenticated;
grant  execute on function public.admin_upsert_class(text, jsonb) to service_role;
grant  execute on function public.admin_delete_class(text, uuid) to service_role;
