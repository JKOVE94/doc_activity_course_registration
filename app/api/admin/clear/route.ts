import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 참가자(신청 내역) 초기화. classId 를 주면 그 부스만, 없으면 전체 부스.
// 부스 · 로그인 인원 · 상태는 유지된다.
export async function POST(req: Request) {
  let body: { password?: string; classId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("admin_clear_registrations", {
    p_password: body.password ?? "",
    p_class_id: body.classId ?? null,
  });

  if (error) {
    console.error("admin_clear_registrations error", error);
    return NextResponse.json(
      { ok: false, error: "SERVER", detail: error.message, hint: error.hint ?? null },
      { status: 500 },
    );
  }
  return NextResponse.json(data, { status: data?.ok ? 200 : 401 });
}
