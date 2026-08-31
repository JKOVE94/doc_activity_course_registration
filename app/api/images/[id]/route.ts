import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 이미지는 불변(랜덤 UUID). 브라우저/CDN 캐시를 최우선으로 쓰고,
// 캐시가 없을 때만 DB 에서 내려받는다.
const CACHE = "public, max-age=31536000, immutable";

// id 자체가 곧 버전이므로 ETag = id.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return new Response("not found", { status: 404 });
  }

  const etag = `"${id}"`;

  // 브라우저가 이미 가지고 있으면(조건부 요청) DB 접근 없이 즉시 304.
  const inm = req.headers.get("if-none-match");
  if (inm && inm.split(",").some((t) => t.trim() === etag || t.trim() === `W/${etag}`)) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": CACHE,
        "CDN-Cache-Control": CACHE,
        "Vercel-CDN-Cache-Control": CACHE,
      },
    });
  }

  // 여기부터가 "브라우저에 캐시가 없을 때만" 실행되는 DB 다운로드 경로.
  const { data, error } = await supabaseAdmin.rpc("get_class_image", { p_id: id });
  if (error) {
    console.error("get_class_image error", error);
    return new Response("error", { status: 500 });
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.base64) {
    return new Response("not found", { status: 404 });
  }

  const bytes = Buffer.from(row.base64 as string, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": (row.content_type as string) || "image/jpeg",
      "Content-Length": String(bytes.length),
      ETag: etag,
      "Cache-Control": CACHE,
      "CDN-Cache-Control": CACHE,
      "Vercel-CDN-Cache-Control": CACHE,
    },
  });
}
