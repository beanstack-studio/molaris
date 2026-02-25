-- Delete all invoices, receipts, and payments to restart numbering

-- Delete invoice items first (foreign keys)
DELETE FROM invoice_items;

-- Delete receipts 
DELETE FROM receipts;

-- Delete payments
DELETE FROM payments;

-- Delete invoices
DELETE FROM invoices;

-- Reset sequences if they exist
ALTER SEQUENCE invoices_id_seq RESTART WITH 1;
ALTER SEQUENCE invoice_items_id_seq RESTART WITH 1;
ALTER SEQUENCE payments_id_seq RESTART WITH 1;
ALTER SEQUENCE receipts_id_seq RESTART WITH 1;
