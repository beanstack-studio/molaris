#!/usr/bin/env node

/**
 * Cleanup script to delete all invoices, payments, and receipts
 * This resets the invoice/payment numbering system
 */

const fs = require("fs");
const path = require("path");

// Read .env.local file
const envPath = path.join(__dirname, ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envLines = envContent.split("\n");

let SUPABASE_URL = "";
let SUPABASE_KEY = "";

envLines.forEach((line) => {
  if (line.includes("NEXT_PUBLIC_SUPABASE_URL=")) {
    SUPABASE_URL = line.split("=")[1].trim();
  }
  if (line.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) {
    SUPABASE_KEY = line.split("=")[1].trim();
  }
});

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing Supabase environment variables");
  console.error("Ensure .env.local is set up in the app folder");
  process.exit(1);
}

// Create Supabase client
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanup() {
  console.log("🗑️ Starting cleanup of invoices, payments, and receipts...\n");

  try {
    // 1. Delete invoice items
    console.log("1️⃣ Deleting invoice items...");
    const { data: itemsData, error: itemsError } = await supabase
      .from("invoice_items")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all
    if (itemsError) throw new Error(`Failed to delete invoice items: ${itemsError.message}`);
    console.log("   ✅ Invoice items deleted\n");

    // 2. Delete invoices
    console.log("2️⃣ Deleting invoices...");
    const { data: invoicesData, error: invoicesError } = await supabase
      .from("invoices")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all
    if (invoicesError) throw new Error(`Failed to delete invoices: ${invoicesError.message}`);
    console.log("   ✅ Invoices deleted\n");

    // 3. Delete receipts
    console.log("3️⃣ Deleting receipts...");
    const { data: receiptsData, error: receiptsError } = await supabase
      .from("receipts")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all
    if (receiptsError) throw new Error(`Failed to delete receipts: ${receiptsError.message}`);
    console.log("   ✅ Receipts deleted\n");

    // 4. Delete payments
    console.log("4️⃣ Deleting payments...");
    const { data: paymentsData, error: paymentsError } = await supabase
      .from("payments")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all
    if (paymentsError) throw new Error(`Failed to delete payments: ${paymentsError.message}`);
    console.log("   ✅ Payments deleted\n");

    // 5. Verify deletion
    console.log("5️⃣ Verifying deletion...");
    const counts = await Promise.all([
      supabase.from("invoices").select("id", { count: "exact", head: true }),
      supabase.from("invoice_items").select("id", { count: "exact", head: true }),
      supabase.from("receipts").select("id", { count: "exact", head: true }),
      supabase.from("payments").select("id", { count: "exact", head: true }),
    ]);

    const [invoicesCount, itemsCount, receiptsCount, paymentsCount] = counts.map((c) => c.count || 0);

    console.log(`   Invoices: ${invoicesCount}`);
    console.log(`   Invoice Items: ${itemsCount}`);
    console.log(`   Receipts: ${receiptsCount}`);
    console.log(`   Payments: ${paymentsCount}\n`);

    if (invoicesCount === 0 && itemsCount === 0 && receiptsCount === 0 && paymentsCount === 0) {
      console.log("✅ Cleanup successful! All records deleted.\n");
      console.log("📊 Invoice numbering will restart at INV26-0001");
      console.log("📊 Payment numbering will restart at PAY26-0001");
    } else {
      console.warn(
        "⚠️ Warning: Some records may still exist. Check database manually if needed."
      );
    }
  } catch (error) {
    console.error("❌ Cleanup failed:", error.message);
    process.exit(1);
  }
}

cleanup();
