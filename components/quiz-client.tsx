"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Interaction = {
  id: string;
  minimum_selections: number;
  maximum_selections: number;
  item_types: { name: string } | null;
};

type Question = {
  id: string;
  title: string | null;
  question_text: string;
};

type Option = {
  id: string;
  option_label: string;
  option_text: string;
};

// Shared by the single-subject quiz (/quiz/[subject]) and the multi-subject review session
// (/review-session). Callers pass in where "see the answer" should go, since that differs
// (one subject vs. a resolved subject list carried through the URL).
export default function QuizClient({
  question,
  interaction,
  options,
  answerHref,
}: {
  question: Question;
  interaction: Interaction;
  options: Option[];
  answerHref: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const router = useRouter();

  const itemType = interaction.item_types?.name;
  const isSingle = itemType === "single_choice";
  const maxSelections = interaction.maximum_selections;

  function toggle(id: string) {
    if (isSingle) {
      setSelectedIds([id]);
      return;
    }
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= maxSelections) return prev;
      return [...prev, id];
    });
  }

  async function submit() {
    if (selectedIds.length === 0) return;
    setError("");

    const res = await fetch("/api/submit-attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: question.id,
        interactionId: interaction.id,
        selectedChoiceIds: selectedIds,
      }),
    });

    if (!res.ok) {
      setError("Something went wrong submitting that answer. Try again.");
      return;
    }

    const separator = answerHref.includes("?") ? "&" : "?";
    router.push(`${answerHref}${separator}question=${question.id}&selected=${selectedIds.join(",")}`);
  }

  return (
    <div>
      {question.title && <h3 style={{ marginBottom: "0.3rem" }}>{question.title}</h3>}
      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <p style={{ margin: 0 }}>{question.question_text}</p>
      </div>
      {itemType === "multiple_response" && <p className="muted">Select all that apply.</p>}
      {itemType === "select_n" && <p className="muted">Select exactly {maxSelections}.</p>}
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => toggle(opt.id)}
          className={`option${selectedIds.includes(opt.id) ? " selected" : ""}`}
        >
          <span className="option-label">{opt.option_label}.</span> {opt.option_text}
        </button>
      ))}
      {error && <p className="error-text">{error}</p>}
      <button onClick={submit} disabled={selectedIds.length === 0} className="btn btn-primary" style={{ marginTop: "0.5rem" }}>
        Submit
      </button>
    </div>
  );
}
