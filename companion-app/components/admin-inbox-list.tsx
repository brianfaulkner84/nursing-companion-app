"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Message = { id: string; sender: "student" | "instructor"; body: string; created_at: string };
type Thread = {
  id: string;
  subject: string;
  questionText: string;
  claudeDraftReply?: string | null;
  messages: Message[];
};

export default function AdminInboxList({
  openThreads,
  resolvedThreads,
}: {
  openThreads: Thread[];
  resolvedThreads: Thread[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(
      openThreads.map((t) => {
        const alreadyReplied = t.messages.some((m) => m.sender === "instructor");
        return [t.id, alreadyReplied ? "" : t.claudeDraftReply ?? ""];
      })
    )
  );
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  async function send(id: string) {
    setSendingId(id);
    setErrorId(null);
    const res = await fetch(`/api/raised-hands/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: drafts[id] }),
    });
    setSendingId(null);
    if (res.ok) {
      router.refresh();
    } else {
      setErrorId(id);
    }
  }

  async function clearReplied() {
    setClearing(true);
    await fetch("/api/raised-hands/clear-replied", { method: "POST" });
    setClearing(false);
    router.refresh();
  }

  return (
    <div>
      <h3 style={{ marginBottom: "0.75rem" }}>Waiting on you ({openThreads.length})</h3>
      {openThreads.length === 0 ? (
        <p className="muted" style={{ marginBottom: "1.75rem" }}>Nothing waiting on you right now.</p>
      ) : (
        <div className="tile-stack" style={{ marginBottom: "1.75rem" }}>
          {openThreads.map((t) => {
            const alreadyReplied = t.messages.some((m) => m.sender === "instructor");
            return (
              <div key={t.id} className="card">
                <p className="tile-title" style={{ marginBottom: "0.3rem" }}>{t.subject}</p>
                <p className="tile-meta" style={{ marginBottom: "0.6rem" }}>{t.questionText}</p>

                {t.messages.map((m) => (
                  <div key={m.id} className={`message-bubble ${m.sender === "instructor" ? "card-dark" : "card"}`}>
                    <div className="message-sender">
                      <span style={{ color: m.sender === "instructor" ? "var(--gold-100)" : "var(--sage-600)" }}>
                        {m.sender === "instructor" ? "You" : "Student"}
                      </span>
                    </div>
                    <p>{m.body}</p>
                  </div>
                ))}

                <label style={{ display: "block", margin: "0.5rem 0 0.3rem", fontWeight: 600 }}>
                  Reply{!alreadyReplied && t.claudeDraftReply ? " (Claude's draft, edit before sending)" : ""}
                </label>
                <textarea
                  value={drafts[t.id] ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  rows={4}
                  style={{ marginBottom: "0.5rem" }}
                />
                {errorId === t.id && <p className="error-text">Something went wrong. Try again.</p>}
                <button
                  onClick={() => send(t.id)}
                  disabled={sendingId === t.id || !drafts[t.id]?.trim()}
                  className="btn btn-primary"
                >
                  {sendingId === t.id ? "Sending..." : "Send reply"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h3 style={{ margin: 0 }}>Answered ({resolvedThreads.length})</h3>
        {resolvedThreads.length > 0 && (
          <button
            onClick={clearReplied}
            disabled={clearing}
            className="btn btn-outline btn-small"
          >
            {clearing ? "Clearing..." : "Clear replied"}
          </button>
        )}
      </div>
      {resolvedThreads.length === 0 ? (
        <p className="muted">Nothing to clear.</p>
      ) : (
        <div className="tile-stack">
          {resolvedThreads.map((t) => (
            <div key={t.id} className="card">
              <p className="tile-title" style={{ marginBottom: "0.5rem" }}>{t.subject}</p>
              {t.messages.map((m) => (
                <div key={m.id} className={`message-bubble ${m.sender === "instructor" ? "card-dark" : "card"}`}>
                  <div className="message-sender">
                    <span style={{ color: m.sender === "instructor" ? "var(--gold-100)" : "var(--sage-600)" }}>
                      {m.sender === "instructor" ? "You" : "Student"}
                    </span>
                  </div>
                  <p>{m.body}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
