"use client";

import { useState } from "react";

// Separate from "Raise your hand": raising a hand means the student is confused and wants a
// personalized reply, this means the student thinks the question ITSELF is wrong (bad answer
// key, unclear wording, a rationale that doesn't match). No reply is expected, it just lands
// on the instructor's content-QA queue pointed straight at this question.
export default function QuestionFlagButton({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (status === "sent") {
    return <p className="muted" style={{ marginTop: "0.5rem" }}>Thanks, flagged for review.</p>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-outline btn-small" style={{ marginTop: "0.5rem" }}>
        Flag this question
      </button>
    );
  }

  async function send() {
    setStatus("sending");
    const res = await fetch("/api/question-flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, reason }),
    });
    setStatus(res.ok ? "sent" : "error");
  }

  return (
    <div className="card" style={{ marginTop: "0.5rem" }}>
      <label style={{ display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
        What's wrong with this question?
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="e.g. the marked correct answer looks wrong, the rationale doesn't match, wording is confusing..."
        style={{ marginBottom: "0.5rem" }}
      />
      {status === "error" && <p className="error-text">Something went wrong. Try again.</p>}
      <div className="btn-row">
        <button onClick={send} disabled={status === "sending" || !reason.trim()} className="btn btn-primary btn-small">
          {status === "sending" ? "Sending..." : "Submit flag"}
        </button>
        <button onClick={() => setOpen(false)} className="btn btn-outline btn-small">
          Cancel
        </button>
      </div>
    </div>
  );
}
