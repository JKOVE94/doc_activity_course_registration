import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  seq: number;
  ranch_name: string;
  user_name: string;
  created_at: string;
  classes: { name: string } | { name: string }[] | null;
};

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { data: ok, error: verifyError } = await supabaseAdmin.rpc("admin_verify", {
    p_password: body.password ?? "",
  });
  if (verifyError || !ok) {
    return NextResponse.json({ ok: false, error: "BAD_PASSWORD" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("registrations")
    .select("seq, ranch_name, user_name, created_at, classes(name)")
    .order("seq");

  if (error) {
    console.error("export error", error);
    return NextResponse.json({ ok: false, error: "SERVER" }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as Row[];
  const className = (r: Row) =>
    Array.isArray(r.classes) ? r.classes[0]?.name ?? "" : r.classes?.name ?? "";
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;

  const header = ["순번", "분반", "목장", "이름", "신청일시"].join(",");
  const lines = rows.map((r, i) =>
    [
      i + 1,
      esc(className(r)),
      esc(r.ranch_name),
      esc(r.user_name),
      esc(new Date(r.created_at).toLocaleString("ko-KR")),
    ].join(","),
  );

  // ﻿ (BOM) — Excel 에서 한글 깨짐 방지
  const csv = "﻿" + [header, ...lines].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registrations_${Date.now()}.csv"`,
    },
  });
}
