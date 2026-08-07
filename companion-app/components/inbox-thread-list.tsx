"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Message = { id: string; sender: "student" | "instructor"; body: string; created_at: string };
type Thread = {
  id: string;
  subject: string;
  status: "open" | "resolved";
  createdAt: string;
  messages: Message[];
};

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function InboxThreadList({ threads }: { threads: Thread[] }) {
  if (threads.length === 0) return null;
  return (
    <div className="tile-stack">
      {threads.map((t) => (
        <ThreadCard key={t.id} thread={t} />
      ))}
    </div>
  );
}

function ThreadCard({ thread }: { thread: Thread }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sentNotice, setSentNotice] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true);
    const res = await fetch(`/api/raised-hands/${thread.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply }),
    });
    setSending(false);
    if (res.ok) {
      setReply("");
      setSentNotice(true);
      router.refresh();
    }
  }

  async function deleteMessage(id: string) {
    setDeletingId(id);
    await fetch(`/api/raised-hand-messages/${id}`, { method: "DELETE" });
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.4rem" }}>
        <span className="tile-title">{thread.subject}</span>
        <span className={`status-badge ${thread.status === "resolved" ? "status-badge-answered" : "status-badge-open"}`}>
          {thread.status === "resolved" ? "Answered" : "Waiting for a reply"}
        </span>
      </div>
      <p className="tile-meta" style={{ marginBottom: "0.6rem" }}>Raised {timeAgo(thread.createdAt)}</p>

      {thread.messages.map((m) => (
        <div key={m.id} className={`message-bubble ${m.sender === "instructor" ? "card-dark" : "card"}`}>
          <div className="message-sender">
            <span style={{ color: m.sender === "instructor" ? "var(--gold-100)" : "var(--sage-600)" }}>
              {m.sender === "instructor" ? "Instructor" : "You"} · {timeAgo(m.created_at)}
            </span>
            {m.sender === "student" && (
              <button
                onClick={() => deleteMessage(m.id)}
                disabled={deletingId === m.id}
                className="msg-delete"
              >
                {deletingId === m.id ? "..." : "Delete"}
              </button>
            )}
          </div>
          <p>{m.body}</p>
        </div>
      ))}

      {sentNotice && (
        <p className="muted" style={{ margin: "0.5rem 0" }}>Sent. You&apos;ll hear back in 1 to 2 days.</p>
      )}

      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={3}
        placeholder="Continue the conversation..."
        style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}
      />
      <button onClick={sendReply} disabled={sending || !reply.trim()} className="btn btn-outline btn-small">
        {sending ? "Sending..." : "Send"}
      </button>
    </div>
  );
}
