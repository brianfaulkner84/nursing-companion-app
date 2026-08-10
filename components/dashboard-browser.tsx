"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Subject = { subject: string; answered: number; total: number; percent: number };
type Module = { name: string; subjects: Subject[]; total: number; answered: number; percent: number };
type Group = { name: string; modules: Module[]; total: number; answered: number; percent: number };
type Category = { category: string; total: number; answered: number; percent: number };
type ItemType = { itemType: string; label: string; total: number; answered: number; percent: number };

export default function DashboardBrowser({
  byGroup,
  byCategory,
  byItemType,
  overallTotal,
  overallAnswered,
}: {
  byGroup: Group[];
  byCategory: Category[];
  byItemType: ItemType[];
  overallTotal: number;
  overallAnswered: number;
}) {
  const [tab, setTab] = useState<"module" | "category" | "itemType">("module");
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [openModule, setOpenModule] = useState<string | null>(null);
  const router = useRouter();
  const overallPercent = overallTotal > 0 ? Math.round((overallAnswered / overallTotal) * 100) : 0;

  function practiceSubjects(subjects: string[], label: string) {
    router.push(`/review-session?subjects=${encodeURIComponent(subjects.join(","))}&label=${encodeURIComponent(label)}`);
  }

  function practiceCategory(category: string) {
    router.push(`/review-session?category=${encodeURIComponent(category)}&label=${encodeURIComponent(category)}`);
  }

  function practiceItemType(itemType: string, label: string) {
    router.push(`/review-session?itemType=${encodeURIComponent(itemType)}&label=${encodeURIComponent(label)}`);
  }

  function selectGroup(group: Group) {
    if (group.modules.length === 1) {
      setOpenGroup(group.name);
      setOpenModule(group.modules[0].name);
    } else {
      setOpenGroup(group.name);
      setOpenModule(null);
    }
  }

  function resetModuleView() {
    setOpenGroup(null);
    setOpenModule(null);
  }

  const activeGroup = byGroup.find((g) => g.name === openGroup);
  const activeModule = activeGroup?.modules.find((m) => m.name === openModule);
  const groupIsSolo = activeGroup ? activeGroup.modules.length === 1 : false;

  return (
    <div>
      <h1>Dashboard</h1>

      <div className="overall-progress">
        <div className="overall-progress-label">
          Overall progress: <span className="overall-progress-count">{overallAnswered.toLocaleString()}</span> / {overallTotal.toLocaleString()} questions
        </div>
        <div className="overall-progress-track">
          <div className="overall-progress-fill" style={{ width: `${overallPercent}%` }} />
        </div>
      </div>

      <div className="tab-row">
        <button
          className={`tab-btn ${tab === "module" ? "tab-btn-active" : ""}`}
          onClick={() => { setTab("module"); resetModuleView(); }}
        >
          By module
        </button>
        <button
          className={`tab-btn ${tab === "category" ? "tab-btn-active" : ""}`}
          onClick={() => { setTab("category"); resetModuleView(); }}
        >
          By NCLEX topic
        </button>
        <button
          className={`tab-btn ${tab === "itemType" ? "tab-btn-active" : ""}`}
          onClick={() => { setTab("itemType"); resetModuleView(); }}
        >
          By question type
        </button>
      </div>

      {tab === "module" && (
        <div>
          {!activeGroup && (
            <div className="cat-grid">
              {byGroup.map((g) => (
                <button key={g.name} className="cat-tile" onClick={() => selectGroup(g)}>
                  <div className="cat-tile-title">{g.name}</div>
                  <div className="cat-tile-meta">
                    {g.modules.length > 1
                      ? `${g.modules.length} parts · ${g.percent}%`
                      : `${g.modules[0].subjects.length} subject${g.modules[0].subjects.length === 1 ? "" : "s"} · ${g.percent}%`}
                  </div>
                </button>
              ))}
              {byGroup.length === 0 && <p className="muted">No questions published yet. Check back soon.</p>}
            </div>
          )}

          {activeGroup && !groupIsSolo && !activeModule && (
            <div>
              <button className="back-link" onClick={resetModuleView} style={{ marginTop: 0 }}>
                &larr; All modules
              </button>
              <div className="cat-grid">
                {activeGroup.modules.map((m) => (
                  <button key={m.name} className="cat-tile" onClick={() => setOpenModule(m.name)}>
                    <div className="cat-tile-title">{m.name}</div>
                    <div className="cat-tile-meta">
                      {m.subjects.length} subject{m.subjects.length === 1 ? "" : "s"} · {m.percent}%
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeModule && (
            <div className="drill-down">
              <button
                className="back-link"
                onClick={() => (groupIsSolo ? resetModuleView() : setOpenModule(null))}
                style={{ marginTop: 0 }}
              >
                &larr; {groupIsSolo ? "All modules" : activeGroup!.name}
              </button>
              <div className="drill-down-label">{activeModule.name} subjects</div>
              <div className="tile-stack">
                {activeModule.subjects.map((s) => (
                  <a key={s.subject} href={`/quiz/${encodeURIComponent(s.subject)}`} className="tile">
                    <div className="tile-title">{s.subject}</div>
                    <div className="tile-meta">
                      {s.total} question{s.total === 1 ? "" : "s"} · {s.percent}% complete
                    </div>
                  </a>
                ))}
              </div>
              <button
                className="btn btn-primary"
                style={{ marginTop: "0.6rem" }}
                onClick={() => practiceSubjects(activeModule.subjects.map((s) => s.subject), activeModule.name)}
              >
                Practice all in {activeModule.name}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "category" && (
        <div className="tile-stack">
          {byCategory.map((c) => (
            <button key={c.category} className="tile category-tile" onClick={() => practiceCategory(c.category)}>
              <div className="tile-title">{c.category}</div>
              <div className="tile-meta">
                {c.total} question{c.total === 1 ? "" : "s"} · {c.percent}% complete
              </div>
            </button>
          ))}
          {byCategory.length === 0 && (
            <p className="muted">No questions published yet. Check back soon.</p>
          )}
        </div>
      )}

      {tab === "itemType" && (
        <div className="tile-stack">
          {byItemType.map((it) => (
            <button key={it.itemType} className="tile category-tile" onClick={() => practiceItemType(it.itemType, it.label)}>
              <div className="tile-title">{it.label}</div>
              <div className="tile-meta">
                {it.total} question{it.total === 1 ? "" : "s"} · {it.percent}% complete
              </div>
            </button>
          ))}
          {byItemType.length === 0 && (
            <p className="muted">No questions published yet. Check back soon.</p>
          )}
        </div>
      )}

      <div className="btn-row" style={{ marginTop: "1.5rem" }}>
        <a href="/progress" className="btn btn-secondary">View progress</a>
        <a href="/review" className="btn btn-secondary">Review answers</a>
      </div>
      <a href="/report-card" className="btn btn-secondary" style={{ marginTop: "0.5rem", display: "block" }}>
        Generate report card
      </a>
      <a href="/exams" className="btn btn-primary" style={{ marginTop: "0.5rem", display: "block" }}>
        Build a review
      </a>
    </div>
  );
}
