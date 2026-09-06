"use client";

// 관리자 세션: 로그인 후 발급받은 서명 토큰 + dev 여부를 보관.
// 비밀번호는 저장하지 않는다. 토큰은 서버가 30분 만료로 서명한다.
const KEY = "yf_admin";

export type AdminSession = { token: string; dev: boolean; exp: number };

export function loadAdminSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<AdminSession>;
    if (!s.token || typeof s.exp !== "number" || Date.now() > s.exp) {
      localStorage.removeItem(KEY);
      return null;
    }
    return { token: s.token, dev: !!s.dev, exp: s.exp };
  } catch {
    return null;
  }
}

export function saveAdminSession(token: string, dev: boolean, exp: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, dev, exp }));
  } catch {
    /* ignore */
  }
}

export function clearAdminSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
