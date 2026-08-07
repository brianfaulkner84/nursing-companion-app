"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetSubjectButton({ subject }: { subject: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function reset() {
    if (!confirm(`Clear your progress on ${subject}? Every question in this subject goes back to unanswered.`)) {
      return;
    }
    setBusy(true);
    await fetch("/api/reset-subject-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button onClick={reset} disabled={busy} className="btn btn-outline btn-small">
      {busy ? "Clearing..." : "Reset progress"}
    </button>
  );
}
