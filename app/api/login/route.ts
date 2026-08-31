import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isValidName, isValidRanch } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 로그인 인원 기록 (정원 자동 산정 기준). 중복은 무시된다.
export async function POST(req: Request) {
  let body: { ranchName?: string; userName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const ranchName = (body.ranchName ?? "").trim();
  const userName = (body.userName ?? "").trim();
  if (!isValidRanch(ranchName)) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }
  if (!isValidName(userName)) {
    return NextResponse.json({ ok: false, error: "INVALID_NAME" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("record_attendee", {
    p_ranch: ranchName,
    p_name: userName,
  });

  if (error) {
    console.error("record_attendee error", error);
    return NextResponse.json({ ok: false, error: "SERVER" }, { status: 500 });
  }
  return NextResponse.json(data);
}
