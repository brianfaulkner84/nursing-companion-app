"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Question = {
  id: string;
  title: string | null;
  question_text: string;
  question_type: "single_select" | "multiple_select";
};

type Option = {
  id: string;
  option_label: string;
  option_text: string;
  is_correct: boolean;
};

export default function QuizClient({
  question,
  options,
  subject,
}: {
  question: Question;
  options: Option[];
  subject: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const router = useRouter();
  const supabase = createClient();
  const isMultiple = question.question_type === "multiple_select";

  function toggle(id: string) {
    if (isMultiple) {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else {
      setSelectedIds([id]);
    }
  }

  async function submit() {
    if (selectedIds.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const correctIds = options.filter((o) => o.is_correct).map((o) => o.id).sort();
    const chosenIds = [...selectedIds].sort();
    const correct = correctIds.length === chosenIds.length && correctIds.every((id, i) => id === chosenIds[i]);

    await supabase.from("attempts").insert({
      user_id: user.id,
      question_id: question.id,
      selected_option_ids: selectedIds,
      correct,
    });

    router.push(
      `/quiz/${encodeURIComponent(subject)}/answer?question=${question.id}&selected=${selectedIds.join(",")}`
    );
  }

  return (
    <div>
      {question.title && <h2>{question.title}</h2>}
      <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "1rem", marginBottom: "0.5rem" }}>
        {question.question_text}
      </div>
      {isMultiple && (
        <p style={{ fontSize: 13, color: "#666", marginBottom: "0.5rem" }}>Select all that apply.</p>
      )}
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => toggle(opt.id)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "0.6rem",
            marginBottom: "0.4rem",
            border: selectedIds.includes(opt.id) ? "2px solid #333" : "1px solid #ccc",
            borderRadius: 6,
          }}
        >
          {opt.option_label}. {opt.option_text}
        </button>
      ))}
      <button onClick={submit} disabled={selectedIds.length === 0} style={{ width: "100%", padding: "0.75rem", marginTop: "0.5rem" }}>
        Submit
      </button>
    </div>
  );
}
