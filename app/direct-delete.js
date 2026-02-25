const fs = require('fs');
const path = require('path');

// Read .env.local directly
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length > 0) {
    env[key.trim()] = rest.join('=').trim();
  }
});

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('URL:', supabaseUrl);
  console.error('Key:', supabaseAnonKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function deleteAll() {
  try {
    console.log('🗑️ Deleting all invoices and payments...\n');

    // Step 1: Delete invoice items
    console.log('1️⃣ Deleting invoice items...');
    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('id');
    if (!itemsError && items && items.length > 0) {
      const { error } = await supabase
        .from('invoice_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      console.log(`   ✅ Deleted ${items.length} invoice items\n`);
    } else {
      console.log(`   ✅ No invoice items to delete\n`);
    }

    // Step 2: Delete invoices
    console.log('2️⃣ Deleting invoices...');
    const { data: invoices, error: invError } = await supabase
      .from('invoices')
      .select('id');
    if (!invError && invoices && invoices.length > 0) {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      console.log(`   ✅ Deleted ${invoices.length} invoices\n`);
    } else {
      console.log(`   ✅ No invoices to delete\n`);
    }

    // Step 3: Delete receipts
    console.log('3️⃣ Deleting receipts...');
    const { data: receipts, error: recError } = await supabase
      .from('receipts')
      .select('id');
    if (!recError && receipts && receipts.length > 0) {
      const { error } = await supabase
        .from('receipts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      console.log(`   ✅ Deleted ${receipts.length} receipts\n`);
    } else {
      console.log(`   ✅ No receipts to delete\n`);
    }

    // Step 4: Delete payments
    console.log('4️⃣ Deleting payments...');
    const { data: payments, error: payError } = await supabase
      .from('payments')
      .select('id');
    if (!payError && payments && payments.length > 0) {
      const { error } = await supabase
        .from('payments')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      console.log(`   ✅ Deleted ${payments.length} payments\n`);
    } else {
      console.log(`   ✅ No payments to delete\n`);
    }

    // Step 5: Verify
    console.log('5️⃣ Verifying deletion...');
    const { count: invCount } = await supabase
      .from('invoices')
      .select('id', { count: 'exact' });
    const { count: itemCount } = await supabase
      .from('invoice_items')
      .select('id', { count: 'exact' });
    const { count: recCount } = await supabase
      .from('receipts')
      .select('id', { count: 'exact' });
    const { count: payCount } = await supabase
      .from('payments')
      .select('id', { count: 'exact' });

    console.log(`   Invoices: ${invCount}`);
    console.log(`   Invoice Items: ${itemCount}`);
    console.log(`   Receipts: ${recCount}`);
    console.log(`   Payments: ${payCount}\n`);

    if (invCount === 0 && itemCount === 0 && recCount === 0 && payCount === 0) {
      console.log('✅ All records deleted successfully!');
    } else {
      console.log('⚠️ Some records still remain');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteAll();
