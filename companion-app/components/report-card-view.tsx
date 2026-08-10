"use client";

import { MIN_SAMPLE_SIZE, type ReportCard } from "@/lib/report-card";

export default function ReportCardView({
  report,
  studentName,
}: {
  report: ReportCard;
  studentName: string | null;
}) {
  const generated = new Date(report.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hasEnoughForLists = report.focusAreas.length > 0 || report.strengths.length > 0;

  return (
    <div className="report-card">
      <h1>Report card</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        {studentName ? `${studentName} · ` : ""}Generated {generated}
      </p>

      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <p className="tile-title" style={{ marginBottom: "0.5rem" }}>Overall</p>
        <p style={{ marginBottom: "0.3rem" }}>
          {report.overall.answered.toLocaleString()} of {report.overall.total.toLocaleString()} questions answered
          ({report.overall.percentComplete}% of the bank)
        </p>
        <p className="muted">
          {report.overall.answered > 0
            ? `${report.overall.accuracy}% accuracy across everything answered so far.`
            : "No questions answered yet -- practice a few to start building this report."}
        </p>
      </div>

      <h3 style={{ marginBottom: "0.75rem" }}>By NCLEX category</h3>
      <div className="tile-stack" style={{ marginBottom: "1.5rem" }}>
        {report.byCategory.map((c) => (
          <div key={c.category} className="tile">
            <div className="tile-title">{c.category}</div>
            <div className="tile-meta">
              {c.answered} of {c.total} answered
              {c.answered > 0 ? ` · ${c.accuracy}% accuracy` : ""}
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ marginBottom: "0.75rem" }}>Focus areas</h3>
      {report.focusAreas.length > 0 ? (
        <div className="tile-stack" style={{ marginBottom: "1.5rem" }}>
          {report.focusAreas.map((s) => (
            <div key={s.subject} className="tile category-tile">
              <div className="tile-title">{s.subject}</div>
              <div className="tile-meta">{s.accuracy}% accuracy · {s.answered} answered</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          {hasEnoughForLists
            ? "Nothing stands out as a weak spot yet across the subjects with enough answered questions."
            : `Answer at least ${MIN_SAMPLE_SIZE} questions in a subject to see it show up here, focus areas need enough attempts to be meaningful.`}
        </p>
      )}

      <h3 style={{ marginBottom: "0.75rem" }}>Strengths</h3>
      {report.strengths.length > 0 ? (
        <div className="tile-stack" style={{ marginBottom: "1.5rem" }}>
          {report.strengths.map((s) => (
            <div key={s.subject} className="tile category-tile">
              <div className="tile-title">{s.subject}</div>
              <div className="tile-meta">{s.accuracy}% accuracy · {s.answered} answered</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          {hasEnoughForLists
            ? "Keep practicing -- nothing has crossed the strength threshold yet."
            : `Answer at least ${MIN_SAMPLE_SIZE} questions in a subject to see it show up here.`}
        </p>
      )}

      <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "1.5rem" }}>
        Based on your practice question accuracy in this app. Not a predictor of your NCLEX result.
      </p>

      <div className="btn-row no-print" style={{ marginBottom: "0.5rem" }}>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Export to PDF
        </button>
      </div>
      <a href="/dashboard" className="back-link no-print">&larr; Back to dashboard</a>
    </div>
  );
}
