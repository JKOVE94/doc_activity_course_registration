import "server-only";

import { createClient } from "@supabase/supabase-js";

// 서버 전용 클라이언트. secret key 를 사용하므로 절대 클라이언트 번들에 노출 금지.
// RLS 를 우회하지만, 실제 신청 판정 로직은 DB 함수(register_for_class 등) 안에서 수행된다.
//
// 신규 키 체계: secret key (sb_secret_...) — 서버/함수 전용.
// (구 service_role key 도 그대로 동작하므로 fallback 으로 둔다.)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const secretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "placeholder-secret-key";

export const supabaseAdmin = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
