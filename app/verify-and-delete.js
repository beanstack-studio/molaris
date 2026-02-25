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

console.log('🔍 Using Supabase URL:', supabaseUrl);
console.log('🔍 Using API Key:', supabaseAnonKey?.substring(0, 20) + '...\n');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyAndDelete() {
  try {
    // Step 1: Verify current counts
    console.log('📊 BEFORE DELETION:\n');
    
    const { count: invCount1 } = await supabase
      .from('invoices')
      .select('id', { count: 'exact' });
    console.log(`   Invoices: ${invCount1}`);

    const { count: itemCount1 } = await supabase
      .from('invoice_items')
      .select('id', { count: 'exact' });
    console.log(`   Invoice Items: ${itemCount1}`);

    const { count: recCount1 } = await supabase
      .from('receipts')
      .select('id', { count: 'exact' });
    console.log(`   Receipts: ${recCount1}`);

    const { count: payCount1 } = await supabase
      .from('payments')
      .select('id', { count: 'exact' });
    console.log(`   Payments: ${payCount1}\n`);

    // Step 2: Show actual data
    console.log('📋 ACTUAL DATA IN DATABASE:\n');
    
    const { data: invData } = await supabase
      .from('invoices')
      .select('id, invoice_number')
      .limit(5);
    if (invData && invData.length > 0) {
      console.log('   Invoices:');
      invData.forEach(inv => console.log(`     - ${inv.invoice_number} (${inv.id})`));
    }

    const { data: payData } = await supabase
      .from('payments')
      .select('id, transaction_id, amount')
      .limit(5);
    if (payData && payData.length > 0) {
      console.log('   Payments:');
      payData.forEach(pay => console.log(`     - ${pay.transaction_id || pay.id} (${pay.amount})`));
    }

    if ((!invData || invData.length === 0) && (!payData || payData.length === 0)) {
      console.log('   (No records found)\n');
    } else {
      console.log();
    }

    // Step 3: Delete if records exist
    if (invCount1 > 0 || itemCount1 > 0 || recCount1 > 0 || payCount1 > 0) {
      console.log('🗑️ DELETING...\n');

      if (itemCount1 > 0) {
        const { error } = await supabase
          .from('invoice_items')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        console.log('   ✅ Deleted invoice items');
      }

      if (invCount1 > 0) {
        const { error } = await supabase
          .from('invoices')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        console.log('   ✅ Deleted invoices');
      }

      if (recCount1 > 0) {
        const { error } = await supabase
          .from('receipts')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        console.log('   ✅ Deleted receipts');
      }

      if (payCount1 > 0) {
        const { error } = await supabase
          .from('payments')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        console.log('   ✅ Deleted payments');
      }
    } else {
      console.log('ℹ️ No records to delete\n');
    }

    // Step 4: Verify final counts
    console.log('📊 AFTER DELETION:\n');
    
    const { count: invCount2 } = await supabase
      .from('invoices')
      .select('id', { count: 'exact' });
    console.log(`   Invoices: ${invCount2}`);

    const { count: itemCount2 } = await supabase
      .from('invoice_items')
      .select('id', { count: 'exact' });
    console.log(`   Invoice Items: ${itemCount2}`);

    const { count: recCount2 } = await supabase
      .from('receipts')
      .select('id', { count: 'exact' });
    console.log(`   Receipts: ${recCount2}`);

    const { count: payCount2 } = await supabase
      .from('payments')
      .select('id', { count: 'exact' });
    console.log(`   Payments: ${payCount2}\n`);

    if (invCount2 === 0 && itemCount2 === 0 && recCount2 === 0 && payCount2 === 0) {
      console.log('✅ ALL RECORDS DELETED SUCCESSFULLY!');
    } else {
      console.log('⚠️ Some records still remain');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyAndDelete();
