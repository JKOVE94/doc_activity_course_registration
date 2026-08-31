"use client";

import { useRef, useState } from "react";
import { Plus, Pencil, Trash2, X, ImagePlus, Loader2 } from "lucide-react";
import type { ClassRow, ClassPayload, ClassImageMeta } from "@/lib/types";

const MAX_IMAGES = 3;
const INPUT_CLS = "w-full h-11 rounded-xl border border-slate-300 px-3 text-base";
const TEXTAREA_CLS =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-base resize-none";

const EMPTY: ClassPayload = {
  name: "",
  instructor: "",
  instructor_sub: "",
  description: "",
  location: "",
  materials: "",
  capacity_cap: "",
};

type Props = {
  password: string;
  classes: ClassRow[];
  images: ClassImageMeta[];
  onChanged: () => void | Promise<void>;
};

export default function ClassManager({ password, classes, images, onChanged }: Props) {
  const [form, setForm] = useState<ClassPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const imgCount = (classId: string) =>
    images.filter((i) => i.class_id === classId).length;

  const openNew = () => {
    setErr("");
    setForm({ ...EMPTY });
  };

  const openEdit = (c: ClassRow) => {
    setErr("");
    setForm({
      id: c.id,
      name: c.name,
      instructor: c.instructor,
      instructor_sub: c.instructor_sub ?? "",
      description: c.description ?? "",
      location: c.location ?? "",
      materials: c.materials ?? "",
      capacity_cap: c.capacity_cap != null ? String(c.capacity_cap) : "",
      sort_order: c.sort_order,
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.instructor.trim()) {
      setErr("부스 이름과 메인 담당자는 필수입니다.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, class: form }),
      });
      const j = await res.json();
      if (j.ok) {
        await onChanged();
        // 새 부스: id 를 채워 모달을 유지 → 이어서 사진 추가 가능
        if (!form.id && j.id) setForm({ ...form, id: j.id as string });
        else setForm(null);
      } else {
        setErr(
          {
            BAD_PASSWORD: "세션이 만료되었습니다. 새로고침 후 다시 로그인하세요.",
            INVALID_INPUT: "부스 이름과 메인 담당자는 필수입니다.",
            NOT_FOUND: "이미 삭제된 부스입니다.",
          }[j.error as string] ?? "저장에 실패했습니다.",
        );
      }
    } catch {
      setErr("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/classes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, id }),
      });
      const j = await res.json();
      if (j.ok) {
        setDeleteId(null);
        await onChanged();
      } else {
        alert("삭제에 실패했습니다.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-800">부스 관리</h2>
        <button
          onClick={openNew}
          className="flex items-center gap-1 text-sm rounded-lg bg-blue-600 text-white px-3 py-1.5"
        >
          <Plus size={14} /> 새 부스
        </button>
      </div>

      <ul className="mt-3 divide-y divide-slate-100">
        {classes.map((c) => {
          const firstImg = images.find((i) => i.class_id === c.id);
          return (
            <li key={c.id} className="py-2.5 flex items-center gap-3">
              {firstImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/images/${firstImg.id}`}
                  alt=""
                  className="h-11 w-11 rounded-lg object-cover bg-slate-100 shrink-0"
                />
              ) : (
                <div className="h-11 w-11 rounded-lg bg-slate-100 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {c.instructor}
                  {c.instructor_sub ? ` · ${c.instructor_sub}` : ""} · 사진 {imgCount(c.id)}
                  {c.capacity_cap != null ? ` · 상한 ${c.capacity_cap}` : ""}
                </p>
              </div>
              {deleteId === c.id ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    disabled={saving}
                    onClick={() => doDelete(c.id)}
                    className="text-xs rounded-md bg-red-600 text-white px-2 py-1"
                  >
                    삭제
                  </button>
                  <button
                    onClick={() => setDeleteId(null)}
                    className="text-xs rounded-md bg-slate-100 px-2 py-1"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(c)}
                    className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
                    aria-label="수정"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteId(c.id)}
                    className="p-1.5 rounded-md text-red-500 hover:bg-red-50"
                    aria-label="삭제"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {classes.length === 0 && (
          <li className="py-4 text-center text-sm text-slate-400">
            등록된 부스가 없습니다. &lsquo;새 부스&rsquo;로 추가하세요.
          </li>
        )}
      </ul>

      {form && (
        <ClassFormModal
          form={form}
          setForm={setForm}
          images={form.id ? images.filter((i) => i.class_id === form.id) : []}
          onClose={() => setForm(null)}
          onSave={save}
          onImagesChanged={onChanged}
          saving={saving}
          err={err}
          password={password}
        />
      )}
    </section>
  );
}

// 브라우저에서 이미지 리사이즈 (최대 변 1600px, JPEG) → DB/전송 부담 최소화
async function downscale(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", quality),
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function ClassFormModal({
  form,
  setForm,
  images,
  onClose,
  onSave,
  onImagesChanged,
  saving,
  err,
  password,
}: {
  form: ClassPayload;
  setForm: (f: ClassPayload) => void;
  images: ClassImageMeta[];
  onClose: () => void;
  onSave: () => void;
  onImagesChanged: () => void | Promise<void>;
  saving: boolean;
  err: string;
  password: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ClassPayload>(k: K, v: ClassPayload[K]) =>
    setForm({ ...form, [k]: v });

  const addImage = async (file: File) => {
    if (!form.id || images.length >= MAX_IMAGES) return;
    setUploadErr("");
    setUploading(true);
    try {
      const blob = await downscale(file);
      const fd = new FormData();
      fd.append("password", password);
      fd.append("classId", form.id);
      fd.append("file", new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" }));
      const res = await fetch("/api/admin/images", { method: "POST", body: fd });
      const j = await res.json();
      if (j.ok) {
        await onImagesChanged();
      } else {
        setUploadErr(
          {
            FILE_TOO_LARGE: "이미지 용량이 너무 큽니다.",
            NOT_IMAGE: "이미지 파일만 올릴 수 있어요.",
            MAX_IMAGES: "사진은 최대 3장까지입니다.",
            BAD_PASSWORD: "세션이 만료되었습니다. 새로고침 후 다시 로그인하세요.",
          }[j.error as string] ?? "업로드에 실패했습니다.",
        );
      }
    } catch {
      setUploadErr("업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeImage = async (id: string) => {
    setRemoving(id);
    try {
      const res = await fetch("/api/admin/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, id }),
      });
      if ((await res.json()).ok) await onImagesChanged();
      else alert("사진 삭제에 실패했습니다.");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">
            {form.id ? "부스 수정" : "새 부스 추가"}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400" aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <Field label="부스 이름 *">
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={INPUT_CLS}
              placeholder="캘리그라피 원데이"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="메인 담당자 *">
              <input
                value={form.instructor}
                onChange={(e) => set("instructor", e.target.value)}
                className={INPUT_CLS}
                placeholder="김은혜"
              />
            </Field>
            <Field label="보조 담당자">
              <input
                value={form.instructor_sub}
                onChange={(e) => set("instructor_sub", e.target.value)}
                className={INPUT_CLS}
                placeholder="이요한"
              />
            </Field>
          </div>

          <Field label="설명">
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className={TEXTAREA_CLS}
              placeholder="부스 개요, 진행 방식 등"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="장소">
              <input
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                className={INPUT_CLS}
                placeholder="본당 2층"
              />
            </Field>
            <Field label="준비물">
              <input
                value={form.materials}
                onChange={(e) => set("materials", e.target.value)}
                className={INPUT_CLS}
                placeholder="없음"
              />
            </Field>
          </div>

          <Field label="정원 상한 (선택)">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={form.capacity_cap}
              onChange={(e) => set("capacity_cap", e.target.value.replace(/[^0-9]/g, ""))}
              className={INPUT_CLS}
              placeholder="비우면 자동 정원"
            />
          </Field>
          <p className="text-xs text-slate-400">
            기본 정원은 오픈 시 <b>로그인 인원 ÷ 부스 수</b>(올림)로 자동 계산됩니다.
            상한을 입력하면 이 부스는 그 값을 넘게 배정되지 않습니다(둘 중 작은 값 적용).
          </p>

          <div>
            <p className="text-xs font-medium text-slate-600 mb-1.5">
              사진 ({images.length}/{MAX_IMAGES})
            </p>
            {!form.id ? (
              <p className="text-xs text-slate-400">
                부스를 먼저 저장하면 사진을 추가할 수 있어요.
              </p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {images.map((img) => (
                  <div key={img.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/images/${img.id}`}
                      alt=""
                      className="h-20 w-20 rounded-lg object-cover bg-slate-100"
                    />
                    <button
                      onClick={() => removeImage(img.id)}
                      disabled={removing === img.id}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-slate-800 text-white flex items-center justify-center"
                      aria-label="사진 삭제"
                    >
                      {removing === img.id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <X size={12} />
                      )}
                    </button>
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="h-20 w-20 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400"
                    aria-label="사진 추가"
                  >
                    {uploading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <ImagePlus size={18} />
                    )}
                  </button>
                )}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addImage(f);
              }}
            />
            {uploadErr && <p className="text-xs text-red-500 mt-1">{uploadErr}</p>}
          </div>

          {err && <p className="text-sm text-red-500">{err}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-xl bg-slate-100 font-semibold"
            >
              {form.id ? "완료" : "취소"}
            </button>
            <button
              onClick={onSave}
              disabled={saving || uploading}
              className="flex-1 h-11 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
