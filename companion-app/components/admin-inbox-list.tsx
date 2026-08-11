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
type Option = {
  id: string;
  label: string;
  text: string;
  correct: boolean;
  selected: boolean;
};
type Thread = {
  id: string;
  subject: string;
  questionText: string;
  options: Option[];
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

// The full multiple-choice picture next to a reply under review: every option, which one is
// actually correct, and which one the student picked -- not just the question stem and the
// draft. Green marks the correct answer, wine marks a wrong option the student picked, so a
// wrong-and-selected option (the usual case someone raises their hand over) stands out at a
// glance without reading every line.
function OptionsList({ options }: { options: Option[] }) {
  if (options.length === 0) return null;
  return (
    <ul style={{ margin: "0 0 0.6rem", paddingLeft: "1.1rem", fontSize: "0.85rem" }}>
      {options.map((o) => (
        <li
          key={o.id}
          style={{
            color: o.correct ? "var(--sage-600)" : o.selected ? "var(--wine-600)" : undefined,
            fontWeight: o.correct || o.selected ? 600 : 400,
          }}
        >
          {o.label}. {o.text}
          {o.correct && o.selected && " (correct — student's answer)"}
          {o.correct && !o.selected && " (correct answer)"}
          {!o.correct && o.selected && " (student's answer)"}
        </li>
      ))}
    </ul>
  );
}

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
  // Which open thread (if any) currently has its draft unlocked for editing. Read-only by
  // default: a thread only enters this set when Brian deliberately clicks "Edit reply," not
  // just by scrolling past or clicking into the card to read it. This exists because sending an
  // untouched draft versus an edited one isn't just cosmetic -- /api/raised-hands/[id]/respond
  // compares the sent text to claude_draft_reply character-for-character to decide whether that
  // review counts as "clean" or "corrected" for the subject's trust ladder. A stray space typed
  // while reading would silently record a correction that never happened.
  const [editingId, setEditingId] = useState<string | null>(null);
  // Free-form instruction text per thread ("make this shorter," "explain why C is wrong") for
  // the AI-assist rewrite, and which thread (if any) currently has a rewrite in flight.
  const [aiInstructions, setAiInstructions] = useState<Record<string, string>>({});
  const [aiAssistingId, setAiAssistingId] = useState<string | null>(null);

  async function reviseWithAi(id: string) {
    const instruction = aiInstructions[id];
    if (!instruction?.trim()) return;
    setAiAssistingId(id);
    const res = await fetch(`/api/raised-hands/${id}/ai-assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction, currentDraft: drafts[id] }),
    });
    if (res.ok) {
      const data = await res.json();
      setDrafts((prev) => ({ ...prev, [id]: data.reply }));
      setAiInstructions((prev) => ({ ...prev, [id]: "" }));
    }
    setAiAssistingId(null);
  }

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

  async function send(id: string, replyText: string) {
    setSendingId(id);
    setErrorId(null);
    const res = await fetch(`/api/raised-hands/${id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: replyText }),
    });
    setSendingId(null);
    if (res.ok) {
      router.refresh();
    } else {
      setErrorId(id);
    }
  }

  function startEdit(id: string) {
    setEditingId(id);
  }

  // Discards whatever was typed and snaps the textarea back to Claude's original draft, so
  // backing out of an edit can't leave a half-changed draft sitting around unsent.
  function cancelEdit(id: string, originalDraft: string) {
    setDrafts((prev) => ({ ...prev, [id]: originalDraft }));
    setEditingId(null);
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
            const hasDraft = !alreadyReplied && !!t.claudeDraftReply;
            const isEditing = editingId === t.id;
            return (
              <div
                key={t.id}
                id={`thread-${t.id}`}
                className="card"
                style={t.id === highlightId ? { outline: "3px solid var(--gold-100)", outlineOffset: "2px" } : undefined}
              >
                <p className="tile-title" style={{ marginBottom: "0.3rem" }}>{t.subject}</p>
                <p className="tile-meta" style={{ marginBottom: "0.4rem" }}>{t.questionText}</p>
                <OptionsList options={t.options} />

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

                {hasDraft && !isEditing ? (
                  <>
                    <label style={{ display: "block", margin: "0.5rem 0 0.3rem", fontWeight: 600 }}>
                      Claude&apos;s draft (read-only until you choose Edit)
                    </label>
                    <div
                      className="card-dark"
                      style={{ padding: "0.6rem 0.75rem", marginBottom: "0.5rem", whiteSpace: "pre-wrap" }}
                    >
                      {t.claudeDraftReply}
                    </div>
                    {errorId === t.id && <p className="error-text">Something went wrong. Try again.</p>}
                    <div className="btn-row">
                      <button
                        onClick={() => send(t.id, (t.claudeDraftReply ?? "").trim())}
                        disabled={sendingId === t.id}
                        className="btn btn-primary"
                      >
                        {sendingId === t.id ? "Sending..." : "Approve & send as-is"}
                      </button>
                      <button onClick={() => startEdit(t.id)} className="btn btn-outline btn-small">
                        Edit reply
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <label style={{ display: "block", margin: "0.5rem 0 0.3rem", fontWeight: 600 }}>
                      Reply{hasDraft ? " (editing Claude's draft)" : ""}
                    </label>
                    <textarea
                      value={drafts[t.id] ?? ""}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      rows={4}
                      style={{ marginBottom: "0.5rem" }}
                    />

                    <label style={{ display: "block", marginBottom: "0.3rem", fontWeight: 600, fontSize: "0.85rem" }}>
                      AI assist: tell Claude how to revise this reply
                    </label>
                    <div className="btn-row" style={{ marginBottom: "0.5rem", alignItems: "flex-start" }}>
                      <input
                        type="text"
                        value={aiInstructions[t.id] ?? ""}
                        onChange={(e) => setAiInstructions((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder='e.g. "make this shorter" or "explain why option C is wrong"'
                        style={{ flex: 1 }}
                      />
                      <button
                        onClick={() => reviseWithAi(t.id)}
                        disabled={aiAssistingId === t.id || !aiInstructions[t.id]?.trim()}
                        className="btn btn-outline btn-small"
                      >
                        {aiAssistingId === t.id ? "Revising..." : "Revise with AI"}
                      </button>
                    </div>

                    {errorId === t.id && <p className="error-text">Something went wrong. Try again.</p>}
                    <div className="btn-row">
                      <button
                        onClick={() => send(t.id, (drafts[t.id] ?? "").trim())}
                        disabled={sendingId === t.id || !drafts[t.id]?.trim()}
                        className="btn btn-primary"
                      >
                        {sendingId === t.id ? "Sending..." : hasDraft ? "Send edited reply" : "Send reply"}
                      </button>
                      {hasDraft && (
                        <button
                          onClick={() => cancelEdit(t.id, t.claudeDraftReply ?? "")}
                          className="btn btn-outline btn-small"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </>
                )}
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
              <OptionsList options={t.options} />
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
              <p className="tile-title" style={{ marginBottom: "0.3rem" }}>{t.subject}</p>
              {t.options.length > 0 && (
                <details style={{ marginBottom: "0.5rem" }}>
                  <summary style={{ cursor: "pointer", fontSize: "0.8rem", color: "var(--sage-600)" }}>
                    Answer options
                  </summary>
                  <OptionsList options={t.options} />
                </details>
              )}
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
