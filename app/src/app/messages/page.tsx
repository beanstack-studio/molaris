"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { formatDateStandard } from "@/lib/helpers";
import { MessageThread, Patient } from "@/lib/types";
import ChatWindow from "./ChatWindow";
import { Spinner } from "@/components/Spinner";

export default function MessagesPage() {
  const [threads, setThreads] = useState<(MessageThread & { patients: Patient })[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    loadThreads();
  }, []);

  const loadThreads = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("message_threads")
        .select("*, patients(id, full_name, phone, email)")
        .is("deleted_at", null)
        .order("last_message_at", { ascending: false });

      if (err) throw err;
      setThreads(data as any);
      if (data && data.length > 0 && !selectedThread) {
        setSelectedThread(data[0].id);
      }
    } catch (err) {
      console.error("Error loading threads:", err);
      setError("Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "sms":
        return "💬";
      case "messenger":
        return "👥";
      case "whatsapp":
        return "💚";
      case "email":
        return "📧";
      default:
        return "💬";
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar - Message Threads (Hidden on mobile, visible on md+) */}
      <div className={`${
        sidebarOpen ? 'fixed inset-0 z-40 md:static md:z-auto' : 'hidden md:block'
      } w-80 border-r border-slate-200 bg-white flex flex-col md:relative`}>
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Messages</h1>
            <p className="text-muted-sm">SMS & Messenger</p>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 hover:bg-slate-100 rounded"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 flex justify-center"><Spinner size="h-8 w-8" /></div>
          ) : error ? (
            <div className="p-4 text-red-600">{error}</div>
          ) : threads.length === 0 ? (
            <div className="p-4 text-slate-600">No message threads yet</div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => {
                  setSelectedThread(thread.id);
                  setSidebarOpen(false); // Close sidebar on mobile after selecting
                }}
                className={`w-full p-4 border-b border-slate-100 text-left hover:bg-slate-50 transition ${
                  selectedThread === thread.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{getChannelIcon(thread.channel)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {thread.patients?.full_name || "Unknown"}
                    </p>
                    <p className="text-muted-xs">
                      {thread.channel.toUpperCase()}
                      {thread.unread_count > 0 && ` • ${thread.unread_count} new`}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {thread.last_message_at
                        ? formatDateStandard(thread.last_message_at.split('T')[0])
                        : "No messages"}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Mobile menu button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden absolute top-4 left-4 z-50 p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          ☰ Threads
        </button>

        {selectedThread ? (
          <ChatWindow
            threadId={selectedThread}
            onThreadUpdated={loadThreads}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <p className="text-slate-600 font-medium">Select a conversation</p>
              <p className="text-slate-500 text-sm mt-2">
                Messages from SMS & Messenger will appear here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
