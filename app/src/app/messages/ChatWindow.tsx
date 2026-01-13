"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Message, MessageThread, Patient, Appointment } from "@/lib/types";
import {
  getMessageThread,
  getThreadMessages,
  createMessage,
  sendThreadMessage,
  sendAppointmentConfirmation,
  createAppointment,
} from "@/lib/messageHelpers";
import AppointmentModal from "./AppointmentModal";

interface ChatWindowProps {
  threadId: string;
  onThreadUpdated: () => void;
}

export default function ChatWindow({ threadId, onThreadUpdated }: ChatWindowProps) {
  const [thread, setThread] = useState<MessageThread & { patients: Patient } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadThreadData();
    // Set up real-time listener for new messages
    const subscription = supabase
      .channel(`thread:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadThreadData = async () => {
    try {
      setLoading(true);
      const [threadData, messagesData] = await Promise.all([
        getMessageThread(threadId),
        getThreadMessages(threadId),
      ]);

      setThread(threadData);
      setMessages(messagesData);
    } catch (err) {
      console.error("Error loading thread:", err);
      setError("Failed to load conversation");
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const messagesData = await getThreadMessages(threadId);
      setMessages(messagesData);
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !thread) return;

    try {
      setSending(true);
      setError(null);

      // Send message via appropriate channel
      const recipientId = thread.external_thread_id || thread.patients?.phone || "";
      await sendThreadMessage(threadId, replyText, thread.channel as "sms" | "messenger", recipientId);

      setReplyText("");
      await loadMessages();
      onThreadUpdated();
    } catch (err) {
      console.error("Error sending reply:", err);
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleConfirmAppointment = async (
    appointmentDate: string,
    appointmentTime: string,
    dentistId?: string
  ) => {
    if (!thread) return;

    try {
      setSending(true);

      // Create appointment
      const appointment = await createAppointment(
        thread.patient_id,
        appointmentDate,
        appointmentTime,
        dentistId || null,
        `Booked via ${thread.channel}`,
        threadId
      );

      // Send confirmation message
      const recipientId = thread.external_thread_id || thread.patients?.phone || "";
      await sendAppointmentConfirmation(
        appointment.id,
        threadId,
        appointmentDate,
        appointmentTime,
        thread.channel as "sms" | "messenger",
        recipientId
      );

      setShowAppointmentModal(false);
      await loadMessages();
      onThreadUpdated();
    } catch (err) {
      console.error("Error confirming appointment:", err);
      setError("Failed to confirm appointment");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-600">Loading conversation...</p>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-600">Failed to load conversation</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {thread.patients?.full_name}
            </h2>
            <p className="text-sm text-slate-600">
              {thread.channel.toUpperCase()} • {thread.patients?.phone}
            </p>
          </div>
          <button
            onClick={() => setShowAppointmentModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            + Appointment
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {error && (
          <div className="p-3 bg-red-100 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        {messages.length === 0 ? (
          <div className="text-center text-slate-600 mt-8">
            <p>No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender_type === "staff" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  msg.sender_type === "staff"
                    ? "bg-blue-500 text-white"
                    : "bg-white text-slate-900 border border-slate-200"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.sender_type === "staff" ? "text-blue-100" : "text-slate-500"
                  }`}
                >
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Input */}
      <div className="border-t border-slate-200 bg-white p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendReply();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={sending}
          />
          <button
            onClick={handleSendReply}
            disabled={!replyText.trim() || sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>

      {/* Appointment Modal */}
      {showAppointmentModal && (
        <AppointmentModal
          patientId={thread.patient_id}
          onConfirm={handleConfirmAppointment}
          onCancel={() => setShowAppointmentModal(false)}
          isSending={sending}
        />
      )}
    </div>
  );
}
