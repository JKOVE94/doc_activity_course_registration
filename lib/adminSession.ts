"use client";

// 관리자 세션: 비밀번호를 30분 만료(슬라이딩)로 브라우저에 보관.
// 새로고침해도 유지되고, 조작할 때마다 만료가 연장된다.
const KEY = "yf_admin";
const TTL_MS = 30 * 60 * 1000;

export function loadAdminSession(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { pw, exp } = JSON.parse(raw) as { pw?: string; exp?: number };
    if (!pw || typeof exp !== "number" || Date.now() > exp) {
      localStorage.removeItem(KEY);
      return null;
    }
    return pw;
  } catch {
    return null;
  }
}

export function saveAdminSession(pw: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ pw, exp: Date.now() + TTL_MS }));
  } catch {
    /* ignore */
  }
}

export function touchAdminSession(): void {
  const pw = loadAdminSession();
  if (pw) saveAdminSession(pw);
}

export function clearAdminSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
