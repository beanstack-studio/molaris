import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/delete-document
 * Deletes a document using the service role key (bypasses RLS).
 * Body: { id: string, docType: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { id, docType } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let table = "documents";
    if (docType === "INVOICE") table = "invoices";
    else if (docType === "PAYMENT_RECEIPT") table = "receipts";

    const { error } = await serviceSupabase.from(table).delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
