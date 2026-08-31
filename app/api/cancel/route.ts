import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(req: Request) {
  let body: { ranchName?: string; userName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const ranchName = (body.ranchName ?? "").trim();
  const userName = (body.userName ?? "").trim();

  if (!ranchName || !userName) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("cancel_registration", {
    p_ranch_name: ranchName,
    p_user_name: userName,
  });

  if (error) {
    console.error("cancel_registration error", error);
    return NextResponse.json({ ok: false, error: "SERVER" }, { status: 500 });
  }

  return NextResponse.json(data, { status: data?.ok ? 200 : 409 });
}
