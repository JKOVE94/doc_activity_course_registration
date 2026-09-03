"use client";

// 관리자 세션: 비밀번호 + dev 여부를 30분 만료(슬라이딩)로 브라우저에 보관.
const KEY = "yf_admin";
const TTL_MS = 30 * 60 * 1000;

export type AdminSession = { pw: string; dev: boolean };

export function loadAdminSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { pw, dev, exp } = JSON.parse(raw) as {
      pw?: string;
      dev?: boolean;
      exp?: number;
    };
    if (!pw || typeof exp !== "number" || Date.now() > exp) {
      localStorage.removeItem(KEY);
      return null;
    }
    return { pw, dev: !!dev };
  } catch {
    return null;
  }
}

export function saveAdminSession(pw: string, dev: boolean): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ pw, dev, exp: Date.now() + TTL_MS }));
  } catch {
    /* ignore */
  }
}

export function touchAdminSession(): void {
  const s = loadAdminSession();
  if (s) saveAdminSession(s.pw, s.dev);
}

export function clearAdminSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
