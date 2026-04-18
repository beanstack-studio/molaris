import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const BUCKET = "message-attachments";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const admin = getAdminClient();

    // Ensure the public bucket exists (no-ops if already present)
    await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {});

    const ext   = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path  = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: false });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      url:         urlData.publicUrl,
      contentType: file.type,
      name:        file.name,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
