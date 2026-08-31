import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("admin_reset", {
    p_password: body.password ?? "",
  });

  if (error) {
    console.error("admin_reset error", error);
    // 관리자 전용 엔드포인트이므로 원인 메시지를 그대로 노출해 진단을 돕는다.
    return NextResponse.json(
      { ok: false, error: "SERVER", detail: error.message, hint: error.hint ?? null },
      { status: 500 },
    );
  }
  return NextResponse.json(data, { status: data?.ok ? 200 : 401 });
}
