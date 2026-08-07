"use client";

import { Suspense, useState } from "react";
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
      <div className="banner banner-correct" style={{ textTransform: "none", fontWeight: 500 }}>
        Sent. You&apos;ll hear back within a day or two.
      </div>
    );
  }

  return (
    <div>
      <h1>Raise your hand</h1>
      <p className="muted">Add anything that would help explain your confusion on this question.</p>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} style={{ marginBottom: "0.5rem" }} />
      {status === "error" && <p className="error-text">Something went wrong. Try again.</p>}
      <button onClick={send} disabled={status === "sending"} className="btn btn-primary">
        {status === "sending" ? "Sending..." : "Send"}
      </button>
    </div>
  );
}
