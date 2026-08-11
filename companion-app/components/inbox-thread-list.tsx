"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  sender: "student" | "instructor";
  sender_id: string | null;
  body: string;
  created_at: string;
  // "Instructor" if this came from someone at the student's own school, "LPN Launchpad
  // Instructor" otherwise (AI auto-sent, the hold acknowledgment, or an admin/instructor
  // answering outside their own school). Computed server-side in app/inbox/page.tsx, since
  // profiles RLS won't let a student look up another user's school directly. Null for student
  // messages, where it's unused.
  instructorLabel: string | null;
  // The canned "an instructor will follow up" note sent instantly when a thread lands on hold --
  // not a real AI clinical answer, so it skips the AI disclosure/reaction block below.
  isAcknowledgment?: boolean;
  // The "are you actually seeing these replies" check-in the app sends itself -- also not a real
  // answer, also skips the reaction block, for the same reason.
  isCheckin?: boolean;
  // Student's thumbs up/down on this message, if any.
  reaction?: "up" | "down" | null;
};
type Thread = {
  id: string;
  subject: string;
  status: "open" | "resolved";
  createdAt: string;
  archived: boolean;
  escalatedAt: string | null;
  messages: Message[];
};

// An instructor-voiced message with no sender_id is the one this thread's AI reply auto-sent
// (see /api/raise-hand -- sender_id stays null specifically to distinguish this from a message
// a real instructor personally sent and typed sender_id on). Every other instructor message was
// a human sending it.
function isAiAutoSent(m: Message) {
  return m.sender === "instructor" && !m.sender_id;
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function InboxThreadList({ threads }: { threads: Thread[] }) {
  const [showArchived, setShowArchived] = useState(false);

  if (threads.length === 0) return null;

  const active = threads.filter((t) => !t.archived);
  const archived = threads.filter((t) => t.archived);

  return (
    <div>
      {active.length === 0 && (
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Nothing active. {archived.length > 0 ? "Everything's archived." : ""}
        </p>
      )}
      <div className="tile-stack">
        {active.map((t) => (
          <ThreadCard key={t.id} thread={t} />
        ))}
      </div>

      {archived.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="btn btn-outline btn-small"
          >
            {showArchived ? "Hide archived" : `View archived (${archived.length})`}
          </button>
          {showArchived && (
            <div className="tile-stack" style={{ marginTop: "0.75rem" }}>
              {archived.map((t) => (
                <ThreadCard key={t.id} thread={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThreadCard({ thread }: { thread: Thread }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sentNotice, setSentNotice] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  // Optimistic per-message reaction state, seeded from what the server sent down. A message not
  // in here yet just falls back to its own m.reaction below.
  const [reactions, setReactions] = useState<Record<string, "up" | "down" | null>>({});
  const [reactingId, setReactingId] = useState<string | null>(null);

  async function react(messageId: string, value: "up" | "down") {
    const current = reactions[messageId] ?? thread.messages.find((m) => m.id === messageId)?.reaction ?? null;
    const next = current === value ? null : value; // clicking the same thumb again clears it
    setReactingId(messageId);
    setReactions((prev) => ({ ...prev, [messageId]: next }));
    await fetch(`/api/raised-hand-messages/${messageId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reaction: next }),
    });
    setReactingId(null);
    if (next === "down") router.refresh(); // escalation notice below depends on thread.escalatedAt
  }

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

  async function toggleArchive() {
    setArchiving(true);
    await fetch(`/api/raised-hands/${thread.id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !thread.archived }),
    });
    setArchiving(false);
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
              {m.sender === "instructor" ? m.instructorLabel ?? "Instructor" : "You"} · {timeAgo(m.created_at)}
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

          {m.sender === "instructor" && !m.isAcknowledgment && !m.isCheckin && (
            <div style={{ marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid rgba(255,255,255,0.15)" }}>
              {isAiAutoSent(m) && (
                <p className="muted" style={{ fontSize: "0.85rem", fontStyle: "italic", marginBottom: "0.4rem" }}>
                  This reply was generated by AI, reviewed against the course material for this
                  question. A nurse instructor checks these regularly; if anything needs
                  correcting you&apos;ll see an update within 48 to 72 hours.
                </p>
              )}
              {(() => {
                const current = reactions[m.id] ?? m.reaction ?? null;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <button
                      onClick={() => react(m.id, "up")}
                      disabled={reactingId === m.id}
                      className="btn btn-outline btn-small"
                      aria-label="Helpful"
                      style={current === "up" ? { borderColor: "var(--sage-600)", color: "var(--sage-600)" } : undefined}
                    >
                      👍
                    </button>
                    <button
                      onClick={() => react(m.id, "down")}
                      disabled={reactingId === m.id}
                      className="btn btn-outline btn-small"
                      aria-label="Not helpful"
                      style={current === "down" ? { borderColor: "var(--wine-600)", color: "var(--wine-600)" } : undefined}
                    >
                      👎
                    </button>
                    {current === "down" && (
                      <span className="muted" style={{ fontSize: "0.8rem" }}>An instructor has been notified.</span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
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
      <div className="btn-row">
        <button onClick={sendReply} disabled={sending || !reply.trim()} className="btn btn-outline btn-small">
          {sending ? "Sending..." : "Send"}
        </button>
        <button onClick={toggleArchive} disabled={archiving} className="btn btn-outline btn-small">
          {archiving ? "..." : thread.archived ? "Move to active" : "Archive"}
        </button>
      </div>
    </div>
  );
}
