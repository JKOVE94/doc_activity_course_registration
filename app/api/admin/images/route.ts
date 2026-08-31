import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;

// 사진 추가 — multipart/form-data: password, classId, file
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const password = String(form.get("password") ?? "");
  const classId = String(form.get("classId") ?? "");
  const file = form.get("file");

  if (!classId || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "NOT_IMAGE" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 413 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const { data, error } = await supabaseAdmin.rpc("admin_add_class_image", {
    p_password: password,
    p_class_id: classId,
    p_content_type: file.type,
    p_base64: base64,
  });

  if (error) {
    console.error("admin_add_class_image error", error);
    return NextResponse.json({ ok: false, error: "SERVER" }, { status: 500 });
  }
  return NextResponse.json(data, { status: data?.ok ? 200 : 400 });
}

// 사진 삭제 — json: password, id
export async function DELETE(req: Request) {
  let body: { password?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("admin_delete_class_image", {
    p_password: body.password ?? "",
    p_id: body.id,
  });

  if (error) {
    console.error("admin_delete_class_image error", error);
    return NextResponse.json({ ok: false, error: "SERVER" }, { status: 500 });
  }
  return NextResponse.json(data, { status: data?.ok ? 200 : 400 });
}
