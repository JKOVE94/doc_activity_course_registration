"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import { REGISTER_ERROR_MESSAGE, STATUS_LABEL, type SystemStatus } from "@/lib/constants";
import type { ClassRow, ClassImageMeta } from "@/lib/types";
import TabNav from "@/components/TabNav";

export default function RegisterPage() {
  const router = useRouter();
  const { user, ready, logout } = useUser();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [images, setImages] = useState<ClassImageMeta[]>([]);
  const [status, setStatus] = useState<SystemStatus>("CLOSED");
  const [myClassId, setMyClassId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/");
  }, [ready, user, router]);

  const flash = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: cls }, { data: st }, { data: mine }, { data: im }] = await Promise.all([
      supabase.from("classes").select("*").order("sort_order"),
      supabase.from("app_settings").select("status").eq("id", 1).single(),
      supabase
        .from("registrations")
        .select("class_id")
        .eq("ranch_name", user.ranchName)
        .eq("user_name", user.userName)
        .maybeSingle(),
      supabase
        .from("class_image_meta")
        .select("id, class_id, sort, content_type, byte_size")
        .order("sort"),
    ]);
    if (cls) setClasses(cls as ClassRow[]);
    if (st) setStatus((st.status as SystemStatus) ?? "CLOSED");
    setMyClassId(mine?.class_id ?? null);
    if (im) setImages(im as ClassImageMeta[]);
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const channel = supabase
      .channel("registration-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "classes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, load)
      .subscribe();
    // Realtime 미설정/연결 실패 대비 폴백 폴링
    const poll = setInterval(load, 5000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [user, load]);

  const act = useCallback(
    async (path: "register" | "cancel", classId?: string) => {
      if (!user || busy) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId, ranchName: user.ranchName, userName: user.userName }),
        });
        const j = await res.json();
        if (!j.ok) {
          flash(REGISTER_ERROR_MESSAGE[j.error as string] ?? REGISTER_ERROR_MESSAGE.SERVER);
        } else {
          flash(path === "register" ? "신청이 완료되었습니다!" : "신청이 취소되었습니다.");
        }
      } catch {
        flash(REGISTER_ERROR_MESSAGE.SERVER);
      } finally {
        await load();
        setBusy(false);
      }
    },
    [user, busy, flash, load],
  );

  if (!ready || !user) return null;

  return (
    <main className="min-h-dvh bg-slate-50">
      <TabNav />

      <header className="sticky top-[45px] z-10 bg-white/95 backdrop-blur border-b px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">
            {user.ranchName} · {user.userName}
          </span>
          <StatusPill status={status} />
        </div>
        <button
          onClick={() => {
            logout();
            router.replace("/");
          }}
          className="text-xs text-slate-400"
        >
          로그아웃
        </button>
      </header>

      <div className="mx-auto max-w-md px-4 py-5 space-y-3">
        {status === "CLOSED" && (
          <Banner tone="info" text="⏳ 신청 준비 중입니다. 관리자가 신청을 열면 자동으로 반영됩니다." />
        )}
        {status === "FINISHED" && (
          <Banner tone="muted" text="✅ 수강신청이 종료되었습니다." />
        )}
        {status === "OPEN" && !myClassId && (
          <Banner tone="info" text="한 명당 1개 부스만 신청할 수 있어요. 바꾸려면 취소 후 다시 신청하세요." />
        )}

        {!loaded && <p className="text-center text-slate-400 py-10">불러오는 중…</p>}

        {classes.map((c) => {
          const full = c.current_count >= c.max_capacity;
          const mine = myClassId === c.id;
          const blockedByOther = !mine && !!myClassId;
          const disabled =
            busy || status !== "OPEN" || (!mine && (full || blockedByOther));
          const pct = Math.min(
            100,
            Math.round((c.current_count / Math.max(c.max_capacity, 1)) * 100),
          );

          return (
            <div
              key={c.id}
              className={`rounded-2xl bg-white p-4 shadow-sm border ${
                mine ? "border-emerald-300" : "border-transparent"
              }`}
            >
              <div className="flex justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {(() => {
                    const first = images.find((i) => i.class_id === c.id);
                    return first ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/images/${first.id}`}
                        alt=""
                        loading="lazy"
                        className="h-12 w-12 rounded-lg object-cover bg-slate-100 shrink-0"
                      />
                    ) : null;
                  })()}
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 truncate">{c.name}</h3>
                    <p className="text-xs text-slate-500 truncate">
                      {c.instructor}
                      {c.instructor_sub ? `·${c.instructor_sub}` : ""}
                      {c.location ? ` · ${c.location}` : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-sm font-bold ${
                    full ? "text-red-500" : "text-slate-700"
                  }`}
                >
                  {c.current_count} / {c.max_capacity}명
                </span>
              </div>

              <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    full ? "bg-red-400" : pct >= 80 ? "bg-amber-400" : "bg-blue-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <button
                disabled={disabled}
                onClick={() => (mine ? act("cancel") : act("register", c.id))}
                className={`mt-3 w-full h-11 rounded-xl font-semibold transition active:scale-[.98] ${
                  mine
                    ? "bg-emerald-500 text-white"
                    : disabled
                      ? "bg-slate-200 text-slate-400"
                      : "bg-blue-600 text-white"
                }`}
              >
                {mine
                  ? "신청 완료 · 취소하기"
                  : full
                    ? "마감"
                    : blockedByOther
                      ? "다른 부스 신청 중"
                      : status !== "OPEN"
                        ? "신청 대기 중"
                        : "신청하기"}
              </button>
            </div>
          );
        })}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 rounded-full bg-slate-900 text-white text-sm px-4 py-2 shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}

function Banner({ text, tone }: { text: string; tone: "info" | "muted" }) {
  const cls =
    tone === "info"
      ? "bg-blue-50 text-blue-700"
      : "bg-slate-100 text-slate-500";
  return <div className={`rounded-xl ${cls} text-sm text-center py-3 px-3`}>{text}</div>;
}

function StatusPill({ status }: { status: SystemStatus }) {
  const map: Record<SystemStatus, string> = {
    OPEN: "bg-emerald-100 text-emerald-700",
    CLOSED: "bg-slate-100 text-slate-500",
    FINISHED: "bg-slate-800 text-white",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${map[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
