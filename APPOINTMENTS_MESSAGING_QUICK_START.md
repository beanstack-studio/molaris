# Appointments & Messaging System - Quick Reference

## What's Built ✅

### 1. **Unified Messages Inbox** (`/messages`)
- Single page showing all SMS and Messenger conversations
- Real-time updates (Supabase subscriptions)
- Patient info, channel type, last message timestamp
- Click to open chat window

### 2. **Chat Interface**
- View full message history
- Send replies (auto-routed to SMS or Messenger)
- **Create Appointment** button
- Messages color-coded (patient = light, staff = blue)

### 3. **Appointment Creation from Chat**
- Modal with date/time/dentist selector
- Creates appointment record
- Auto-sends confirmation back to patient via same channel
- Message logged in thread with "appointment_confirmed" type

### 4. **Database Schema**
```
appointments          message_threads         messages
├─ id                ├─ id                   ├─ id
├─ patient_id        ├─ patient_id           ├─ thread_id
├─ dentist_id        ├─ channel (sms|msg)    ├─ sender_type
├─ appointment_date  ├─ external_thread_id   ├─ content
├─ appointment_time  ├─ last_message_at      ├─ message_type
├─ status            ├─ unread_count         ├─ external_id
└─ message_thread_id └─ subject              └─ metadata
```

### 5. **API Webhooks** (Ready to connect)
- `POST /api/webhooks/bulksms/receive` - Receive SMS
- `POST /api/webhooks/bulksms/send` - Send SMS
- `GET/POST /api/webhooks/messenger/receive` - Messenger webhook
- `POST /api/webhooks/messenger/send` - Send Messenger message

## What You Need to Do

### 1. **Run Database Migration**
```bash
# Login to Supabase Dashboard
# Go to SQL Editor
# Copy & paste migrations/003_appointments_messaging_schema.sql
# Execute
```

### 2. **Set Environment Variables** (`.env.local`)
```env
# Bulksms
BULKSMS_USERNAME=your_username
BULKSMS_PASSWORD=your_password

# Facebook Messenger
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_token
MESSENGER_WEBHOOK_VERIFY_TOKEN=your_verify_token
```

### 3. **Configure Bulksms Webhook**
1. Go to Bulksms Dashboard → Settings → Webhooks
2. Add webhook:
   - URL: `https://your-app.com/api/webhooks/bulksms/receive`
   - Method: POST
   - Content-Type: application/json

### 4. **Configure Facebook Messenger Webhook**
1. Facebook Developers → Your App → Messenger → Settings
2. Configure Webhook:
   - Callback URL: `https://your-app.com/api/webhooks/messenger/receive`
   - Verify Token: (must match `MESSENGER_WEBHOOK_VERIFY_TOKEN`)
   - Subscribe to: `messages`

### 5. **Create Staff Table** (if not exists)
The AppointmentModal tries to load dentists from `staff` table:
```sql
CREATE TABLE IF NOT EXISTS staff (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text default 'staff',
  deleted_at timestamptz
);
```

## File Structure

```
app/src/
├─ app/
│  ├─ messages/
│  │  ├─ page.tsx           # Messages inbox
│  │  ├─ ChatWindow.tsx     # Chat component
│  │  └─ AppointmentModal.tsx
│  └─ api/webhooks/
│     ├─ bulksms/
│     │  ├─ receive/route.ts
│     │  └─ send/route.ts
│     └─ messenger/
│        ├─ receive/route.ts
│        └─ send/route.ts
├─ lib/
│  ├─ messageHelpers.ts    # All helper functions
│  ├─ types.ts             # Appointment, Message, MessageThread types
│  └─ supabaseClient.ts    # (existing)
└─ components/
   └─ TopNav.tsx           # (updated with Messages link)
```

## Helper Functions (in `messageHelpers.ts`)

### Fetch Data
```typescript
getMessageThreads()                    // All threads
getMessageThread(threadId)             // Single thread
getThreadMessages(threadId)            // Messages in thread
getPatientAppointments(patientId)      // Patient's appointments
getUpcomingAppointments(daysAhead=7)   // Next X days
```

### Create Data
```typescript
createMessage(threadId, content, 'staff', 'Cel')
createAppointment(patientId, date, time, dentistId)
getOrCreateMessageThread(patientId, 'sms', phone)
```

### Send Messages
```typescript
sendSMS(phone, message)
sendMessengerMessage(psid, message)
sendThreadMessage(threadId, message, channel, recipientId)
sendAppointmentConfirmation(appointmentId, threadId, date, time, channel, recipientId)
```

## Usage Example

```typescript
// In ChatWindow or any component
import { 
  sendThreadMessage, 
  createAppointment,
  sendAppointmentConfirmation 
} from "@/lib/messageHelpers";

// Send a message
await sendThreadMessage(
  threadId,
  "Your appointment is confirmed!",
  "sms",
  "+639XXXXXXXXX"
);

// Create appointment and send confirmation
const apt = await createAppointment(
  patientId,
  "2026-02-15",
  "10:00",
  dentistId
);

await sendAppointmentConfirmation(
  apt.id,
  threadId,
  "2026-02-15",
  "10:00",
  "sms",
  "+639XXXXXXXXX"
);
```

## Testing Checklist

- [ ] Database migration runs without errors
- [ ] `/messages` page loads (shows "No message threads" if DB is empty)
- [ ] Can create test message thread in Supabase directly
- [ ] Message thread appears in inbox
- [ ] Can click thread and chat window opens
- [ ] Can type and send message (check if API route returns success)
- [ ] Can click "+ Appointment"
- [ ] Modal appears with date/time/dentist selectors
- [ ] Can confirm appointment (checks if created in DB)

## Troubleshooting

**Messages page is blank:**
- Check message_threads table exists (run migration)
- Check RLS policies (should allow authenticated users to read)

**Can't send messages:**
- Check environment variables are set
- Check API routes are accessible
- Check Bulksms/Messenger credentials are valid

**Appointments not appearing:**
- Check `staff` table exists and has dentists
- Check `appointments` table exists
- Check appointment record is created in DB

**Real-time not working:**
- Supabase subscription should auto-update
- Check browser console for errors
- May need to refresh page

## Next Steps (Optional Enhancements)

1. **Add appointment calendar view** - Calendar page showing all appointments
2. **Add SMS/Messenger templates** - Pre-made responses ("appointment booked", etc)
3. **Add patient self-booking** - Public booking link
4. **Add WhatsApp** - Just add channel='whatsapp' and new webhook routes
5. **Add email** - Just add channel='email' and email service
6. **Add analytics** - No-show rates, booking trends, etc.

## Questions?

Check `APPOINTMENTS_MESSAGING_SETUP.md` for detailed documentation.
