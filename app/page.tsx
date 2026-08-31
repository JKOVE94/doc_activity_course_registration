"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { RANCHES } from "@/lib/constants";
import { useUser } from "@/lib/useUser";

export default function LoginPage() {
  const router = useRouter();
  const { user, ready, login } = useUser();

  const [ranch, setRanch] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const [adminOpen, setAdminOpen] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (ready && user) router.replace("/register");
  }, [ready, user, router]);

  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!ranch) return setErr("목장을 선택해 주세요.");
    if (!name.trim()) return setErr("이름을 입력해 주세요.");
    const u = { ranchName: ranch, userName: name.trim() };
    setSubmitting(true);
    // 로그인 인원 기록 (정원 산정 기준). 실패해도 입장은 막지 않는다.
    try {
      await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(u),
      });
    } catch {
      /* ignore */
    }
    login(u);
    router.push("/register");
  };

  return (
    <main className="min-h-dvh bg-slate-50 flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-slate-800">
          연합목장 공통사 수강신청
        </h1>
        <p className="text-center text-slate-500 text-sm mt-1">
          목장과 이름을 입력하고 시작하세요
        </p>

        <div className="mt-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">목장 선택</label>
            <select
              value={ranch}
              onChange={(e) => {
                setRanch(e.target.value);
                setErr("");
              }}
              className="w-full h-12 rounded-xl border border-slate-300 bg-white px-3"
            >
              <option value="">— 목장을 선택하세요 —</option>
              {RANCHES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">이름</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErr("");
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="홍길동"
              className="w-full h-12 rounded-xl border border-slate-300 px-3"
            />
          </div>

          {err && <p className="text-sm text-red-500">{err}</p>}

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-blue-600 text-white font-semibold active:scale-[.98] transition disabled:opacity-60"
          >
            {submitting ? "입장 중…" : "입장하기"}
          </button>
        </div>

        <button
          onClick={() => setAdminOpen(true)}
          className="mx-auto mt-6 flex items-center gap-1 text-xs text-slate-400"
        >
          <ShieldCheck size={14} /> 관리자 모드
        </button>
      </div>

      {adminOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 flex items-center justify-center px-5"
          onClick={() => setAdminOpen(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-slate-800">관리자 인증</h2>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && router.push(`/admin?k=${encodeURIComponent(pin)}`)
              }
              placeholder="관리자 비밀번호"
              className="mt-3 w-full h-11 rounded-xl border border-slate-300 px-3"
            />
            <button
              onClick={() => router.push(`/admin?k=${encodeURIComponent(pin)}`)}
              className="mt-3 w-full h-11 rounded-xl bg-slate-800 text-white font-semibold"
            >
              들어가기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
