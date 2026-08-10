"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  sender: "student" | "instructor";
  body: string;
  created_at: string;
  instructorName?: string | null;
};
type Thread = {
  id: string;
  subject: string;
  questionText: string;
  claudeDraftReply?: string | null;
  // Tiered AI reply review (MNGT 745 Week 6 capstone): only set on threads whose reply came
  // through the audited raise-hand pipeline. auditId is what the review action targets.
  auditId?: string | null;
  tier?: "hold" | "high" | "low" | null;
  grounded?: boolean | null;
  confidenceScore?: number | null;
  confidenceReason?: string | null;
  messages: Message[];
};

export default function AdminInboxList({
  openThreads,
  needsReviewThreads = [],
  resolvedThreads,
  showInstructorNames = false,
  highlightId = null,
}: {
  openThreads: Thread[];
  needsReviewThreads?: Thread[];
  resolvedThreads: Thread[];
  showInstructorNames?: boolean;
  highlightId?: string | null;
}) {
  const router = useRouter();

  // Deep link from the 24-hour escalation email lands here as ?thread=<id>. Scroll straight to
  // it and outline it, whether it's still open or someone already answered it by the time Brian
  // clicks through, so the email is genuinely "one tap to the exact spot," not "one tap to a
  // list you then have to search."
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`thread-${highlightId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId]);
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
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  async function markClean(auditId: string) {
    setReviewingId(auditId);
    await fetch(`/api/reply-audits/${auditId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: "clean" }),
    });
    setReviewingId(null);
    router.refresh();
  }

  async function submitCorrection(auditId: string) {
    const text = corrections[auditId];
    if (!text?.trim()) return;
    setReviewingId(auditId);
    await fetch(`/api/reply-audits/${auditId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: "corrected", correctionText: text }),
    });
    setReviewingId(null);
    setCorrectingId(null);
    router.refresh();
  }

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
              <div
                key={t.id}
                id={`thread-${t.id}`}
                className="card"
                style={t.id === highlightId ? { outline: "3px solid var(--gold-100)", outlineOffset: "2px" } : undefined}
              >
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

      <h3 style={{ marginBottom: "0.75rem" }}>Sent, needs review ({needsReviewThreads.length})</h3>
      {needsReviewThreads.length === 0 ? (
        <p className="muted" style={{ marginBottom: "1.75rem" }}>Nothing auto-sent waiting on a review right now.</p>
      ) : (
        <div className="tile-stack" style={{ marginBottom: "1.75rem" }}>
          {needsReviewThreads.map((t) => (
            <div
              key={t.id}
              id={`thread-${t.id}`}
              className="card"
              style={t.id === highlightId ? { outline: "3px solid var(--gold-100)", outlineOffset: "2px" } : undefined}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                <p className="tile-title" style={{ marginBottom: "0.3rem" }}>{t.subject}</p>
                <span className="status-badge status-badge-open">
                  {t.tier === "high" ? "High priority" : "Low priority"}
                </span>
              </div>
              <p className="tile-meta" style={{ marginBottom: "0.4rem" }}>{t.questionText}</p>
              <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.6rem" }}>
                Confidence {t.confidenceScore}/5 &middot; {t.confidenceReason}
              </p>

              {t.messages.map((m) => (
                <div key={m.id} className={`message-bubble ${m.sender === "instructor" ? "card-dark" : "card"}`}>
                  <div className="message-sender">
                    <span style={{ color: m.sender === "instructor" ? "var(--gold-100)" : "var(--sage-600)" }}>
                      {m.sender === "instructor" ? "AI (auto-sent)" : "Student"}
                    </span>
                  </div>
                  <p>{m.body}</p>
                </div>
              ))}

              {correctingId === t.id ? (
                <>
                  <textarea
                    value={corrections[t.auditId ?? ""] ?? ""}
                    onChange={(e) => setCorrections((prev) => ({ ...prev, [t.auditId ?? ""]: e.target.value }))}
                    rows={3}
                    placeholder="What should the student actually be told? This gets sent to them."
                    style={{ margin: "0.5rem 0" }}
                  />
                  <div className="btn-row">
                    <button
                      onClick={() => t.auditId && submitCorrection(t.auditId)}
                      disabled={reviewingId === t.auditId || !corrections[t.auditId ?? ""]?.trim()}
                      className="btn btn-primary"
                    >
                      {reviewingId === t.auditId ? "Sending..." : "Send correction"}
                    </button>
                    <button onClick={() => setCorrectingId(null)} className="btn btn-outline btn-small">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="btn-row" style={{ marginTop: "0.5rem" }}>
                  <button
                    onClick={() => t.auditId && markClean(t.auditId)}
                    disabled={reviewingId === t.auditId}
                    className="btn btn-outline btn-small"
                  >
                    {reviewingId === t.auditId ? "..." : "Mark clean"}
                  </button>
                  <button onClick={() => setCorrectingId(t.id)} className="btn btn-outline btn-small">
                    Correct
                  </button>
                </div>
              )}
            </div>
          ))}
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
            <div
              key={t.id}
              id={`thread-${t.id}`}
              className="card"
              style={t.id === highlightId ? { outline: "3px solid var(--gold-100)", outlineOffset: "2px" } : undefined}
            >
              <p className="tile-title" style={{ marginBottom: "0.5rem" }}>{t.subject}</p>
              {t.messages.map((m) => (
                <div key={m.id} className={`message-bubble ${m.sender === "instructor" ? "card-dark" : "card"}`}>
                  <div className="message-sender">
                    <span style={{ color: m.sender === "instructor" ? "var(--gold-100)" : "var(--sage-600)" }}>
                      {m.sender === "instructor"
                        ? showInstructorNames
                          ? m.instructorName ?? "Instructor"
                          : "You"
                        : "Student"}
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
