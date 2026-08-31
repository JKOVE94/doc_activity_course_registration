import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { password?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("admin_set_status", {
    p_password: body.password ?? "",
    p_status: body.status ?? "",
  });

  if (error) {
    console.error("admin_set_status error", error);
    return NextResponse.json({ ok: false, error: "SERVER" }, { status: 500 });
  }

  return NextResponse.json(data, { status: data?.ok ? 200 : 401 });
}
