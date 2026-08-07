"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Feedback = { id: string; category: string; body: string; created_at: string; sender_role?: string };
type Flag = {
  id: string;
  reason: string;
  created_at: string;
  sender_role?: string;
  questions: { subject: string; title: string; question_text: string } | null;
};

function FromInstructorBadge({ senderRole }: { senderRole?: string }) {
  if (senderRole !== "instructor") return null;
  return (
    <span className="status-badge status-badge-answered" style={{ marginLeft: "0.4rem" }}>
      From instructor
    </span>
  );
}

const categoryLabels: Record<string, string> = {
  general: "General",
  bug: "Bug",
  suggestion: "Suggestion",
};

export default function AdminFeedbackList({
  newFeedback,
  reviewedFeedback,
  openFlags,
  resolvedFlags,
}: {
  newFeedback: Feedback[];
  reviewedFeedback: Feedback[];
  openFlags: Flag[];
  resolvedFlags: Flag[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function resolve(kind: "feedback" | "question-flags", id: string) {
    setBusyId(id);
    await fetch(`/api/${kind}/${id}/resolve`, { method: "POST" });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div>
      <h3 style={{ marginBottom: "0.75rem" }}>General feedback: new ({newFeedback.length})</h3>
      {newFeedback.length === 0 ? (
        <p className="muted" style={{ marginBottom: "1.75rem" }}>Nothing new.</p>
      ) : (
        <div className="tile-stack" style={{ marginBottom: "1.75rem" }}>
          {newFeedback.map((f) => (
            <div key={f.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <span>
                  <span className="status-badge status-badge-open">{categoryLabels[f.category] ?? f.category}</span>
                  <FromInstructorBadge senderRole={f.sender_role} />
                </span>
                <span className="tile-meta">{new Date(f.created_at).toLocaleDateString()}</span>
              </div>
              <p style={{ marginBottom: "0.6rem", whiteSpace: "pre-wrap" }}>{f.body}</p>
              <button
                onClick={() => resolve("feedback", f.id)}
                disabled={busyId === f.id}
                className="btn btn-outline btn-small"
              >
                {busyId === f.id ? "..." : "Mark reviewed"}
              </button>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ marginBottom: "0.75rem" }}>Question flags: open ({openFlags.length})</h3>
      {openFlags.length === 0 ? (
        <p className="muted" style={{ marginBottom: "1.75rem" }}>Nothing flagged right now.</p>
      ) : (
        <div className="tile-stack" style={{ marginBottom: "1.75rem" }}>
          {openFlags.map((f) => (
            <div key={f.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                <span className="tile-title">
                  {f.questions?.title ?? "Question no longer exists"}
                  <FromInstructorBadge senderRole={f.sender_role} />
                </span>
                <span className="tile-meta">{new Date(f.created_at).toLocaleDateString()}</span>
              </div>
              {f.questions && (
                <>
                  <p className="tile-meta" style={{ marginBottom: "0.3rem" }}>{f.questions.subject}</p>
                  <p className="muted" style={{ marginBottom: "0.5rem" }}>{f.questions.question_text}</p>
                </>
              )}
              <p style={{ marginBottom: "0.6rem", whiteSpace: "pre-wrap" }}>
                <strong>Flagged reason:</strong> {f.reason}
              </p>
              <button
                onClick={() => resolve("question-flags", f.id)}
                disabled={busyId === f.id}
                className="btn btn-outline btn-small"
              >
                {busyId === f.id ? "..." : "Mark resolved"}
              </button>
            </div>
          ))}
        </div>
      )}

      <details>
        <summary>Reviewed feedback ({reviewedFeedback.length}) and resolved flags ({resolvedFlags.length})</summary>
        <div className="tile-stack" style={{ marginTop: "0.75rem" }}>
          {reviewedFeedback.map((f) => (
            <div key={f.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <span>
                  <span className="status-badge status-badge-answered">{categoryLabels[f.category] ?? f.category}</span>
                  <FromInstructorBadge senderRole={f.sender_role} />
                </span>
                <span className="tile-meta">{new Date(f.created_at).toLocaleDateString()}</span>
              </div>
              <p style={{ whiteSpace: "pre-wrap" }}>{f.body}</p>
            </div>
          ))}
          {resolvedFlags.map((f) => (
            <div key={f.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                <span className="tile-title">
                  {f.questions?.title ?? "Question no longer exists"}
                  <FromInstructorBadge senderRole={f.sender_role} />
                </span>
                <span className="tile-meta">{new Date(f.created_at).toLocaleDateString()}</span>
              </div>
              <p style={{ whiteSpace: "pre-wrap" }}><strong>Flagged reason:</strong> {f.reason}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
