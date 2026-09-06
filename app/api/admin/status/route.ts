import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveAdmin, tokenFrom } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { token?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const admin = await resolveAdmin(tokenFrom(req, body));
  if (!admin) {
    return NextResponse.json({ ok: false, error: "AUTH" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.rpc("admin_set_status", {
    p_password: admin.password,
    p_status: body.status ?? "",
  });

  if (error) {
    console.error("admin_set_status error", error);
    return NextResponse.json(
      { ok: false, error: "SERVER", detail: error.message, hint: error.hint ?? null },
      { status: 500 },
    );
  }
  return NextResponse.json(data, { status: data?.ok ? 200 : 400 });
}
