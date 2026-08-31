"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, RotateCcw, FlaskConical, LogOut, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { REGISTER_ERROR_MESSAGE, STATUS_LABEL, type SystemStatus } from "@/lib/constants";
import type { ClassRow, RegistrationRow, ClassImageMeta } from "@/lib/types";
import ClassManager from "@/components/admin/ClassManager";
import {
  loadAdminSession,
  saveAdminSession,
  touchAdminSession,
  clearAdminSession,
} from "@/lib/adminSession";

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
  const [images, setImages] = useState<ClassImageMeta[]>([]);
  const [regs, setRegs] = useState<RegistrationRow[]>([]);
  const [status, setStatus] = useState<SystemStatus>("CLOSED");
  const [capacityPerClass, setCapacityPerClass] = useState<number | null>(null);
  const [attendeeTotal, setAttendeeTotal] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmSeed, setConfirmSeed] = useState<
    "classes" | "full" | "lastseat" | null
  >(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const [s, { data: r }] = await Promise.all([
      fetch("/api/snapshot", { cache: "no-store" }).then((x) => x.json()).catch(() => null),
      supabase
        .from("registrations")
        .select("seq, class_id, ranch_name, user_name, created_at")
        .order("seq"),
    ]);
    if (s && !s.error) {
      setClasses((s.classes as ClassRow[]) ?? []);
      setStatus((s.status as SystemStatus) ?? "CLOSED");
      setCapacityPerClass((s.capacity_per_class as number | null) ?? null);
      setImages((s.images as ClassImageMeta[]) ?? []);
      setAttendeeTotal((s.attendees as number) ?? 0);
    }
    setRegs((r as RegistrationRow[]) ?? []);
    touchAdminSession(); // 활동 중 세션 만료 연장
  }, []);

  // 새로고침 시 저장된 세션(30분) 복원
  useEffect(() => {
    const saved = loadAdminSession();
    if (!saved) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setPw(saved);
    setAuthed(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authed) return;
    const scheduleReload = () => {
      if (reloadTimer.current) return;
      reloadTimer.current = setTimeout(() => {
        reloadTimer.current = null;
        load();
      }, 1000);
    };
    touchAdminSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const channel = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "classes" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, scheduleReload)
      .subscribe();
    const poll = setInterval(load, 5000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
    };
  }, [authed, load]);

  const login = async () => {
    setWorking(true);
    setAuthErr("");
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const j = await res.json();
      if (j.ok) {
        saveAdminSession(pw);
        setAuthed(true);
      } else if (j.error === "SERVER") {
        setAuthErr("서버 오류입니다. 환경변수(SUPABASE_SECRET_KEY) 설정을 확인하세요.");
      } else {
        setAuthErr("비밀번호가 올바르지 않습니다.");
      }
    } catch {
      setAuthErr("잠시 후 다시 시도해 주세요.");
    } finally {
      setWorking(false);
    }
  };

  const setSystemStatus = async (next: SystemStatus) => {
    if (next === "OPEN" && !confirmOpen) {
      setConfirmOpen(true);
      return;
    }
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
        touchAdminSession();
        setConfirmOpen(false);
        setStatus(next);
        await load();
      } else {
        setConfirmOpen(false);
        setAuthErr(
          j.detail
            ? `DB 오류: ${j.detail}`
            : REGISTER_ERROR_MESSAGE[j.error as string] ??
              "상태 변경에 실패했습니다. 비밀번호를 다시 확인하세요.",
        );
      }
    } finally {
      setWorking(false);
    }
  };

  // 지금 오픈하면 적용될 분반당 정원 (미리보기)
  const previewCapacity =
    classes.length > 0 ? Math.max(Math.ceil(attendeeTotal / classes.length), 1) : 0;

  const doReset = async () => {
    setWorking(true);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const text = await res.text();
      let j: Record<string, unknown>;
      try {
        j = JSON.parse(text);
      } catch {
        alert(`초기화 실패 (HTTP ${res.status})\n${text.slice(0, 300)}`);
        return;
      }
      if (j.ok) {
        touchAdminSession();
        setConfirmReset(false);
        await load();
        alert(
          `초기화 완료 — 신청 ${j.deleted_registrations ?? 0}건, 로그인 ${
            j.deleted_attendees ?? 0
          }명, 부스 ${j.deleted_classes ?? 0}개 삭제`,
        );
      } else {
        alert(
          j.detail
            ? `초기화 실패: ${j.detail}${j.hint ? `\n힌트: ${j.hint}` : ""}`
            : j.error === "BAD_PASSWORD"
              ? "관리자 비밀번호가 올바르지 않습니다."
              : `초기화에 실패했습니다. (${j.error ?? "?"})`,
        );
      }
    } catch (e) {
      alert(`초기화 요청 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setWorking(false);
    }
  };

  const doSeed = async () => {
    if (!confirmSeed) return;
    setWorking(true);
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, scenario: confirmSeed }),
      });
      const text = await res.text();
      let j: Record<string, unknown>;
      try {
        j = JSON.parse(text);
      } catch {
        alert(`생성 실패 (HTTP ${res.status})\n${text.slice(0, 300)}`);
        return;
      }
      if (j.ok) {
        touchAdminSession();
        setConfirmSeed(null);
        await load();
        alert(
          j.scenario === "classes"
            ? `테스트 부스 ${j.classes ?? 0}개 생성 완료`
            : j.scenario === "lastseat"
              ? `분반당 1자리 시나리오 생성 완료 — 부스 ${j.classes ?? 0}개, 로그인 ${
                  j.attendees ?? 0
                }명, 신청 ${j.registrations ?? 0}건.\n테스터 로그인 후 '오픈'하면 분반당 정원 2명 중 1자리가 남습니다.`
              : `테스트 데이터 생성 완료 — 부스 ${j.classes ?? 0}개, 로그인 ${
                  j.attendees ?? 0
                }명, 신청 ${j.registrations ?? 0}건`,
        );
      } else {
        alert(
          j.detail
            ? `생성 실패: ${j.detail}`
            : j.error === "BAD_PASSWORD"
              ? "관리자 비밀번호가 올바르지 않습니다."
              : `생성에 실패했습니다. (${j.error ?? "?"})`,
        );
      }
    } catch (e) {
      alert(`생성 요청 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setWorking(false);
    }
  };

  const logout = () => {
    clearAdminSession();
    setPw("");
    setAuthed(false);
    setAuthErr("");
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
      <main className="min-h-dvh flex flex-col items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-sm">
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400"
          >
            <ArrowLeft size={13} /> 홈으로
          </Link>
          <h1 className="font-bold text-slate-800">관리자 로그인</h1>
          <p className="text-xs text-slate-400 mt-1">관리자 비밀번호를 입력하세요.</p>
          <input
            type="password"
            inputMode="numeric"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="관리자 비밀번호"
            className="mt-3 w-full h-11 rounded-xl border border-slate-300 px-3"
          />
          {authErr && <p className="text-sm text-red-500 mt-2">{authErr}</p>}
          <button
            disabled={working}
            onClick={login}
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
  const capacityLabel =
    status === "OPEN" && capacityPerClass != null
      ? `${capacityPerClass}명`
      : "오픈 시 확정";

  return (
    <main className="min-h-dvh bg-slate-50 pb-16">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link href="/" className="text-slate-400 hover:text-slate-600" aria-label="홈으로">
                <ArrowLeft size={16} />
              </Link>
              <h1 className="font-bold text-slate-800">관리자 대시보드</h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-semibold">{STATUS_LABEL[status]}</span> · 로그인 {attendeeTotal}
              명 · 부스 {classes.length}개 · 분반당 정원 {capacityLabel} · 신청{" "}
              {totalRegistered}/{totalCapacity}
            </p>
          </div>
          <button
            onClick={logout}
            className="shrink-0 flex items-center gap-1 text-xs text-slate-400 border border-slate-200 rounded-lg px-2 py-1"
          >
            <LogOut size={13} /> 로그아웃
          </button>
        </div>
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
          {authErr && <p className="mt-2 text-sm text-red-500">{authErr}</p>}
          <p className="mt-2 text-xs text-slate-400">
            &lsquo;오픈&rsquo;하는 순간 <b>로그인 인원({attendeeTotal}) ÷ 부스({classes.length})</b> ={" "}
            <b>분반당 {previewCapacity}명</b>으로 정원이 고정됩니다. &lsquo;대기&rsquo;→&lsquo;오픈&rsquo;을
            다시 하면 그 시점 인원으로 재계산됩니다.
          </p>
        </section>

        <ClassManager
          password={pw}
          classes={classes}
          images={images}
          onChanged={load}
        />

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

        <section className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
          <h2 className="font-bold text-amber-700">테스트 도구</h2>
          <p className="text-xs text-amber-600/80 mt-0.5">
            기존 데이터를 모두 지우고 샘플 데이터를 생성합니다.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setConfirmSeed("classes")}
              className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-amber-100 text-amber-700 font-semibold text-sm"
            >
              <FlaskConical size={14} /> 부스만 생성
            </button>
            <button
              onClick={() => setConfirmSeed("full")}
              className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-amber-500 text-white font-semibold text-sm"
            >
              <FlaskConical size={14} /> 부스 + 참가자
            </button>
            <button
              onClick={() => setConfirmSeed("lastseat")}
              className="col-span-2 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-amber-100 text-amber-700 font-semibold text-sm"
            >
              <FlaskConical size={14} /> 분반당 1자리 남김 (테스터 4명용)
            </button>
          </div>
          <p className="mt-2 text-[11px] text-amber-600/70">
            · 부스만: 샘플 부스 6개 (참가자·신청 없음)
            <br />· 부스 + 참가자: 부스 6개 + 가짜 로그인 40명 + 랜덤 신청 약 60%
            <br />· 분반당 1자리: 부스 6개 + 가짜 로그인 8명, 정원 2 중 1명 신청.
            테스터가 로그인 후 오픈하면 마지막 1자리 선착순을 테스트할 수 있음
          </p>
        </section>

        <section className="rounded-2xl bg-red-50 border border-red-100 p-4">
          <h2 className="font-bold text-red-700">위험 구역</h2>
          <p className="text-xs text-red-500/80 mt-0.5">
            모든 부스·신청·로그인 인원이 삭제되고 상태가 &lsquo;대기&rsquo;로 초기화됩니다.
          </p>
          <button
            onClick={() => setConfirmReset(true)}
            className="mt-3 flex items-center justify-center gap-1.5 h-11 w-full rounded-xl bg-red-600 text-white font-semibold"
          >
            <RotateCcw size={15} /> 전체 초기화 (부스 포함)
          </button>
        </section>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center px-5">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5">
            <p className="font-bold text-slate-800">지금 신청을 오픈할까요?</p>
            <p className="text-sm text-slate-500 mt-1">
              현재 로그인 <b>{attendeeTotal}명</b> ÷ 부스 <b>{classes.length}개</b> ={" "}
              <b>분반당 {previewCapacity}명</b>으로 모든 부스 정원이 고정됩니다.
            </p>
            {attendeeTotal === 0 && (
              <p className="text-sm text-red-500 mt-1">로그인한 인원이 없어 오픈할 수 없습니다.</p>
            )}
            {classes.length === 0 && (
              <p className="text-sm text-red-500 mt-1">등록된 부스가 없습니다.</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 h-10 rounded-xl bg-slate-100 font-semibold"
              >
                취소
              </button>
              <button
                disabled={working || attendeeTotal === 0 || classes.length === 0}
                onClick={() => setSystemStatus("OPEN")}
                className="flex-1 h-10 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50"
              >
                오픈
              </button>
            </div>
          </div>
        </div>
      )}

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

      {confirmSeed && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center px-5">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5">
            <p className="font-bold text-slate-800">
              {confirmSeed === "classes" ? "샘플 부스를 생성할까요?" : "테스트 데이터를 생성할까요?"}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              <b>현재 부스·신청·로그인 인원이 모두 삭제</b>되고{" "}
              {confirmSeed === "classes"
                ? "샘플 부스 6개만 생성됩니다."
                : confirmSeed === "lastseat"
                  ? "부스 6개 + 가짜 로그인 8명(분반당 1자리 남는 상태)으로 교체됩니다."
                  : "샘플 부스 6개 + 가짜 참가자로 교체됩니다."}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmSeed(null)}
                className="flex-1 h-10 rounded-xl bg-slate-100 font-semibold"
              >
                취소
              </button>
              <button
                disabled={working}
                onClick={doSeed}
                className="flex-1 h-10 rounded-xl bg-amber-500 text-white font-semibold disabled:opacity-50"
              >
                생성
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
