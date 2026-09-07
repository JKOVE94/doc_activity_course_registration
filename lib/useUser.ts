"use client";

import { useCallback, useEffect, useState } from "react";

export type User = { ranchName: string; userName: string };

const KEY = "yf_user";
const TTL_MS = 30 * 60 * 1000; // 30분 (슬라이딩)

type Stored = User & { exp: number };

function readStored(): User | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Stored>;
    if (
      !s.ranchName ||
      !s.userName ||
      typeof s.exp !== "number" ||
      Date.now() > s.exp
    ) {
      localStorage.removeItem(KEY);
      return null;
    }
    return { ranchName: s.ranchName, userName: s.userName };
  } catch {
    return null;
  }
}

function writeStored(u: User): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...u, exp: Date.now() + TTL_MS }));
  } catch {
    /* ignore */
  }
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = readStored();
    if (u) writeStored(u); // 마운트 시 만료 연장
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(u);
    setReady(true);
  }, []);

  const login = useCallback((u: User) => {
    writeStored(u);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  // 활동 시 호출 → 세션 만료 30분 연장
  const touch = useCallback(() => {
    const u = readStored();
    if (u) writeStored(u);
  }, []);

  return { user, ready, login, logout, touch };
}
