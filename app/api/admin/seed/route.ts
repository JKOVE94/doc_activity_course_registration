import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 테스트용 mock 데이터 생성 (부스 6개 + 가짜 로그인 인원 + 랜덤 신청). 기존 데이터는 초기화됨.
export async function POST(req: Request) {
  let body: { password?: string; scenario?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { data: isDev } = await supabaseAdmin.rpc("admin_is_dev", {
    p_password: body.password ?? "",
  });
  if (isDev !== true) {
    return NextResponse.json({ ok: false, error: "BAD_PASSWORD" }, { status: 401 });
  }

  const scenario =
    body.scenario === "classes" || body.scenario === "lastseat"
      ? body.scenario
      : "full";
  const { data, error } = await supabaseAdmin.rpc("admin_seed_demo", {
    p_password: body.password ?? "",
    p_scenario: scenario,
  });

  if (error) {
    console.error("admin_seed_demo error", error);
    return NextResponse.json(
      { ok: false, error: "SERVER", detail: error.message, hint: error.hint ?? null },
      { status: 500 },
    );
  }
  return NextResponse.json(data, { status: data?.ok ? 200 : 401 });
}
