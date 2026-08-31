"use client";

import { createBrowserClient } from "@supabase/ssr";

// 브라우저 전용 클라이언트 — 읽기 + Realtime 구독에만 사용.
// 쓰기(신청/취소/관리)는 전부 서버 API Route를 통해 처리된다.
//
// 신규 키 체계: publishable key (sb_publishable_...) — 브라우저 노출 안전, RLS 적용.
// (구 anon key 도 그대로 동작하므로 fallback 으로 둔다.)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "placeholder-publishable-key";

export const supabase = createBrowserClient(url, publishableKey);
