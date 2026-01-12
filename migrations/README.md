# Database Migrations

This directory contains SQL migration scripts for Matira Dental Studio.

## Available Migrations

### 001 - Payment System Schema Enhancement

**File:** `001_payment_system_schema.sql`

**Status:** Ready to deploy

**What it does:**
- Adds payment verification workflow (pending → verified)
- Adds staff tracking for cash receipt & payment verification
- Adds receipt generation with immutable snapshots
- Adds soft-delete (void) for payments & receipts
- Adds flexible JSONB details field for mode-specific data
- Sets up RLS policies for multi-user security
- Creates auto-update triggers for timestamps
- Adds performance indexes

**Key tables:**
- `payment_modes` → Enhanced with code, requirements flags, auto_verify
- `payments` → Extended with status, verification, voiding, proof tracking
- `staff` → New table for clinic staff
- `receipts` → New table for receipt tracking

**Backward compatible:** YES
- Old columns preserved
- New fields have defaults
- Existing code continues to work

**How to run:**
1. Create backup in Supabase Dashboard
2. Open Supabase SQL Editor
3. Copy entire content of `001_payment_system_schema.sql`
4. Paste and click "Run"
5. Verify with checks provided in PAYMENT_MIGRATION_QUICKSTART.md

**Documentation:**
- Quick start guide: [PAYMENT_MIGRATION_QUICKSTART.md](../PAYMENT_MIGRATION_QUICKSTART.md)
- Detailed guide: [PAYMENT_SYSTEM_MIGRATION.md](../PAYMENT_SYSTEM_MIGRATION.md)
- Architecture: [PAYMENT_SYSTEM_ARCHITECTURE.md](../PAYMENT_SYSTEM_ARCHITECTURE.md)
- Code examples: [PAYMENT_IMPLEMENTATION_QUICK_REF.md](../PAYMENT_IMPLEMENTATION_QUICK_REF.md)

---

## Migration Best Practices

### Before Running
1. ✅ Create database backup
2. ✅ Test on staging environment
3. ✅ Read the migration script comments
4. ✅ Review data dictionary

### During Execution
1. ✅ Copy entire script (don't modify)
2. ✅ Paste into SQL Editor
3. ✅ Review any warnings (there shouldn't be any)
4. ✅ Click "Run"
5. ✅ Wait for completion message

### After Execution
1. ✅ Run verification checks
2. ✅ Review data integrity
3. ✅ Update app code if needed
4. ✅ Test existing features (backward compat)
5. ✅ Test new features (if implementing)

---

## Idempotent Design

All migrations use `IF NOT EXISTS` / `IF MISSING` patterns:

```sql
ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
CREATE TABLE IF NOT EXISTS ...
DROP POLICY IF EXISTS ... (safe re-create)
```

This means:
- ✅ Safe to re-run without errors
- ✅ Safe to run on partially-migrated databases
- ✅ Can be version-controlled
- ✅ Can be automated in CI/CD

---

## Rollback Strategy

### Option 1: Restore from Backup (Safest)
```
Supabase Dashboard > Settings > Database > Backups > Restore
```

### Option 2: Disable Features (Temporary)
```sql
-- Disable triggers, RLS, new features without deleting tables
-- See migration comments for rollback SQL
```

### Option 3: Create Reverse Migration (Complex)
```
Create a new migration file (002_rollback_*.sql)
Drop new tables, remove new columns, etc.
```

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Relation does not exist" | Table/column doesn't exist | Ensure table exists before running |
| "Permission denied" | RLS policy blocking operation | Check RLS policies, may need admin key |
| Duplicate key error | Code already exists | Migration is idempotent, re-run safely |
| Slow performance | Large table migration | Run during maintenance window |

---

## Future Migrations

Planned enhancements:

- **002** - Installment plans support
- **003** - Payment reconciliation tracking
- **004** - Multi-proof file support
- **005** - Receipt customization (logo, letterhead, terms)
- **006** - Audit log table for compliance

All will follow the same idempotent pattern.

---

## Related Documentation

- **Setup:** [PAYMENT_MIGRATION_QUICKSTART.md](../PAYMENT_MIGRATION_QUICKSTART.md)
- **Details:** [PAYMENT_SYSTEM_MIGRATION.md](../PAYMENT_SYSTEM_MIGRATION.md)
- **Architecture:** [PAYMENT_SYSTEM_ARCHITECTURE.md](../PAYMENT_SYSTEM_ARCHITECTURE.md)
- **Code:** [PAYMENT_IMPLEMENTATION_QUICK_REF.md](../PAYMENT_IMPLEMENTATION_QUICK_REF.md)

---

## Support

For issues:
1. Check migration comments in SQL file
2. Review PAYMENT_SYSTEM_MIGRATION.md Data Dictionary
3. Check PAYMENT_SYSTEM_ARCHITECTURE.md for context
4. Restore from backup and re-review

---

**Last Updated:** January 12, 2026
**Migration Version:** 001
**Status:** Ready for Production
