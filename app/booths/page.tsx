"use client";

import { useEffect, useState } from "react";
import { MapPin, User, Package, Users, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { ClassRow, ClassImageMeta } from "@/lib/types";
import TabNav from "@/components/TabNav";
import ImageStrip from "@/components/ImageStrip";

export default function BoothsPage() {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [images, setImages] = useState<ClassImageMeta[]>([]);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc("get_public_snapshot").then(({ data, error }) => {
      if (!error && data) {
        setRows((data.classes as ClassRow[]) ?? []);
        setImages((data.images as ClassImageMeta[]) ?? []);
        setCapacity(
          data.status === "OPEN" ? (data.capacity_per_class as number | null) : null,
        );
      }
      setLoading(false);
    });
  }, []);

  const imageIds = (classId: string) =>
    images.filter((i) => i.class_id === classId).map((i) => i.id);

  return (
    <main className="min-h-dvh bg-slate-50">
      <TabNav />
      <div className="mx-auto max-w-md px-4 py-5 space-y-3">
        <p className="text-sm text-slate-500 px-1">
          각 부스의 내용을 미리 확인하고, 신청이 열리면 &lsquo;수강신청&rsquo; 탭에서 신청하세요.
        </p>

        {loading && <p className="text-center text-slate-400 py-10">불러오는 중…</p>}

        {rows.map((c) => {
          const ids = imageIds(c.id);
          return (
          <div key={c.id} className="rounded-2xl bg-white p-4 shadow-sm overflow-hidden">
            <h3 className="font-bold text-slate-800 text-lg">{c.name}</h3>
            {ids.length > 0 && (
              <div className="mt-3">
                <ImageStrip ids={ids} />
              </div>
            )}
            {c.description && (
              <p className="text-sm text-slate-600 mt-3 whitespace-pre-line leading-relaxed">
                {c.description}
              </p>
            )}
            <div className="mt-3 space-y-1.5 text-xs text-slate-500">
              <p className="flex items-center gap-1.5">
                <User size={13} /> 메인 · {c.instructor}
              </p>
              {c.instructor_sub && (
                <p className="flex items-center gap-1.5">
                  <UserPlus size={13} /> 보조 · {c.instructor_sub}
                </p>
              )}
              {c.location && (
                <p className="flex items-center gap-1.5">
                  <MapPin size={13} /> {c.location}
                </p>
              )}
              {c.materials && (
                <p className="flex items-center gap-1.5">
                  <Package size={13} /> 준비물 · {c.materials}
                </p>
              )}
              <p className="flex items-center gap-1.5 font-semibold text-slate-700 pt-0.5">
                <Users size={13} />{" "}
                {capacity != null ? `분반당 정원 ${capacity}명` : "정원 신청 오픈 시 확정"}
              </p>
            </div>
          </div>
          );
        })}
      </div>
    </main>
  );
}
