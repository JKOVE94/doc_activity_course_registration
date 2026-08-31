import "server-only";

import { createClient } from "@supabase/supabase-js";

// 서버 전용 클라이언트. service_role 키를 사용하므로 절대 클라이언트 번들에 노출 금지.
// RLS 를 우회하지만, 실제 신청 판정 로직은 DB 함수(register_for_class 등) 안에서 수행된다.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
