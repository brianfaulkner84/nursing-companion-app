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
    return <p>Sent. You&apos;ll hear back within a day or two.</p>;
  }

  return (
    <div>
      <h1>Raise your hand</h1>
      <p>Add anything that would help explain your confusion on this question.</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={6}
        style={{ width: "100%", padding: "0.6rem" }}
      />
      {status === "error" && <p style={{ color: "crimson" }}>Something went wrong. Try again.</p>}
      <button onClick={send} disabled={status === "sending"} style={{ width: "100%", padding: "0.75rem", marginTop: "0.5rem" }}>
        {status === "sending" ? "Sending..." : "Send"}
      </button>
    </div>
  );
}
