# System Architecture Diagram

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL CHANNELS                                 │
├─────────────────┬────────────────────────────┬──────────────────────┤
│                 │                            │                      │
│  SMS (Bulksms)  │  Messenger (Facebook)      │  Future (WhatsApp)   │
│                 │                            │                      │
└────────┬────────┴────────────┬───────────────┴──────────────────────┘
         │                     │
         ▼                     ▼
    ┌─────────────────────────────────────┐
    │  WEBHOOKS (Receive Incoming)        │
    ├─────────────────────────────────────┤
    │  POST /api/webhooks/bulksms/receive │
    │  POST /api/webhooks/messenger/recv  │
    └────────┬────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────────────┐
    │  FIND/CREATE MESSAGE THREAD                  │
    ├──────────────────────────────────────────────┤
    │  • Match phone number (SMS)                  │
    │  • Match PSID (Messenger)                    │
    │  • Create thread if doesn't exist            │
    └────────┬─────────────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────────────┐
    │  STORE MESSAGE IN DB                         │
    ├──────────────────────────────────────────────┤
    │  messages table                              │
    │  ├─ thread_id                                │
    │  ├─ sender_type (patient)                    │
    │  ├─ content                                  │
    │  ├─ external_id (for dedup)                  │
    │  └─ metadata (channel, phone/PSID)           │
    └────────┬─────────────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────────────┐
    │  UPDATE THREAD: last_message_at              │
    ├──────────────────────────────────────────────┤
    │  Trigger updates thread timestamp            │
    │  Staff sees "new message" in inbox           │
    └──────────────────────────────────────────────┘
```

## Staff Workflow

```
STAFF (Cel) Opens App
        │
        ▼
    Navigate to /messages
        │
        ▼
    ┌────────────────────────────────────────┐
    │  MESSAGES INBOX                        │
    ├────────────────────────────────────────┤
    │  [💬 Sarah M. - SMS - 5 min ago]       │
    │  [👥 John D. - Messenger - 2 hrs]     │
    │  [💬 Maria G. - SMS - new]             │
    └────┬─────────────────────────────────┘
         │
         ▼ (Click thread)
    ┌─────────────────────────────────────────┐
    │  CHAT WINDOW                            │
    ├─────────────────────────────────────────┤
    │  Sarah M. • SMS • +639XXXXXXXXX         │
    │                                         │
    │  ─────────────────────────────────────  │
    │  Sarah: Can I book Thursday 2pm?        │
    │  ─────────────────────────────────────  │
    │                                         │
    │  [Message input] [+ Appointment]        │
    └─────────────────────────────────────────┘
         │
         ├─── (Option 1: Just reply)
         │    └─ Type message → Send
         │       └─ SMS/Messenger sent
         │
         └─── (Option 2: Confirm appointment)
              └─ Click "+ Appointment"
                 │
                 ▼
              ┌───────────────────────────────┐
              │  APPOINTMENT MODAL            │
              ├───────────────────────────────┤
              │  Date: 2026-02-13             │
              │  Time: 14:00                  │
              │  Dentist: [Dr. Maria]         │
              │                               │
              │  [Cancel] [Confirm & Send]    │
              └────────┬──────────────────────┘
                       │
                       ▼
              ┌───────────────────────────────┐
              │  SYSTEM ACTIONS               │
              ├───────────────────────────────┤
              │  1. Create appointment record │
              │  2. Send SMS/Messenger reply: │
              │     "Confirmed! See you      │
              │      Thursday 2pm"           │
              │  3. Log confirmation msg     │
              │  4. Show in calendar         │
              └───────────────────────────────┘
```

## Data Storage Architecture

```
SUPABASE (PostgreSQL)
│
├─ message_threads
│  ├─ id: uuid
│  ├─ patient_id → patients.id
│  ├─ channel: 'sms' | 'messenger'
│  ├─ external_thread_id: phone | PSID
│  ├─ last_message_at
│  └─ unread_count
│
├─ messages
│  ├─ id: uuid
│  ├─ thread_id → message_threads.id
│  ├─ sender_type: 'patient' | 'staff'
│  ├─ content: text
│  ├─ message_type: 'text' | 'appointment_confirmed'
│  ├─ external_id: Bulksms ID | Messenger MID
│  └─ metadata: {channel, phone/PSID, ...}
│
└─ appointments
   ├─ id: uuid
   ├─ patient_id → patients.id
   ├─ dentist_id → staff.id (optional)
   ├─ appointment_date
   ├─ appointment_time
   ├─ status: 'pending' | 'confirmed' | 'completed' | 'no_show'
   ├─ message_thread_id → message_threads.id (optional)
   └─ notes: text
