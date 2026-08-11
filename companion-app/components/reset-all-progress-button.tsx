"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Clears every subject at once -- the nuclear option, one level up from the per-subject
// ResetSubjectButton next to each progress bar. Deliberately not a single click behind a
// native confirm(): confirm() is easy to reflex-dismiss without reading it. This opens an
// inline panel that states exactly what's about to be cleared and requires a second, separate
// click on a clearly-labeled button, the same "make the destructive step its own deliberate
// action" pattern used for editing an AI draft reply in the admin inbox.
export default function ResetAllProgressButton({ totalAnswered }: { totalAnswered: number }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function resetAll() {
    setBusy(true);
    await fetch("/api/reset-all-progress", { method: "POST" });
    setBusy(false);
    setConfirming(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="btn btn-danger btn-small">
        Reset all progress
      </button>
    );
  }

  return (
    <div className="card" style={{ borderColor: "var(--wine-600)", marginBottom: "1rem" }}>
      <p style={{ fontWeight: 600, marginBottom: "0.3rem" }}>Reset every subject?</p>
      <p className="muted" style={{ marginBottom: "0.75rem" }}>
        This clears all {totalAnswered} question{totalAnswered === 1 ? "" : "s"} you've answered, across every
        subject. Every question goes back to unanswered. This cannot be undone.
      </p>
      <div className="btn-row">
        <button onClick={resetAll} disabled={busy} className="btn btn-danger btn-small">
          {busy ? "Resetting..." : "Yes, reset everything"}
        </button>
        <button onClick={() => setConfirming(false)} disabled={busy} className="btn btn-outline btn-small">
          Cancel
        </button>
      </div>
    </div>
  );
}
