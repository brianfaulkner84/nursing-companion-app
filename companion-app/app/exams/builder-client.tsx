"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Folder = { id: string; name: string; subjects: string[] };

export default function BuilderClient({
  allSubjects,
  folders,
}: {
  allSubjects: string[];
  folders: Folder[];
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function toggle(subject: string) {
    setSelected((prev) => (prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]));
  }

  async function saveAndStart() {
    setError("");
    if (!name.trim()) {
      setError("Name this exam first.");
      return;
    }
    if (selected.length === 0) {
      setError("Pick at least one subject.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/subject-folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), subjects: selected }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong saving that exam.");
      return;
    }
    const { id } = await res.json();
    router.push(`/review-session?folder=${id}`);
  }

  async function remove(id: string) {
    await fetch(`/api/subject-folders/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      {folders.length === 0 && <p className="muted">No saved exams yet.</p>}
      {folders.map((f) => (
        <div key={f.id} className="card" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <div style={{ flex: 1 }}>
            <div className="tile-title">{f.name}</div>
            <div className="tile-meta">{f.subjects.join(", ")}</div>
          </div>
          <Link href={`/review-session?folder=${f.id}`} className="btn btn-primary btn-small">Start</Link>
          <button onClick={() => remove(f.id)} className="btn btn-outline btn-small">Delete</button>
        </div>
      ))}

      <h3 style={{ marginTop: "1.5rem" }}>Build a custom exam</h3>
      <input
        placeholder="Name this exam (e.g. Exam 2 Review)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: "0.75rem" }}
      />
      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
          {allSubjects.map((subject) => (
            <label key={subject} className="checkbox-row">
              <input type="checkbox" checked={selected.includes(subject)} onChange={() => toggle(subject)} />
              {subject}
            </label>
          ))}
        </div>
        {allSubjects.length === 0 && <p className="muted" style={{ margin: 0 }}>No subjects available yet.</p>}
      </div>
      {error && <p className="error-text">{error}</p>}
      <button onClick={saveAndStart} disabled={saving} className="btn btn-primary">
        {saving ? "Saving..." : "Save & start"}
      </button>
    </div>
  );
}
