"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Question = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
};

export default function QuizClient({ question, subject }: { question: Question; subject: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const options: [string, string][] = [
    ["A", question.option_a],
    ["B", question.option_b],
    ["C", question.option_c],
    ["D", question.option_d],
  ];

  async function submit() {
    if (!selected) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("attempts").insert({
      user_id: user.id,
      question_id: question.id,
      correct: selected === question.correct_option,
    });

    router.push(`/quiz/${encodeURIComponent(subject)}/answer?question=${question.id}&selected=${selected}`);
  }

  return (
    <div>
      <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "1rem", marginBottom: "1rem" }}>
        {question.question_text}
      </div>
      {options.map(([letter, text]) => (
        <button
          key={letter}
          onClick={() => setSelected(letter)}
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            padding: "0.6rem",
            marginBottom: "0.4rem",
            border: selected === letter ? "2px solid #333" : "1px solid #ccc",
            borderRadius: 6,
          }}
        >
          {letter}. {text}
        </button>
      ))}
      <button onClick={submit} disabled={!selected} style={{ width: "100%", padding: "0.75rem", marginTop: "0.5rem" }}>
        Submit
      </button>
    </div>
  );
}
