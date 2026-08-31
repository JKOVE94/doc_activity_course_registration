import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const BUCKET = "class-images";

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const password = String(form.get("password") ?? "");
  const file = form.get("file");

  const { data: verified, error: verifyErr } = await supabaseAdmin.rpc("admin_verify", {
    p_password: password,
  });
  if (verifyErr || verified !== true) {
    return NextResponse.json({ ok: false, error: "BAD_PASSWORD" }, { status: 401 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "NO_FILE" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "NOT_IMAGE" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "FILE_TOO_LARGE" }, { status: 413 });
  }

  const ext = (file.name.split(".").pop() ?? "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 5) || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (uploadErr) {
    console.error("storage upload error", uploadErr);
    return NextResponse.json({ ok: false, error: "UPLOAD_FAILED" }, { status: 500 });
  }

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: pub.publicUrl });
}
