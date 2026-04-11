"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDateTimePH, formatPhoneLocal } from "@/lib/helpers";
import { Spinner } from "@/components/Spinner";
import { Message, MessageThread, Patient, Appointment } from "@/lib/types";
import {
  getMessageThread,
  getThreadMessages,
  createMessage,
  sendThreadMessage,
  sendAppointmentConfirmation,
  createAppointment,
  getMessengerUserProfile,
} from "@/lib/messageHelpers";
import AppointmentModal from "./AppointmentModal";
import LinkPatientModal from "./LinkPatientModal";

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
  const [showLinkPatientModal, setShowLinkPatientModal] = useState(false);
  const [messengerProfilePic, setMessengerProfilePic] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState<string>("bg-blue-500");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate random theme color for initials avatar
  const getRandomAvatarColor = (seed: string) => {
    const colors = [
      "bg-blue-500",
      "bg-indigo-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-red-500",
      "bg-orange-500",
      "bg-amber-500",
      "bg-green-500",
      "bg-teal-500",
      "bg-cyan-500",
    ];
    const hash = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

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

      // Set avatar color based on thread name
      if (threadData.external_user_name) {
        setAvatarColor(getRandomAvatarColor(threadData.external_user_name));
      }

      // Fetch fresh profile pic for unlinked Messenger threads
      if (threadData.channel === "messenger" && !threadData.patient_id && threadData.external_thread_id) {
        try {
          const profile = await getMessengerUserProfile(threadData.external_thread_id);
          if (profile?.picture_url) {
            setMessengerProfilePic(profile.picture_url);
          }
        } catch (err) {
          console.warn("Could not fetch Messenger profile pic:", err);
          // Not critical, continue anyway
        }
      }
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
    dentistId?: string,
    concerns?: string
  ) => {
    if (!thread || !thread.patient_id) return;

    try {
      setSending(true);

      // Create appointment
      const appointment = await createAppointment(
        thread.patient_id,
        appointmentDate,
        appointmentTime,
        dentistId || null,
        `Booked via ${thread.channel}`,
        threadId,
        concerns
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
        <Spinner />
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
        <div className="flex-between gap-4">
          <div className="flex-1">
            {thread.patient_id ? (
              <>
                <h2 className="text-lg font-bold text-slate-900">
                  {thread.patients?.full_name}
                </h2>
                <p className="text-muted-sm">
                  {thread.channel.toUpperCase()} • {thread.patients?.phone ? formatPhoneLocal(thread.patients.phone) : "—"}
                </p>
              </>
            ) : (
              /* Unlinked thread - show external user info */
              <div className="flex-center-gap">
                <div className="flex-1">
                  <div className="flex-center-gap-sm mb-1">
                    {messengerProfilePic ? (
                      <img
                        src={messengerProfilePic}
                        alt={thread.external_user_name || "User"}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      /* Fallback to initials avatar if no pic */
                      <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                        {thread.external_user_name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase() || "?"}
                      </div>
                    )}
                    <h2 className="text-lg font-bold text-slate-900">
                      {thread.external_user_name || "Unknown"}
                    </h2>
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                      Not linked
                    </span>
                  </div>
                  <p className="text-muted-sm">
                    {thread.channel.toUpperCase()} • {thread.external_thread_id}
                  </p>
                </div>
                <button
                  onClick={() => setShowLinkPatientModal(true)}
                  className="btn btn-primary"
                >
                  Link Patient
                </button>
              </div>
            )}
          </div>

          {thread.patient_id && (
            <button
              onClick={() => setShowAppointmentModal(true)}
              className="save-btn"
            >
              + Appointment
            </button>
          )}
        </div>
      </div>

      {/* Messages - Add padding to prevent overlap with sticky reply box */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 pb-24">
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
              className={`flex gap-2 ${msg.sender_type === "staff" ? "justify-end" : "justify-start"}`}
            >
              {msg.sender_type === "patient" && (
                <div className={`w-8 h-8 rounded-full ${avatarColor} flex-shrink-0 flex items-center justify-center text-white text-xs font-bold`}>
                  {(() => {
                    const name = thread.patients?.full_name || thread.external_user_name || msg.sender_name || "?";
                    const parts = name.split(" ");
                    if (parts.length < 2) return parts[0]?.[0]?.toUpperCase() || "?";
                    return (parts[0]?.[0] + parts[parts.length - 1]?.[0])?.toUpperCase() || "?";
                  })()}
                </div>
              )}
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
                  {formatDateTimePH(msg.created_at)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Input - Sticky to bottom of screen (responsive to sidebar) */}
      <div className="fixed bottom-0 right-0 border-t border-slate-200 bg-white p-4 shadow-lg z-30 md:left-80 left-0">
        <div className="action-row">
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
            className="save-btn"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>

      {/* Appointment Modal */}
      {showAppointmentModal && thread.patient_id && (
        <AppointmentModal
          patientId={thread.patient_id}
          onConfirm={handleConfirmAppointment}
          onCancel={() => setShowAppointmentModal(false)}
          isSending={sending}
        />
      )}

      {/* Link Patient Modal */}
      {showLinkPatientModal && (
        <LinkPatientModal
          threadId={threadId}
          externalUserName={thread.external_user_name}
          onLinked={() => {
            setShowLinkPatientModal(false);
            loadThreadData();
            onThreadUpdated();
          }}
          onCancel={() => setShowLinkPatientModal(false)}
        />
      )}
    </div>
  );
}
