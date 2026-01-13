# Appointments & Messaging System - Setup Guide

## Overview

This document outlines the appointments and unified messaging system that connects SMS (Bulksms), Facebook Messenger, and patient bookings into a single interface.

## Database Schema

The system uses three main tables:

### 1. **appointments**
Stores all appointment records
- `patient_id` - Links to patient
- `dentist_id` - Assigned dentist (optional)
- `appointment_date` - Date of appointment
- `appointment_time` - Time of appointment
- `status` - pending, confirmed, completed, no_show, cancelled
- `message_thread_id` - Link to message thread if booked via messaging
- `notes` - Additional notes

### 2. **message_threads**
Groups conversations by patient and channel
- `patient_id` - Links to patient
- `channel` - 'sms', 'messenger', 'whatsapp', 'email'
- `external_thread_id` - Phone number (SMS) or PSID (Messenger)
- `last_message_at` - Timestamp of last message
- `unread_count` - Number of unread messages

### 3. **messages**
Individual messages in threads
- `thread_id` - Links to message thread
- `sender_type` - 'patient' or 'staff'
- `content` - Message text
- `message_type` - 'text', 'appointment_confirmed', 'query', 'system'
- `external_id` - For deduplication (Bulksms ID, Messenger MID)
- `metadata` - Channel-specific data

## Features

### Messages Inbox (`/app/messages`)
- Single unified interface for SMS and Messenger conversations
- Real-time message updates (via Supabase subscriptions)
- Patient information displayed per thread
- Channel icons (💬 SMS, 👥 Messenger)
- Unread message counts

### Chat Window
- View full conversation history
- Send replies via appropriate channel
- **Create Appointment** button to book appointments from chat
- Auto-confirmation with patient

### Appointment Creation from Messages
- Click "+ Appointment" in chat window
- Select date, time, and dentist
- System automatically:
  1. Creates appointment in calendar
  2. Sends confirmation back to patient via same channel
  3. Records message in thread

## Environment Variables Required

### Bulksms (SMS)
```
BULKSMS_USERNAME=your_bulksms_username
BULKSMS_PASSWORD=your_bulksms_password
```

### Facebook Messenger
```
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token
MESSENGER_WEBHOOK_VERIFY_TOKEN=your_verify_token
```

## API Endpoints

### Bulksms
- `POST /api/webhooks/bulksms/receive` - Receive incoming SMS messages
- `POST /api/webhooks/bulksms/send` - Send SMS messages

### Messenger
- `GET /api/webhooks/messenger/receive` - Webhook verification
- `POST /api/webhooks/messenger/receive` - Receive incoming Messenger messages
- `POST /api/webhooks/messenger/send` - Send Messenger messages

## Integration Setup

### 1. Database Migration

Run the migration to create tables:

```bash
# In Supabase dashboard or via CLI
psql < migrations/003_appointments_messaging_schema.sql
```

### 2. Bulksms Setup

1. Create Bulksms account at https://www.bulksms.com
2. Get username and password from API settings
3. Set environment variables
4. Configure webhook URL in Bulksms dashboard:
   - Webhook URL: `https://your-app.com/api/webhooks/bulksms/receive`
   - Method: POST
   - Content-Type: application/json

### 3. Facebook Messenger Setup

1. Create Facebook Developer account
2. Create/configure App
3. Add Messenger product
4. Generate Page Access Token
5. Create Webhook Verification Token (any random string)
6. Set environment variables
7. Configure webhook in Messenger settings:
   - Callback URL: `https://your-app.com/api/webhooks/messenger/receive`
   - Verify Token: (match your env var)
   - Subscribe to: `messages`, `messaging_postbacks`

## Helper Functions

All messaging functions are in `/app/src/lib/messageHelpers.ts`:

