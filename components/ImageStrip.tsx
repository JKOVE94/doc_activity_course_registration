"use client";

// 가로 스냅 스크롤 이미지 스트립 (모바일 친화). 1장이면 한 장만 표시.
// id 목록을 받아 /api/images/<id> 로 렌더한다.
export default function ImageStrip({
  ids,
  className = "",
}: {
  ids: string[];
  className?: string;
}) {
  if (!ids || ids.length === 0) return null;
  return (
    <div
      className={`-mx-4 px-4 flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none ${className}`}
    >
      {ids.map((id) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={id}
          src={`/api/images/${id}`}
          alt=""
          loading="lazy"
          className={`snap-start rounded-xl object-cover bg-slate-100 h-44 shrink-0 ${
            ids.length === 1 ? "w-full" : "w-[78%]"
          }`}
        />
      ))}
    </div>
  );
}
