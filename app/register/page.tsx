"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useUser } from "@/lib/useUser";
import {
  RANCHES,
  REGISTER_ERROR_MESSAGE,
  STATUS_LABEL,
  isValidName,
  type SystemStatus,
} from "@/lib/constants";
import type { ClassRow, ClassImageMeta } from "@/lib/types";
import TabNav from "@/components/TabNav";

export default function RegisterPage() {
  const router = useRouter();
  const { user, ready, login } = useUser();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [images, setImages] = useState<ClassImageMeta[]>([]);
  const [status, setStatus] = useState<SystemStatus>("CLOSED");
  const [myClassId, setMyClassId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/");
  }, [ready, user, router]);

  const flash = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  }, []);

  // 전역 스냅샷 (CDN 2초 캐시) — 접속자 수와 무관하게 DB 부하 일정
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/snapshot", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data) {
        setClasses((data.classes as ClassRow[]) ?? []);
        setStatus((data.status as SystemStatus) ?? "CLOSED");
        setImages((data.images as ClassImageMeta[]) ?? []);
      }
    } catch {
      /* keep last known */
    } finally {
      setLoaded(true);
    }
  }, []);

  // 내 신청 상태 (본인 액션으로만 바뀌므로 마운트 시 1회만 조회)
  const loadMine = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("registrations")
      .select("class_id")
      .eq("ranch_name", user.ranchName)
      .eq("user_name", user.userName)
      .maybeSingle();
    if (error) return; // 조회 실패 시 기존 상태 유지
    setMyClassId((data?.class_id as string | null) ?? null);
  }, [user]);

  // Realtime 이벤트 폭주 시 재조회를 1.2초로 합침
  const scheduleRefresh = useCallback(() => {
    if (reloadTimer.current) return;
    reloadTimer.current = setTimeout(() => {
      reloadTimer.current = null;
      refresh();
    }, 1200);
  }, [refresh]);

  // 로그인 인원 기록 (세션당 1회로 제한)
  useEffect(() => {
    if (!user) return;
    const key = `yf_rec_${user.ranchName}_${user.userName}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* ignore */
    }
    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ranchName: user.ranchName, userName: user.userName }),
    })
      .then(() => {
        try {
          sessionStorage.setItem(key, "1");
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    loadMine();
    const channel = supabase
      .channel("registration-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "classes" }, scheduleRefresh)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        scheduleRefresh,
      )
      .subscribe();
    const poll = setInterval(refresh, 4000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [user, refresh, loadMine, scheduleRefresh]);

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
          // FULL/ALREADY 등 → 서버 기준으로 내 상태·현황 재동기화
          await Promise.all([refresh(), loadMine()]);
        } else {
          setMyClassId(path === "register" ? (classId ?? null) : null);
          flash(path === "register" ? "신청이 완료되었습니다!" : "신청이 취소되었습니다.");
          await refresh();
        }
      } catch {
        flash(REGISTER_ERROR_MESSAGE.SERVER);
      } finally {
        setBusy(false);
      }
    },
    [user, busy, flash, refresh, loadMine],
  );

  if (!ready || !user) return null;

  return (
    <main className="min-h-dvh bg-slate-50">
      <TabNav />

      <header className="sticky top-[45px] z-10 bg-white/95 backdrop-blur border-b px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-slate-800 truncate">
            {user.ranchName} · {user.userName}
          </span>
          <StatusPill status={status} />
        </div>
        {status === "CLOSED" && (
          <button
            onClick={() => setEditOpen(true)}
            className="shrink-0 flex items-center gap-1 text-xs text-slate-400"
          >
            <Pencil size={12} /> 이름 변경
          </button>
        )}
      </header>

      <div className="mx-auto max-w-md px-4 py-5 space-y-3">
        {status === "CLOSED" && (
          <Banner tone="info" text="⏳ 신청 준비 중입니다. 관리자가 신청을 열면 자동으로 반영됩니다." />
        )}
        {status === "FINISHED" && <Banner tone="muted" text="✅ 수강신청이 종료되었습니다." />}
        {status === "OPEN" && !myClassId && (
          <Banner tone="info" text="한 명당 1개 부스만 신청할 수 있어요. 바꾸려면 취소 후 다시 신청하세요." />
        )}

        {!loaded && <p className="text-center text-slate-400 py-10">불러오는 중…</p>}

        {classes.map((c) => {
          const full = c.current_count >= c.max_capacity;
          const mine = myClassId === c.id;
          const blockedByOther = !mine && !!myClassId;
          const disabled = busy || status !== "OPEN" || (!mine && (full || blockedByOther));
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
                  className={`shrink-0 text-sm font-bold ${full ? "text-red-500" : "text-slate-700"}`}
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

      {editOpen && (
        <EditIdentityModal
          current={user}
          onClose={() => setEditOpen(false)}
          onSaved={(u) => {
            login(u);
            setEditOpen(false);
            flash("정보가 변경되었습니다.");
            loadMine();
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 rounded-full bg-slate-900 text-white text-sm px-4 py-2 shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}

function EditIdentityModal({
  current,
  onClose,
  onSaved,
}: {
  current: { ranchName: string; userName: string };
  onClose: () => void;
  onSaved: (u: { ranchName: string; userName: string }) => void;
}) {
  const [ranch, setRanch] = useState(current.ranchName);
  const [name, setName] = useState(current.userName);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!ranch) return setErr("목장을 선택해 주세요.");
    if (!isValidName(name)) return setErr("이름은 한글 2글자 이상으로 입력해 주세요.");
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ranchName: ranch,
          userName: name.trim(),
          prevRanchName: current.ranchName,
          prevUserName: current.userName,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        try {
          sessionStorage.setItem(`yf_rec_${ranch}_${name.trim()}`, "1");
        } catch {
          /* ignore */
        }
        onSaved({ ranchName: ranch, userName: name.trim() });
      } else {
        setErr(
          j.error === "INVALID_NAME"
            ? "이름은 한글 2글자 이상으로 입력해 주세요."
            : "변경에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
    } catch {
      setErr("변경에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center px-5">
      <div className="w-full max-w-xs rounded-2xl bg-white p-5">
        <h2 className="font-bold text-slate-800">목장 · 이름 변경</h2>
        <p className="text-xs text-slate-400 mt-0.5">신청 오픈 전에만 변경할 수 있어요.</p>

        <label className="block text-xs font-medium text-slate-600 mt-3 mb-1">목장</label>
        <select
          value={ranch}
          onChange={(e) => {
            setRanch(e.target.value);
            setErr("");
          }}
          className="w-full h-11 rounded-xl border border-slate-300 bg-white px-3 text-base"
        >
          {RANCHES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <label className="block text-xs font-medium text-slate-600 mt-3 mb-1">이름</label>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]/g, ""));
            setErr("");
          }}
          maxLength={10}
          className="w-full h-11 rounded-xl border border-slate-300 px-3 text-base"
        />

        {err && <p className="text-sm text-red-500 mt-2">{err}</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl bg-slate-100 font-semibold">
            취소
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 h-10 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Banner({ text, tone }: { text: string; tone: "info" | "muted" }) {
  const cls = tone === "info" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500";
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
