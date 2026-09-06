import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { issueAdminToken } from "@/lib/adminToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_FOUND = /schema cache|PGRST202|Could not find the function/i;

// 로그인: 비밀번호는 여기서만 받는다. 성공하면 서명 토큰을 발급하고
// 이후 모든 관리자 요청은 토큰만 사용한다.
export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const password = body.password ?? "";

  let ok = false;
  let dev = false;

  const auth = await supabaseAdmin.rpc("admin_auth", { p_password: password });
  if (!auth.error) {
    ok = auth.data?.ok === true;
    dev = !!auth.data?.dev;
  } else if (NOT_FOUND.test(auth.error.message)) {
    // 0016 미적용/스키마 캐시 지연 시: 구 boolean 함수로 로그인만 유지
    const v = await supabaseAdmin.rpc("admin_verify", { p_password: password });
    if (v.error) {
      return NextResponse.json(
        { ok: false, error: "SERVER", detail: v.error.message },
        { status: 500 },
      );
    }
    ok = v.data === true;
  } else {
    console.error("admin_auth error", auth.error);
    return NextResponse.json(
      { ok: false, error: "SERVER", detail: auth.error.message },
      { status: 500 },
    );
  }

  if (!ok) {
    return NextResponse.json({ ok: false, error: "BAD_PASSWORD" }, { status: 401 });
  }

  const { token, exp } = issueAdminToken(dev);
  return NextResponse.json({ ok: true, dev, token, exp });
}
