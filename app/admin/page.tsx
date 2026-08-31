"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { STATUS_LABEL, type SystemStatus } from "@/lib/constants";
import type { ClassRow, RegistrationRow } from "@/lib/types";

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminInner />
    </Suspense>
  );
}

function AdminInner() {
  const keyParam = useSearchParams().get("k") ?? "";

  const [pw, setPw] = useState(keyParam);
  const [authed, setAuthed] = useState(false);
  const [authErr, setAuthErr] = useState("");

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [regs, setRegs] = useState<RegistrationRow[]>([]);
  const [status, setStatus] = useState<SystemStatus>("CLOSED");
  const [confirmReset, setConfirmReset] = useState(false);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const [{ data: c }, { data: r }, { data: s }] = await Promise.all([
      supabase.from("classes").select("*").order("sort_order"),
      supabase
        .from("registrations")
        .select("seq, class_id, ranch_name, user_name, created_at")
        .order("seq"),
      supabase.from("app_settings").select("status").eq("id", 1).single(),
    ]);
    setClasses((c as ClassRow[]) ?? []);
    setRegs((r as RegistrationRow[]) ?? []);
    setStatus((s?.status as SystemStatus) ?? "CLOSED");
  }, []);

  useEffect(() => {
    if (!authed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const channel = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "classes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, load)
      .subscribe();
    const poll = setInterval(load, 5000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [authed, load]);

  const setSystemStatus = async (next: SystemStatus) => {
    setWorking(true);
    setAuthErr("");
    try {
      const res = await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, status: next }),
      });
      const j = await res.json();
      if (j.ok) {
        setAuthed(true);
        setStatus(next);
        await load();
      } else {
        setAuthErr("비밀번호가 올바르지 않습니다.");
      }
    } finally {
      setWorking(false);
    }
  };

  const doReset = async () => {
    setWorking(true);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const j = await res.json();
      if (j.ok) {
        setConfirmReset(false);
        await load();
      } else {
        alert("초기화에 실패했습니다.");
      }
    } finally {
      setWorking(false);
    }
  };

  const download = async () => {
    const res = await fetch("/api/admin/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (!res.ok) return alert("다운로드에 실패했습니다.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!authed) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="font-bold text-slate-800">관리자 로그인</h1>
          <p className="text-xs text-slate-400 mt-1">관리자 비밀번호를 입력하세요.</p>
          <input
            type="password"
            inputMode="numeric"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSystemStatus(status)}
            placeholder="관리자 비밀번호"
            className="mt-3 w-full h-11 rounded-xl border border-slate-300 px-3"
          />
          {authErr && <p className="text-sm text-red-500 mt-2">{authErr}</p>}
          <button
            disabled={working}
            onClick={() => setSystemStatus(status)}
            className="mt-3 w-full h-11 rounded-xl bg-slate-800 text-white font-semibold disabled:opacity-50"
          >
            로그인
          </button>
        </div>
      </main>
    );
  }

  const totalRegistered = regs.length;
  const totalCapacity = classes.reduce((s, c) => s + c.max_capacity, 0);

  return (
    <main className="min-h-dvh bg-slate-50 pb-16">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-4 py-3">
        <h1 className="font-bold text-slate-800">관리자 대시보드</h1>
        <p className="text-xs text-slate-500">
          현재 상태 · <span className="font-semibold">{STATUS_LABEL[status]}</span> · 신청{" "}
          {totalRegistered}/{totalCapacity}명
        </p>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-bold text-slate-800">수강신청 상태 제어</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["CLOSED", "OPEN", "FINISHED"] as SystemStatus[]).map((s) => (
              <button
                key={s}
                disabled={working}
                onClick={() => setSystemStatus(s)}
                className={`h-11 rounded-xl text-sm font-semibold transition ${
                  status === s
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {{ CLOSED: "대기", OPEN: "오픈", FINISHED: "종료" }[s]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            &lsquo;오픈&rsquo; 시에만 신청/취소가 가능합니다. &lsquo;종료&rsquo; 시 전체 기능이 중단됩니다.
          </p>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800">부스별 신청 현황</h2>
            <button
              onClick={download}
              className="flex items-center gap-1 text-sm rounded-lg bg-emerald-600 text-white px-3 py-1.5"
            >
              <Download size={14} /> CSV
            </button>
          </div>

          <div className="mt-4 space-y-5">
            {classes.map((c) => {
              const list = regs.filter((r) => r.class_id === c.id);
              const full = c.current_count >= c.max_capacity;
              return (
                <div key={c.id}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                    <span
                      className={`text-sm font-bold ${full ? "text-red-500" : "text-slate-600"}`}
                    >
                      {c.current_count} / {c.max_capacity}
                    </span>
                  </div>
                  {list.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-400">신청자 없음</p>
                  ) : (
                    <div className="mt-1.5 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-slate-400">
                          <tr className="text-left">
                            <th className="w-8 py-1 font-medium">#</th>
                            <th className="py-1 font-medium">목장</th>
                            <th className="py-1 font-medium">이름</th>
                            <th className="py-1 font-medium">신청시각</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((r, i) => (
                            <tr key={r.seq} className="border-t border-slate-100">
                              <td className="py-1.5 text-slate-400">{i + 1}</td>
                              <td className="py-1.5">{r.ranch_name}</td>
                              <td className="py-1.5 font-medium text-slate-700">
                                {r.user_name}
                              </td>
                              <td className="py-1.5 text-slate-500">
                                {new Date(r.created_at).toLocaleString("ko-KR", {
                                  month: "numeric",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-red-50 border border-red-100 p-4">
          <h2 className="font-bold text-red-700">위험 구역</h2>
          <p className="text-xs text-red-500/80 mt-0.5">
            모든 청년의 신청 내역이 삭제되고 상태가 &lsquo;대기&rsquo;로 초기화됩니다.
          </p>
          <button
            onClick={() => setConfirmReset(true)}
            className="mt-3 flex items-center justify-center gap-1.5 h-11 w-full rounded-xl bg-red-600 text-white font-semibold"
          >
            <RotateCcw size={15} /> 전체 신청 내역 초기화
          </button>
        </section>
      </div>

      {confirmReset && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center px-5">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5">
            <p className="font-bold text-slate-800">정말 초기화하시겠어요?</p>
            <p className="text-sm text-slate-500 mt-1">
              이 작업은 되돌릴 수 없습니다. 다운로드가 필요하면 먼저 CSV로 내보내세요.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 h-10 rounded-xl bg-slate-100 font-semibold"
              >
                취소
              </button>
              <button
                disabled={working}
                onClick={doReset}
                className="flex-1 h-10 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-50"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
