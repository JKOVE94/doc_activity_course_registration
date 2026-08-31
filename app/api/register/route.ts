import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { classId?: string; ranchName?: string; userName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const classId = body.classId;
  const ranchName = (body.ranchName ?? "").trim();
  const userName = (body.userName ?? "").trim();

  if (!classId || !ranchName || !userName) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("register_for_class", {
    p_class_id: classId,
    p_ranch_name: ranchName,
    p_user_name: userName,
  });

  if (error) {
    console.error("register_for_class error", error);
    return NextResponse.json({ ok: false, error: "SERVER" }, { status: 500 });
  }

  return NextResponse.json(data, { status: data?.ok ? 200 : 409 });
}
