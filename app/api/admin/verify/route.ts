import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 비밀번호만 검증한다. 어떤 상태도 바꾸지 않는다.
export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("admin_verify", {
    p_password: body.password ?? "",
  });

  if (error) {
    console.error("admin_verify error", error);
    return NextResponse.json(
      { ok: false, error: "SERVER", detail: error.message, hint: error.hint ?? null },
      { status: 500 },
    );
  }

  const passed = data === true;
  return NextResponse.json(
    { ok: passed, error: passed ? undefined : "BAD_PASSWORD" },
    { status: passed ? 200 : 401 },
  );
}
