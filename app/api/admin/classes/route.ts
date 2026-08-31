import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ClassPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 생성 / 수정 (payload.id 유무로 구분)
export async function POST(req: Request) {
  let body: { password?: string; class?: ClassPayload };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("admin_upsert_class", {
    p_password: body.password ?? "",
    p_payload: body.class ?? {},
  });

  if (error) {
    console.error("admin_upsert_class error", error);
    return NextResponse.json(
      { ok: false, error: "SERVER", detail: error.message, hint: error.hint ?? null },
      { status: 500 },
    );
  }
  return NextResponse.json(data, { status: data?.ok ? 200 : 400 });
}

// 삭제
export async function DELETE(req: Request) {
  let body: { password?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("admin_delete_class", {
    p_password: body.password ?? "",
    p_id: body.id,
  });

  if (error) {
    console.error("admin_delete_class error", error);
    return NextResponse.json(
      { ok: false, error: "SERVER", detail: error.message, hint: error.hint ?? null },
      { status: 500 },
    );
  }
  return NextResponse.json(data, { status: data?.ok ? 200 : 400 });
}
