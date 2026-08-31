"use client";

import { createBrowserClient } from "@supabase/ssr";

// 브라우저 전용 클라이언트 — 읽기 + Realtime 구독에만 사용.
// 쓰기(신청/취소/관리)는 전부 서버 API Route를 통해 처리된다.
// 환경변수 미설정 시에도 빌드가 깨지지 않도록 placeholder 로 폴백한다.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createBrowserClient(url, anonKey);
