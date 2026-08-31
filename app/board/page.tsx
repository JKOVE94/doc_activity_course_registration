"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { STATUS_LABEL, type SystemStatus } from "@/lib/constants";
import type { ClassRow, RegistrationRow } from "@/lib/types";

// 실시간 현황판 — 큰 화면(프로젝터/모니터) 표시용. 관리자 인증 불필요.
export default function BoardPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [regs, setRegs] = useState<RegistrationRow[]>([]);
  const [status, setStatus] = useState<SystemStatus>("CLOSED");
  const [capacity, setCapacity] = useState<number | null>(null);
  const [attendees, setAttendees] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [snapRes, { data: r }] = await Promise.all([
      fetch("/api/snapshot", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
      supabase
        .from("registrations")
        .select("seq, class_id, ranch_name, user_name, created_at")
        .order("seq"),
    ]);
    if (snapRes && !snapRes.error) {
      setClasses((snapRes.classes as ClassRow[]) ?? []);
      setStatus((snapRes.status as SystemStatus) ?? "CLOSED");
      setCapacity((snapRes.capacity_per_class as number | null) ?? null);
      setAttendees((snapRes.attendees as number) ?? 0);
    }
    setRegs((r as RegistrationRow[]) ?? []);
    setUpdatedAt(Date.now());
  }, []);

  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimer.current) return;
      reloadTimer.current = setTimeout(() => {
        reloadTimer.current = null;
        load();
      }, 1000);
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const channel = supabase
      .channel("board-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "classes" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, scheduleReload)
      .subscribe();
    const poll = setInterval(load, 5000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(tick);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [load]);

  const totalReg = regs.length;
  const totalCap = classes.reduce((s, c) => s + c.max_capacity, 0);
  const secsAgo =
    updatedAt != null ? Math.max(0, Math.floor((now - updatedAt) / 1000)) : null;

  return (
    <main className="min-h-dvh bg-slate-100">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="text-slate-400 hover:text-slate-600" aria-label="홈으로">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-xl font-bold text-slate-800">
            연합목장활동 공통사모임 신청 현황
          </h1>
        </div>
        <div className="flex items-center gap-5 text-sm text-slate-500">
          <StatusPill status={status} />
          <span>
            로그인 <b className="text-slate-800">{attendees}</b>명
          </span>
          <span>
            신청 <b className="text-slate-800">{totalReg}</b>
            {totalCap > 0 ? ` / ${totalCap}` : ""}
          </span>
          {capacity != null && (
            <span>
              분반당 정원 <b className="text-slate-800">{capacity}</b>명
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            {secsAgo != null ? `${secsAgo}초 전 갱신` : "연결 중…"}
          </span>
        </div>
      </header>

      {status !== "OPEN" && (
        <div className="px-6 pt-4">
          <div className="rounded-xl bg-slate-800 text-slate-100 text-center py-2.5 text-sm">
            {status === "CLOSED"
              ? "⏳ 신청 준비 중 — 관리자가 오픈하면 자동으로 반영됩니다."
              : "✅ 수강신청이 종료되었습니다."}
          </div>
        </div>
      )}

      <div
        className="p-6 grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))" }}
      >
        {classes.map((c) => {
          const list = regs
            .filter((r) => r.class_id === c.id)
            .sort((a, b) => a.seq - b.seq);
          const full = c.current_count >= c.max_capacity;
          const pct = Math.min(
            100,
            Math.round((c.current_count / Math.max(c.max_capacity, 1)) * 100),
          );
          return (
            <div
              key={c.id}
              className="flex flex-col rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 truncate">{c.name}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      멘토 {c.instructor}
                      {c.instructor_sub ? ` · 보조 ${c.instructor_sub}` : ""}
                    </p>
                    {c.location && (
                      <p className="text-xs text-slate-400">{c.location}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-3xl font-extrabold tabular-nums leading-none ${
                        full ? "text-red-500" : "text-slate-900"
                      }`}
                    >
                      {c.current_count}
                      <span className="text-base font-bold text-slate-400">
                        {" "}
                        / {c.max_capacity}
                      </span>
                    </div>
                    {full && (
                      <span className="text-xs font-bold text-red-500">마감</span>
                    )}
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      full ? "bg-red-400" : pct >= 80 ? "bg-amber-400" : "bg-blue-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <ol className="flex-1 overflow-y-auto max-h-[46vh] p-3 text-sm">
                {list.map((r, i) => (
                  <li
                    key={r.seq}
                    className="flex items-center gap-2.5 py-1.5 border-b border-slate-50 last:border-0"
                  >
                    <span className="w-6 text-right text-slate-300 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="w-20 shrink-0 text-slate-400 truncate">
                      {r.ranch_name}
                    </span>
                    <span className="flex-1 font-medium text-slate-800 truncate">
                      {r.user_name}
                    </span>
                    <span className="text-xs text-slate-300 tabular-nums">
                      {new Date(r.created_at).toLocaleTimeString("ko-KR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="py-3 text-center text-slate-300">아직 신청자가 없습니다</li>
                )}
              </ol>
            </div>
          );
        })}
        {classes.length === 0 && (
          <p className="text-slate-400">등록된 부스가 없습니다.</p>
        )}
      </div>
    </main>
  );
}

function StatusPill({ status }: { status: SystemStatus }) {
  const cls: Record<SystemStatus, string> = {
    OPEN: "bg-emerald-100 text-emerald-700",
    CLOSED: "bg-slate-200 text-slate-600",
    FINISHED: "bg-slate-800 text-white",
  };
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cls[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
