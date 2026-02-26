-- ============================================================================
-- FIX RECEIPTS RLS POLICY
-- The original policy was too restrictive for INSERT operations
-- ============================================================================

-- ============================================================================
-- FIX RECEIPTS RLS POLICY
-- The original policy was too restrictive for INSERT operations
-- ============================================================================

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Allow users to manage receipts" ON receipts;

-- Create separate policies for different operations

-- Allow all authenticated users to INSERT receipts
CREATE POLICY "Allow authenticated to insert receipts" ON receipts
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Allow viewing all receipts
CREATE POLICY "Allow authenticated to view receipts" ON receipts
  FOR SELECT TO authenticated
  USING (true);

-- Allow updating own receipts
CREATE POLICY "Allow users to update own receipts" ON receipts
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR auth.jwt()->>'role' = 'admin')
  WITH CHECK (created_by = auth.uid() OR auth.jwt()->>'role' = 'admin');

-- Allow deleting own receipts
CREATE POLICY "Allow users to delete own receipts" ON receipts
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR auth.jwt()->>'role' = 'admin');
