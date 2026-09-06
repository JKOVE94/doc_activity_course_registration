import { NextResponse } from "next/server";
import { issueAdminToken, verifyAdminToken } from "@/lib/adminToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 유효한 토큰이면 만료를 30분 연장한 새 토큰을 발급한다 (슬라이딩 세션).
export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const claims = verifyAdminToken(body.token);
  if (!claims) {
    return NextResponse.json({ ok: false, error: "AUTH" }, { status: 401 });
  }

  const { token, exp } = issueAdminToken(claims.dev);
  return NextResponse.json({ ok: true, token, exp, dev: claims.dev });
}
