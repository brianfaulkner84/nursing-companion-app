"use client";

import { useState } from "react";
import Link from "next/link";

export default function Feedback() {
  const [category, setCategory] = useState<"general" | "bug" | "suggestion">("general");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send() {
    setStatus("sending");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, body }),
    });
    setStatus(res.ok ? "sent" : "error");
  }

  if (status === "sent") {
    return (
      <div>
        <div className="banner banner-correct" style={{ textTransform: "none", fontWeight: 500 }}>
          Thanks, that's been sent to the instructor.
        </div>
        <button
          onClick={() => { setBody(""); setCategory("general"); setStatus("idle"); }}
          className="btn btn-outline"
          style={{ marginTop: "1rem" }}
        >
          Send more feedback
        </button>
        <p style={{ marginTop: "1rem" }}>
          <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>Feedback</h1>
      <p className="muted">
        Tell us what's working, what's not, or what's confusing about the app itself. No email
        is collected. If something's wrong with a specific question's content, use "Flag this
        question" on the answer breakdown screen instead, it points the reviewer right at the
        question.
      </p>

      <label style={{ display: "block", margin: "0.75rem 0 0.3rem", fontWeight: 600 }}>
        What kind of feedback is this?
      </label>
      <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} style={{ marginBottom: "0.75rem" }}>
        <option value="general">General feedback</option>
        <option value="bug">Something's broken</option>
        <option value="suggestion">Suggestion / idea</option>
      </select>

      <label style={{ display: "block", margin: "0.5rem 0 0.3rem", fontWeight: 600 }}>
        Details
      </label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        placeholder="What happened, or what would make this better?"
        style={{ marginBottom: "0.5rem" }}
      />
      {status === "error" && <p className="error-text">Something went wrong. Try again.</p>}
      <button onClick={send} disabled={status === "sending" || !body.trim()} className="btn btn-primary">
        {status === "sending" ? "Sending..." : "Send feedback"}
      </button>
    </div>
  );
}
