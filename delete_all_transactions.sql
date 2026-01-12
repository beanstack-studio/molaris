-- Delete all transaction, invoice, and receipt records
-- Run this in Supabase SQL Editor to clean up all transactional data
-- WARNING: This will delete all invoices, payments, and receipts. This action cannot be undone!

-- ============================================================================
-- DELETE IN ORDER (respecting foreign key constraints)
-- ============================================================================

-- 1. Delete all receipts first (they reference payments)
DELETE FROM receipts WHERE 1=1;

-- 2. Delete all payments/transactions (they reference invoices)
DELETE FROM payments WHERE 1=1;

-- 3. Delete all invoice items (they reference invoices)
DELETE FROM invoice_items WHERE 1=1;

-- 4. Delete all invoices (the parent table)
DELETE FROM invoices WHERE 1=1;

-- ============================================================================
-- VERIFY DELETION
-- ============================================================================

SELECT 'Invoices' as table_name, count(*) as remaining_rows FROM invoices
UNION ALL
SELECT 'Invoice Items', count(*) FROM invoice_items
UNION ALL
SELECT 'Payments', count(*) FROM payments
UNION ALL
SELECT 'Receipts', count(*) FROM receipts;
