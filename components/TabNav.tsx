"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/booths", label: "부스 소개" },
  { href: "/register", label: "수강신청" },
] as const;

export default function TabNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-10 flex bg-white/95 backdrop-blur border-b text-sm font-semibold">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 text-center py-3 border-b-2 transition ${
              active
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-400"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