```

## API Endpoint Flow

### Sending SMS

```
Staff clicks "Send" in chat
        │
        ▼
chatWindow.tsx calls sendThreadMessage()
        │
        ▼
POST /api/webhooks/bulksms/send
├─ Auth: None (internal API)
├─ Body: {phone, message}
├─ Action: Call Bulksms API
└─ Response: {success: true, messageId}
        │
        ▼
Message recorded in DB
        │
        ▼
Chat UI updates with message
```

### Receiving SMS

```
Patient sends SMS to clinic number
        │
        ▼
Bulksms receives message
        │
        ▼
Bulksms calls POST /api/webhooks/bulksms/receive
├─ Body: {msisdn: phone, message: text, id: msgId}
├─ Action:
│  ├─ Find patient by phone
│  ├─ Get/create message thread
│  └─ Store message in DB
└─ Response: {success: true}
        │
        ▼
Thread appears in staff's inbox (real-time via Supabase)
        │
        ▼
Staff sees conversation in /messages
```

### Creating Appointment from Chat

```
Staff clicks "+ Appointment"
        │
        ▼
AppointmentModal shows
├─ Date picker
├─ Time picker
└─ Dentist dropdown
        │
        ▼
Staff clicks "Confirm & Send"
        │
        ▼
System:
├─ Creates appointment record
├─ Gets thread's channel & recipient ID
├─ Calls sendAppointmentConfirmation()
│  ├─ Sends SMS/Messenger message
│  └─ Records confirmation in messages table
└─ Updates UI
        │
        ▼
Patient receives SMS/Messenger: "Confirmed! See you [date] [time]"
```

## Real-time Updates

```
Message arrives via webhook
        │
        ▼
Stored in DB (message_threads + messages)
        │
        ▼
Supabase emits "postgres_changes" event
        │
        ▼
ChatWindow subscription listener catches it
        │
        ▼
UI automatically re-renders (no manual refresh)
```

## Channel Abstraction

The system uses a `channel` field to support multiple platforms:

```
channel === 'sms'
├─ external_thread_id = phone number
├─ sendThreadMessage uses Bulksms API
└─ metadata.phone stored for context

channel === 'messenger'
├─ external_thread_id = PSID (Messenger user ID)
├─ sendThreadMessage uses Facebook Graph API
└─ metadata.sender_id stored for context

channel === 'whatsapp' (future)
├─ external_thread_id = phone number
├─ sendThreadMessage uses WhatsApp API
└─ metadata.phone stored for context

channel === 'email' (future)
├─ external_thread_id = email address
├─ sendThreadMessage uses SendGrid/Mailgun
└─ metadata.email stored for context
```

## Security & RLS

```
Supabase Row-Level Security Policies:

message_threads:
├─ Staff can READ/WRITE all
└─ Patients can READ only their own (patient_id = auth.uid())

messages:
├─ Staff can READ/WRITE all
└─ Patients can READ only messages in their threads

appointments:
├─ Staff can READ/WRITE all
└─ Patients can READ only their own (patient_id = auth.uid())
```

## Extensibility

```
To add new channel (e.g., WhatsApp):

1. Create webhook routes
   └─ /api/webhooks/whatsapp/receive
   └─ /api/webhooks/whatsapp/send

2. Add WhatsApp logic (same pattern as Bulksms)
   ├─ Receive: Extract phone, find patient, store message
   └─ Send: Call WhatsApp API

3. Add environment variables
   └─ WHATSAPP_API_KEY
   └─ WHATSAPP_ACCOUNT_ID

4. Update sendThreadMessage() to handle 'whatsapp' channel

5. UI automatically shows it
   ├─ New emoji in thread list
   └─ No code changes needed
```
