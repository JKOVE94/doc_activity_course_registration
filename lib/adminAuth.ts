import "server-only";
import { verifyAdminToken } from "./adminToken";
import { supabaseAdmin } from "./supabase/server";

// 토큰을 검증하고, DB 함수(p_password 인자)에 넘길 실제 비밀번호를 서버에서 조회한다.
// 비밀번호는 로그인 이후 클라이언트로 나가지 않는다.
export async function resolveAdmin(
  token: string | undefined | null,
  opts?: { requireDev?: boolean },
): Promise<{ dev: boolean; password: string } | null> {
  const claims = verifyAdminToken(token);
  if (!claims) return null;
  if (opts?.requireDev && !claims.dev) return null;

  // select("*") — 0016(dev_password) 미적용 환경에서도 깨지지 않도록
  const { data, error } = await supabaseAdmin
    .from("admin_secret")
    .select("*")
    .eq("id", 1)
    .single();
  if (error || !data) return null;

  const row = data as { password: string; dev_password?: string };
  return {
    dev: claims.dev,
    password: claims.dev ? (row.dev_password ?? row.password) : row.password,
  };
}

// body(json) 또는 x-admin-token 헤더에서 토큰 추출
export function tokenFrom(req: Request, body?: { token?: unknown }): string | null {
  const h = req.headers.get("x-admin-token");
  if (h) return h;
  if (body && typeof body.token === "string") return body.token;
  return null;
}
