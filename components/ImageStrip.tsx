"use client";

// 가로 스냅 스크롤 이미지 스트립 (모바일 친화). 1장이면 그냥 한 장 표시.
export default function ImageStrip({
  urls,
  className = "",
}: {
  urls: string[];
  className?: string;
}) {
  if (!urls || urls.length === 0) return null;
  return (
    <div
      className={`-mx-4 px-4 flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none ${className}`}
    >
      {urls.map((u, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={u + i}
          src={u}
          alt=""
          loading="lazy"
          className={`snap-start rounded-xl object-cover bg-slate-100 h-44 ${
            urls.length === 1 ? "w-full" : "w-[78%]"
          } shrink-0`}
        />
      ))}
    </div>
  );
}