### Message Management
- `getMessageThreads()` - Fetch all conversation threads
- `getMessageThread(threadId)` - Get single thread with messages
- `getOrCreateMessageThread()` - Get or create thread
- `getThreadMessages(threadId)` - Fetch messages in thread
- `createMessage()` - Create new message record

### Appointments
- `createAppointment()` - Create new appointment
- `getPatientAppointments()` - Get patient's appointments
- `getUpcomingAppointments()` - Get upcoming confirmed appointments
- `updateAppointmentStatus()` - Change appointment status
- `cancelAppointment()` - Soft-delete appointment

### Sending Messages
- `sendSMS()` - Send SMS via Bulksms
- `sendMessengerMessage()` - Send message via Messenger
- `sendThreadMessage()` - Smart send (auto-detects channel)
- `sendAppointmentConfirmation()` - Send appointment confirmation

## Future Extensions

The system is designed to be extensible:

### Add WhatsApp
1. Add WhatsApp to `channel` enum
2. Create `/api/webhooks/whatsapp/receive` route
3. Create `/api/webhooks/whatsapp/send` route
4. Add WhatsApp credentials to `.env`

### Add Email
1. Add 'email' to `channel` enum
2. Create `/api/webhooks/email/receive` route
3. Add email service (SendGrid, Mailgun, etc.)
4. UI will automatically show email threads

### Add In-App Notifications
1. Add 'in_app' to `channel` enum
2. Create in-app notification component
3. Messages sent internally (no external service needed)

## Testing

### Manual Testing

1. **Send test SMS:**
   ```bash
   curl -X POST http://localhost:3000/api/webhooks/bulksms/send \
     -H "Content-Type: application/json" \
     -d '{"phone":"+639XXXXXXXXX","message":"Test message"}'
   ```

2. **Test Messenger webhook verification:**
   ```bash
   curl "http://localhost:3000/api/webhooks/messenger/receive?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test_challenge"
   ```

3. **Create test thread and message:**
   ```typescript
   import { getOrCreateMessageThread, createMessage } from "@/lib/messageHelpers";
   
   const thread = await getOrCreateMessageThread(patientId, 'sms', '+639XXXXXXXXX');
   await createMessage(thread.id, 'Test message', 'patient', 'Test Patient');
   ```

## Troubleshooting

### Messages not appearing
- Check webhook URLs are correctly configured in Bulksms/Facebook
- Verify environment variables are set
- Check Supabase RLS policies allow inserts
- Check network/firewall isn't blocking webhooks

### SMS not sending
- Verify Bulksms credentials
- Check phone number format (should include country code)
- Check Bulksms account has credits

### Messenger not responding
- Verify Page Access Token is valid
- Check webhook is subscribed to `messages` event
- Verify PSID (sender ID) matches in database

## Notes

- SMS messages are stored with `external_thread_id` = phone number
- Messenger threads use PSID (Messenger user ID) as `external_thread_id`
- Appointments can be linked to message threads for context
- All messages support soft-deletion (not hard-deleted from DB)
- System uses RLS policies so only clinic staff can see all threads
- Patients can only see their own conversations

## Files Created

- `migrations/003_appointments_messaging_schema.sql` - Database schema
- `app/src/lib/types.ts` - Added Appointment, MessageThread, Message types
- `app/src/lib/messageHelpers.ts` - Helper functions
- `app/src/app/messages/page.tsx` - Messages inbox page
- `app/src/app/messages/ChatWindow.tsx` - Chat component
- `app/src/app/messages/AppointmentModal.tsx` - Appointment creation modal
- `app/src/app/api/webhooks/bulksms/receive/route.ts` - Bulksms incoming webhook
- `app/src/app/api/webhooks/bulksms/send/route.ts` - Bulksms send endpoint
- `app/src/app/api/webhooks/messenger/receive/route.ts` - Messenger webhook
- `app/src/app/api/webhooks/messenger/send/route.ts` - Messenger send endpoint
- Updated `app/src/components/TopNav.tsx` - Added Messages link to navigation
