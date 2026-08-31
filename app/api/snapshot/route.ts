import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

// 공개 화면 통합 스냅샷 (전역, 유저별 정보 없음).
// CDN 에서 2초 캐시 + stale-while-revalidate → 접속자 수와 무관하게
// 원본(DB)에는 최대 초당 1회 미만으로만 요청이 간다.
const CACHE = "public, s-maxage=2, stale-while-revalidate=8";

export async function GET() {
  const { data, error } = await supabaseAdmin.rpc("get_public_snapshot");
  if (error) {
    console.error("snapshot error", error);
    return Response.json({ error: "SERVER" }, { status: 500 });
  }
  return Response.json(data, {
    headers: {
      "Cache-Control": CACHE,
      "CDN-Cache-Control": CACHE,
      "Vercel-CDN-Cache-Control": CACHE,
    },
  });
}
