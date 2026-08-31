import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

// 부스 사진 바이트 서빙. id 는 불변이므로 장기 캐시.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return new Response("not found", { status: 404 });
  }

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
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
