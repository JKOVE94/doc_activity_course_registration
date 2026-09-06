import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// 관리자 세션 토큰: HMAC 서명된 { dev, exp }. 로그인 후 비밀번호 대신 이 토큰만 오간다.
const SECRET = process.env.SUPABASE_SECRET_KEY || "insecure-dev-secret";
const TTL_MS = 30 * 60 * 1000; // 30분

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function issueAdminToken(dev: boolean): { token: string; exp: number } {
  const exp = Date.now() + TTL_MS;
  const payload = Buffer.from(JSON.stringify({ dev, exp })).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, exp };
}

export function verifyAdminToken(token: string | undefined | null): { dev: boolean } | null {
  if (!token || typeof token !== "string") return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const { dev, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof exp !== "number" || Date.now() > exp) return null;
    return { dev: !!dev };
  } catch {
    return null;
  }
}
