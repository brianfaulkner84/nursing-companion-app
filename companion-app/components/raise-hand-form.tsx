"use client";

import { useState } from "react";
import Link from "next/link";

// Just the interactive part of the raise-hand screen (the note box, send, and the sent
// confirmation) -- the question breakdown above it is server-rendered in app/raise-hand/page.tsx
// so the student doesn't have to remember what they just read on the previous screen while
// typing their note.
export default function RaiseHandForm({
  questionId,
  selected,
  nextHref,
  answerHref,
}: {
  questionId: string;
  selected: string;
  nextHref: string;
  answerHref: string | null;
}) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send() {
    setStatus("sending");
    const res = await fetch("/api/raise-hand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, selected, note }),
    });
    setStatus(res.ok ? "sent" : "error");
  }

  if (status === "sent") {
    return (
      <div>
        <div className="banner banner-correct" style={{ textTransform: "none", fontWeight: 500 }}>
          Sent. An instructor will reply in your Inbox, usually within a day or two.
        </div>
        <div className="btn-row" style={{ marginTop: "1rem" }}>
          {answerHref && (
            <Link href={answerHref} className="btn btn-outline">
              Back to this question
            </Link>
          )}
          <Link href={nextHref} className="btn btn-primary">
            Next question
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label style={{ display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
        What&apos;s tripping you up?
      </label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} style={{ marginBottom: "0.5rem" }} />
      {status === "error" && <p className="error-text">Something went wrong. Try again.</p>}
      <button onClick={send} disabled={status === "sending"} className="btn btn-primary">
        {status === "sending" ? "Sending..." : "Send"}
      </button>
    </div>
  );
}
