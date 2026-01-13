# 🚀 Getting Started - Step by Step

## What to Do Right Now

### 1. ✅ Database Migration (REQUIRED FIRST)

**IMPORTANT:** The tables don't exist yet. You need to run the migration first.

1. Go to Supabase Dashboard
2. Click **SQL Editor**
3. Click **New Query**
4. Copy entire contents from: `migrations/003_appointments_messaging_schema.sql`
5. Paste into the SQL editor
6. Click **Execute** (or Cmd+Enter)
7. Wait for success (you'll see "✓" with line count)

⏱️ **Takes:** ~10 seconds

---

### 2. ✅ Create Test Data

After migration succeeds:

1. Still in Supabase SQL Editor
2. Click **New Query**
3. Copy entire contents from: `TEST_DATA_SETUP.sql`
4. **IMPORTANT:** Read the comments in that file - it has 3 placeholder IDs to replace
5. Paste into editor
6. Follow the commented steps to get actual IDs from your database
7. Replace the placeholders with real IDs
8. Execute

⏱️ **Takes:** ~5 minutes (mostly copy-pasting)

---

### 3. ✅ Test the UI

1. Make sure app is running (should be at http://localhost:3001)
2. Navigate to `/messages` (or click "💬 Messages" in top nav if you're logged in)
3. You should see:
   - Sidebar with "Test Patient SMS - SMS - [time]"
   - Empty chat area with "Select a conversation"
4. Click the test thread
5. You should see:
   - Chat window with messages flowing down
   - "Hi, can I book an appointment?"
   - Staff replies showing in blue
   - "Thursday 2pm works! Confirmed with Dr. Maria"
6. Try typing in the message box and clicking Send
7. Try clicking "+ Appointment" button

---

## Visual: What You Should See

### Messages Inbox View
```
┌──────────────────────────────────────┐
│ MESSAGES (left sidebar)              │
├──────────────────────────────────────┤
│ 💬 Test Patient SMS                  │
│    SMS • few seconds ago              │
│    [← selected = blue background]    │
└──────────────────────────────────────┘

Chat Window (right side):
┌──────────────────────────────────────┐
│ Test Patient SMS • SMS • +639123... │ [+Appointment]
├──────────────────────────────────────┤
│ (patient) Hi, can I book?            │
│ (staff)   Let me check...            │
│ (patient) Thursday 2pm?              │
│ (staff)   Confirmed! Dr. Maria       │
├──────────────────────────────────────┤
│ [Type message...] [Send]             │
└──────────────────────────────────────┘
```

---

## Troubleshooting

**Problem:** "/messages page shows 'No message threads yet'"
- **Fix:** You skipped creating test data. Do step 2 above.

**Problem:** "Page won't load / Error 500"
- **Fix:** You didn't run the migration. Do step 1 above.

**Problem:** "Can't log in / Auth error"
- **Fix:** Make sure you have valid Supabase credentials in `.env.local`

**Problem:** "Send button doesn't work"
- **Fix:** That's expected without webhooks configured. Check browser console for errors.

---

## Next: Optional Activations

Once you've tested the UI and it's working, you can optionally:

**To activate real SMS:**
1. Set Bulksms environment variables
2. Configure Bulksms webhook to: `https://your-app.com/api/webhooks/bulksms/receive`

**To activate real Messenger:**
1. Set Facebook env variables
2. Configure Messenger webhook in Facebook Developer console

See `APPOINTMENTS_MESSAGING_SETUP.md` for detailed instructions.

---

## You're Ready! 🚀

**Timeline:**
- Migration: 10 seconds
- Test data: 5 minutes
- Testing UI: 5 minutes
- **Total: ~20 minutes to see it working**

Start with step 1 (migration) in Supabase!
