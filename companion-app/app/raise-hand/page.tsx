"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function RaiseHand() {
  return (
    <Suspense fallback={null}>
      <RaiseHandForm />
    </Suspense>
  );
}

function RaiseHandForm() {
  const searchParams = useSearchParams();
  const questionId = searchParams.get("question");
  const selected = searchParams.get("selected");
  // Where to send the student once they're done here. Both callers (the quiz answer breakdown
  // and the review-session answer breakdown) pass their own "next question" href and their own
  // URL back to this exact answer breakdown, since raise-hand itself has no idea which flow
  // launched it or what subject/session it belongs to. Falls back to /dashboard so a stray link
  // missing these params still lands the student somewhere navigable instead of a dead end.
  const nextHref = searchParams.get("next") || "/dashboard";
  const answerHref = searchParams.get("answer");
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
      <h1>Raise your hand</h1>
      <p className="muted">
        This sends the question, your answer, and your note to an instructor for review. Add
        anything that would help explain your confusion, then check your Inbox in a day or two
        for a reply, nothing gets emailed.
      </p>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} style={{ marginBottom: "0.5rem" }} />
      {status === "error" && <p className="error-text">Something went wrong. Try again.</p>}
      <button onClick={send} disabled={status === "sending"} className="btn btn-primary">
        {status === "sending" ? "Sending..." : "Send"}
      </button>
    </div>
  );
}
