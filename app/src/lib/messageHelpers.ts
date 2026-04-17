/**
 * Message & Appointment Helpers
 * Handles message thread fetching, message sending, and appointment creation
 */

import { supabase } from './supabaseClient';
import { Message, MessageThread, Appointment } from './types';

// ============================================================================
// MESSAGE THREAD HELPERS
// ============================================================================

export async function getMessageThreads() {
  const { data, error } = await supabase
    .from('message_threads')
    .select('*, patients(id, full_name, phone, email)')
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getMessageThread(threadId: string) {
  const { data, error } = await supabase
    .from('message_threads')
    .select('*, patients(id, full_name, phone, email)')
    .eq('id', threadId)
    .single();

  if (error) throw error;
  return data;
}

export async function getOrCreateMessageThread(
  patientId: string,
  channel: 'sms' | 'messenger' | 'whatsapp' | 'email',
  externalThreadId?: string
) {
  // Try to find existing thread
  const { data: existing, error: fetchError } = await supabase
    .from('message_threads')
    .select('*')
    .eq('patient_id', patientId)
    .eq('channel', channel)
    .is('deleted_at', null)
    .single();

  if (existing && !fetchError) {
    return existing;
  }

  // Create new thread
  const { data: newThread, error: createError } = await supabase
    .from('message_threads')
    .insert({
      patient_id: patientId,
      channel,
      external_thread_id: externalThreadId,
    })
    .select()
    .single();

  if (createError) throw createError;
  return newThread;
}

// ============================================================================
// MESSAGE HELPERS
// ============================================================================

export async function getThreadMessages(threadId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Paginated message fetch — returns `limit` messages in ascending order.
 * Pass `before` (ISO timestamp) to get messages older than that point.
 */
export async function getThreadMessagesPaginated(
  threadId: string,
  limit: number,
  before?: string
): Promise<Message[]> {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Message[]).reverse(); // oldest first
}

export async function createMessage(
  threadId: string,
  content: string,
  senderType: 'patient' | 'staff',
  senderName?: string,
  messageType: 'text' | 'appointment_confirmed' | 'query' | 'system' = 'text',
  metadata: Record<string, any> = {}
) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      thread_id: threadId,
      sender_type: senderType,
      sender_id: null, // Will be handled by backend auth context
      sender_name: senderName,
      content,
      message_type: messageType,
      metadata,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// APPOINTMENT HELPERS
// ============================================================================

export async function createAppointment(
  patientId: string,
  appointmentDate: string,
  appointmentTime: string,
  dentistId?: string | null,
  notes?: string,
  messageThreadId?: string | null,
  concerns?: string
): Promise<Appointment> {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: patientId,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      dentist_id: dentistId || null,
      notes: notes || null,
      concerns: concerns || null,
      message_thread_id: messageThreadId || null,
      status: 'confirmed',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPatientAppointments(patientId: string) {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .is('deleted_at', null)
    .order('appointment_date', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getUpcomingAppointments(daysAhead: number = 7) {
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const { data, error } = await supabase
    .from('appointments')
    .select('*, patients(id, full_name, phone)')
    .gte('appointment_date', today)
    .lte('appointment_date', futureDate)
    .eq('status', 'confirmed')
    .is('deleted_at', null)
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true });

  if (error) throw error;
  return data;
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'pending' | 'confirmed' | 'completed' | 'no_show' | 'cancelled'
) {
  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', appointmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function cancelAppointment(appointmentId: string, reason?: string) {
  const { data, error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      notes: reason || null,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================================
// MESSAGING SERVICE HELPERS (For Bulksms/Messenger integration)
// ============================================================================

/**
 * Send SMS via Bulksms
 * Requires BULKSMS_API_KEY environment variable
 */
export async function sendSMS(phoneNumber: string, message: string) {
  try {
    const response = await fetch('/api/webhooks/bulksms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneNumber,
        message,
      }),
    });

    if (!response.ok) {
      throw new Error(`SMS send failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
}

/**
 * Send Messenger message
 * Requires FACEBOOK_ACCESS_TOKEN environment variable
 */
export async function sendMessengerMessage(recipientId: string, message: string) {
  try {
    const response = await fetch('/api/webhooks/messenger/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_id: recipientId,
        message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Messenger send failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending Messenger message:', error);
    throw error;
  }
}

/**
 * Send message via appropriate channel and create message record
 */
export async function sendThreadMessage(
  threadId: string,
  content: string,
  channel: 'sms' | 'messenger',
  recipientIdentifier: string // phone number for SMS, PSID for Messenger
) {
  try {
    // Send via appropriate channel
    if (channel === 'sms') {
      await sendSMS(recipientIdentifier, content);
    } else if (channel === 'messenger') {
      await sendMessengerMessage(recipientIdentifier, content);
    }

    // Record message in DB
    await createMessage(threadId, content, 'staff', undefined, 'text', {
      channel,
      recipient: recipientIdentifier,
    });

    return { success: true };
  } catch (error) {
    console.error(`Error sending ${channel} message:`, error);
    throw error;
  }
}

/**
 * Send appointment confirmation to patient via their preferred channel
 */
export async function sendAppointmentConfirmation(
  appointmentId: string,
  threadId: string,
  appointmentDate: string,
  appointmentTime: string,
  channel: 'sms' | 'messenger',
  recipientIdentifier: string
) {
  const message = `Your appointment has been confirmed! 📅\nDate: ${appointmentDate}\nTime: ${appointmentTime}\n\nSee you soon!`;

  try {
    if (channel === 'sms') {
      await sendSMS(recipientIdentifier, message);
    } else if (channel === 'messenger') {
      await sendMessengerMessage(recipientIdentifier, message);
    }

    // Record confirmation message
    await createMessage(
      threadId,
      message,
      'staff',
      undefined,
      'appointment_confirmed',
      { appointment_id: appointmentId, channel }
    );

    return { success: true };
  } catch (error) {
    console.error('Error sending appointment confirmation:', error);
    throw error;
  }
}

// ============================================================================
// PATIENT LINKING (For Unlinked Messenger/WhatsApp Threads)
// ============================================================================

/**
 * Link an unlinked message thread to a patient
 * Used when staff manually matches a Messenger/WhatsApp thread to a patient
 */
export async function linkThreadToPatient(
  threadId: string,
  patientId: string
): Promise<MessageThread> {
  const { data, error } = await supabase
    .from('message_threads')
    .update({ patient_id: patientId })
    .eq('id', threadId)
    .select('*, patients(id, full_name, phone, email)')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Unlink a thread from a patient (revert to unlinked state)
 */
export async function unlinkThreadFromPatient(threadId: string): Promise<MessageThread> {
  const { data, error } = await supabase
    .from('message_threads')
    .update({ patient_id: null })
    .eq('id', threadId)
    .select('*, patients(id, full_name, phone, email)')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch Messenger user profile info (name, picture) via server-side proxy.
 * The page access token never leaves the server — /api/messenger/profile handles the Graph API call.
 */
export async function getMessengerUserProfile(psid: string): Promise<{ name: string | null; picture_url: string | null }> {
  try {
    const res = await fetch(`/api/messenger/profile?psid=${encodeURIComponent(psid)}`);
    if (!res.ok) return { name: null, picture_url: null };
    return await res.json();
  } catch {
    return { name: null, picture_url: null };
  }
}

/**
 * Update thread external user info (name from Messenger/WhatsApp)
 */
export async function updateThreadExternalUserInfo(
  threadId: string,
  userName: string | null
): Promise<MessageThread> {
  const { data, error } = await supabase
    .from('message_threads')
    .update({
      external_user_name: userName,
    })
    .eq('id', threadId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get unlinked threads (for finding threads waiting to be linked to patients)
 */
export async function getUnlinkedThreads(channel?: string) {
  let query = supabase
    .from('message_threads')
    .select('*, patients(id, full_name)')
    .is('patient_id', null)
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false });

  if (channel) {
    query = query.eq('channel', channel);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

