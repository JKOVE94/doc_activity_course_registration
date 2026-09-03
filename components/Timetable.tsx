import type { TimeSlot } from "@/lib/types";

// 부스 상세의 타임테이블 표시
export default function Timetable({
  slots,
  className = "",
}: {
  slots: TimeSlot[];
  className?: string;
}) {
  const valid = (slots ?? []).filter((s) => s?.start && s?.end);
  if (valid.length === 0) return null;
  return (
    <ul className={`space-y-1 ${className}`}>
      {valid.map((s, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-600">
          <span className="shrink-0 tabular-nums text-slate-400">
            {s.start}~{s.end}
          </span>
          <span className="min-w-0">{s.activity?.trim() || "—"}</span>
        </li>
      ))}
    </ul>
  );
}
