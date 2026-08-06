import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const { questionId, selected, note } = await request.json();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: question } = await admin.from("questions").select("*").eq("id", questionId).single();
  if (!question) return NextResponse.json({ error: "question not found" }, { status: 404 });

  const strategySnapshot = [
    question.strategy_1_understand,
    question.strategy_2_remove_distractors,
    question.strategy_3_identify_correct,
    question.strategy_4_eliminate_incorrect,
    question.strategy_5_framework !== "none" ? `Framework: ${question.strategy_5_framework}` : "",
  ].filter(Boolean).join(" ");

  // Live Claude call: draft a reply in Brian's classroom voice, for him to approve or edit before it goes to the student.
  const completion = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 500,
    messages: [{
      role: "user",
      content:
        `You are drafting a reply from a nursing instructor to a student who is confused about a practice question, in a direct, encouraging classroom voice. ` +
        `Question: ${question.question_text}\n` +
        `Options: A) ${question.option_a} B) ${question.option_b} C) ${question.option_c} D) ${question.option_d}\n` +
        `Correct answer: ${question.correct_option}\n` +
        `Strategy walkthrough already shown to the student: ${strategySnapshot}\n` +
        `Rationale already shown to the student: ${question.rationale}\n` +
        `Student's selected answer: ${selected}\n` +
        `Student's note: ${note || "(no note provided)"}\n\n` +
        `Write a short reply (3 to 6 sentences) addressing their specific confusion, not just repeating the rationale.`,
    }],
  });

  const draftReply = completion.content
    .filter((block) => block.type === "text")
    .map((block: any) => block.text)
    .join("\n");

  await admin.from("raised_hands").insert({
    user_id: user.id,
    question_id: questionId,
    selected_option: selected,
    strategy_snapshot: strategySnapshot,
    rationale_snapshot: question.rationale,
    student_note: note,
    claude_draft_reply: draftReply,
    status: "open",
  });

  // Email Brian the draft reply for approval or editing. Swap in Resend or similar once that account exists.
  if (process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nursing Companion <questions@lpnlaunchpad.com>",
        to: process.env.NOTIFY_EMAIL,
        subject: `Raised hand: ${question.subject}`,
        text: `Question: ${question.question_text}\n\nStudent note: ${note}\n\nClaude's draft reply:\n${draftReply}`,
      }),
    });
  }

  return NextResponse.json({ ok: true });
}
