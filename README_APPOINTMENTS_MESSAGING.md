# README - Appointments & Messaging Feature

## 🎯 What's Done

Your **Appointments & Messaging** system is complete and ready. Everything is on the `feature/appointments-messaging` branch.

### The System
✅ **Unified Inbox** (`/messages`) - SMS & Messenger conversations in one place
✅ **Chat Interface** - Message history, send replies, create appointments
✅ **Auto Appointment Booking** - Confirm appointment from chat → sends confirmation SMS/Messenger
✅ **Database Schema** - `appointments`, `message_threads`, `messages` tables
✅ **Webhooks Ready** - Bulksms and Facebook Messenger integration points
✅ **Real-time Updates** - Messages appear instantly
✅ **Future-Proof** - Easy to add WhatsApp, Email, etc.

### Key Files
```
Database:
  migrations/003_appointments_messaging_schema.sql

Frontend:
  app/src/app/messages/page.tsx (inbox)
  app/src/app/messages/ChatWindow.tsx (chat)
  app/src/app/messages/AppointmentModal.tsx (booking)

API:
  app/src/app/api/webhooks/bulksms/
  app/src/app/api/webhooks/messenger/

Library:
  app/src/lib/messageHelpers.ts (helpers)
  app/src/lib/types.ts (new types)

Documentation:
  APPOINTMENTS_MESSAGING_QUICK_START.md (👈 START HERE)
  APPOINTMENTS_MESSAGING_SETUP.md (detailed)
  SYSTEM_ARCHITECTURE.md (diagrams)
```

---

## 📋 What You Need to Do

### Option 1: Just Test It First (Recommended)
1. Read: `APPOINTMENTS_MESSAGING_QUICK_START.md` (5 min read)
2. Run database migration
3. Test manually (create test message thread in Supabase)
4. See it work in `/messages` page
5. Then decide if you want to activate webhooks

### Option 2: Full Setup (Activate SMS/Messenger)
Follow `FEATURE_COMPLETE_SUMMARY.md` section "Next Steps" - about 30 minutes total:
1. Run migration
2. Create staff table
3. Set environment variables
4. Configure Bulksms webhook
5. Configure Facebook Messenger webhook
6. Test

---

## 🚀 Quick Start (Most Important)

### 1. Database Migration (Required)
In Supabase Dashboard → SQL Editor:
- Copy `migrations/003_appointments_messaging_schema.sql`
- Click Execute
- Done! ✅

### 2. Create Staff Table (If needed)
```sql
CREATE TABLE IF NOT EXISTS staff (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text default 'staff'
);

INSERT INTO staff (full_name, role) VALUES ('Dr. Maria', 'dentist');
```

### 3. Test the UI
```bash
# In your app directory
npm run dev
# Visit http://localhost:3000/messages
# Should see "No message threads yet"
```

### 4. Create Test Data (to see it work)
In Supabase Dashboard → SQL Editor:
```sql
-- Get a patient ID first
SELECT id, full_name FROM patients LIMIT 1;

-- Create test thread (copy patient ID from above)
INSERT INTO message_threads (patient_id, channel, external_thread_id)
VALUES ('PASTE-PATIENT-ID-HERE', 'sms', '+639123456789');

-- Get the thread ID that was created
SELECT id FROM message_threads ORDER BY created_at DESC LIMIT 1;

-- Create test message (copy thread ID)
INSERT INTO messages (thread_id, sender_type, sender_name, content, message_type)
VALUES ('PASTE-THREAD-ID-HERE', 'patient', 'Test Patient', 'Can I book Thursday?', 'text');
```

### 5. View in App
- Refresh `/messages`
- Should see your test thread
- Click it to see message
- Try sending reply
- Click "+ Appointment" to test modal

**That's it!** You've now seen the full system in action. 🎉

---

## 🔌 Optional: Activate Real SMS/Messenger

Once you're satisfied:

1. **Set environment variables** (`.env.local`)
   ```env
   BULKSMS_USERNAME=your_username
   BULKSMS_PASSWORD=your_password
   FACEBOOK_PAGE_ACCESS_TOKEN=your_token
   MESSENGER_WEBHOOK_VERIFY_TOKEN=your_random_string
   ```

2. **Configure Bulksms Webhook**
   - Dashboard → Webhooks
   - Add: `https://your-app.com/api/webhooks/bulksms/receive`

3. **Configure Messenger Webhook**
   - Facebook Developers → Your App → Messenger → Settings
   - Add: `https://your-app.com/api/webhooks/messenger/receive`

Then real SMS & Messenger messages will flow in automatically.

---

## ❓ How It Works (30-second version)

```
Patient sends SMS → Bulksms webhook → Stored in DB → Appears in /messages
Cel opens /messages → Sees all conversations → Clicks one → Opens chat
Cel reads message → Types reply → Hits Send → SMS goes back to patient

When Cel wants to confirm appointment:
Cel clicks "+ Appointment" → Fills date/time → Clicks Confirm
System creates appointment → Sends confirmation SMS → Patient sees confirmation
```

---

## 📚 Documentation Map

Need more details? Read these in order:

1. **APPOINTMENTS_MESSAGING_QUICK_START.md** - Overview + quick reference
2. **SYSTEM_ARCHITECTURE.md** - Visual diagrams (how everything connects)
3. **APPOINTMENTS_MESSAGING_SETUP.md** - Detailed setup & configuration
4. **FEATURE_COMPLETE_SUMMARY.md** - Full feature list + next steps

---

## ✨ Key Features

- ✅ Conversations auto-organized by patient
- ✅ SMS and Messenger in same interface
- ✅ Create appointments directly from chat
- ✅ Auto-send confirmations via SMS/Messenger
- ✅ Real-time message updates (no refresh needed)
- ✅ Staff see all conversations, patients see only theirs
- ✅ Future-proof (easy to add WhatsApp, Email, etc.)
- ✅ No messages lost if app goes down
- ✅ Deduplication prevents duplicate messages

---

## 🔄 Branch Status

**Branch:** `feature/appointments-messaging`
**Status:** ✅ Complete and ready
**Ready to merge:** Yes, once you've tested

See all commits:
```bash
git log feature/appointments-messaging --oneline | head -10
```

---

## 🆘 If Something Breaks

1. Check database migration ran successfully
2. Verify environment variables are set
3. Check browser console for errors
4. Check Supabase logs
5. Make sure staff table exists with dentists
6. Read troubleshooting section in `APPOINTMENTS_MESSAGING_SETUP.md`

---

## 🎓 Learn More

Want to understand the code?

- **messageHelpers.ts** - All the business logic (functions to send, receive, store messages)
- **ChatWindow.tsx** - How real-time updates work (Supabase subscriptions)
- **003_appointments_messaging_schema.sql** - Database design with RLS policies

---

## Next Steps

1. ✅ Read this file (you're doing it!)
2. → Run database migration
3. → Create test data (or just send real SMS if you want)
4. → Test `/messages` page
5. → If it works, merge to main
6. → Deploy to production

**You're all set!** 🚀

Questions? All answers are in the docs listed above.
