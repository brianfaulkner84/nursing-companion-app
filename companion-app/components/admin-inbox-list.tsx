"use client";

import { useState } from "react";

type Hand = {
  id: string;
  student_note: string | null;
  claude_draft_reply: string | null;
  created_at: string;
  subject: string;
  question_text: string;
};

export default function AdminInboxList({ initialHands }: { initialHands: Hand[] }) {
  const [hands, setHands] = useState(initialHands);
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialHands.map((h) => [h.id, h.claude_draft_reply ?? ""]))
  );
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

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
      setHands((prev) => prev.filter((h) => h.id !== id));
    } else {
      setErrorId(id);
    }
  }

  if (hands.length === 0) {
    return <p className="muted">Nothing waiting on you. New raised hands will show up here.</p>;
  }

  return (
    <div className="tile-stack">
      {hands.map((h) => (
        <div key={h.id} className="card">
          <p className="tile-title" style={{ marginBottom: "0.3rem" }}>{h.subject}</p>
          <p className="tile-meta" style={{ marginBottom: "0.5rem" }}>{h.question_text}</p>
          {h.student_note && (
            <p style={{ marginBottom: "0.6rem" }}>
              <strong>Student&apos;s note:</strong> {h.student_note}
            </p>
          )}
          <label style={{ display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
            Reply (Claude&apos;s draft, edit before sending)
          </label>
          <textarea
            value={drafts[h.id] ?? ""}
            onChange={(e) => setDrafts((prev) => ({ ...prev, [h.id]: e.target.value }))}
            rows={5}
            style={{ marginBottom: "0.5rem" }}
          />
          {errorId === h.id && <p className="error-text">Something went wrong. Try again.</p>}
          <button
            onClick={() => send(h.id)}
            disabled={sendingId === h.id || !drafts[h.id]?.trim()}
            className="btn btn-primary"
          >
            {sendingId === h.id ? "Sending..." : "Send reply"}
          </button>
        </div>
      ))}
    </div>
  );
}
