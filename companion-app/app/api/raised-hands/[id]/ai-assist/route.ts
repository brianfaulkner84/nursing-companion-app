import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getViewer, canReviewStudents } from "@/lib/roles";
import { getAnthropic, NO_FABRICATED_CONTEXT_INSTRUCTION } from "@/lib/anthropic";

// Lets an instructor revise a draft reply by typing an instruction ("make this shorter,"
// "focus on why option C is wrong," "soften the tone") instead of hand-editing every word
// themselves. This never sends anything -- it only returns revised text into the same editable
// textarea the instructor already controls in the admin inbox, so "Send edited reply" is still
// the one deliberate, separate action that actually reaches the student. Same fail-safe shape
// as the rest of the tiered-reply-review build: AI proposes, a human still has to approve.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { instruction, currentDraft } = await request.json();
  if (!instruction || !instruction.trim()) {
    return NextResponse.json({ error: "instruction is required" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authorized" }, { status: 403 });
  const viewer = await getViewer(supabase, user);
  if (!canReviewStudents(viewer.role)) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();
  // The select string has to be a single literal, not built with `+` or template
  // interpolation -- Supabase's TS types parse the select string at compile time to infer the
  // result shape, and anything other than one plain literal collapses that inference to an
  // untyped error type instead, which then makes every property access below fail to compile.
  const { data: hand } = await admin
    .from("raised_hands")
    .select(
      "strategy_snapshot, rationale_snapshot, student_note, claude_draft_reply, selected_option_ids, questions(question_text, question_interactions(question_options(id, option_label, option_text, display_order), response_keys(choice_id)))"
    )
    .eq("id", params.id)
    .single();
  if (!hand) return NextResponse.json({ error: "thread not found" }, { status: 404 });

  const interaction = (hand.questions as any)?.question_interactions?.[0];
  const correctIds = new Set((interaction?.response_keys ?? []).map((k: any) => k.choice_id).filter(Boolean));
  const selectedIds = new Set(hand.selected_option_ids ?? []);
  const options = [...(interaction?.question_options ?? [])].sort(
    (a: any, b: any) => a.display_order - b.display_order
  );
  const optionsSummary = options
    .map(
      (o: any) =>
        `${o.option_label}) ${o.option_text}${correctIds.has(o.id) ? " [correct]" : ""}${
          selectedIds.has(o.id) ? " [student selected]" : ""
        }`
    )
    .join(" ");

  // The draft being revised is whatever's currently in the instructor's textarea, not
  // necessarily Claude's original draft -- if they've already hand-edited some of it before
  // reaching for AI assist, that edit is the starting point, not discarded.
  const draftToRevise = (currentDraft ?? hand.claude_draft_reply ?? "").trim();

  const completion = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content:
          `A nursing instructor is revising a draft reply to a student, using their own instruction below. Follow the instructor's instruction exactly.\n\n` +
          `Question: ${(hand.questions as any)?.question_text ?? ""}\n` +
          `Options: ${optionsSummary}\n` +
          `Strategy walkthrough already shown to the student: ${hand.strategy_snapshot ?? ""}\n` +
          `Rationale already shown to the student: ${hand.rationale_snapshot ?? ""}\n` +
          `Student's note: ${hand.student_note || "(no note provided)"}\n` +
          `Current draft reply: ${draftToRevise}\n\n` +
          `Instructor's instruction for revising this reply: ${instruction.trim()}\n\n` +
          `${NO_FABRICATED_CONTEXT_INSTRUCTION} ` +
          `Plain text only: no Markdown, no headers, no asterisks for bold or italics, no bullet points. ` +
          `Output only the revised reply, exactly as it should appear to the student -- no preamble, no explanation of what you changed.`,
      },
    ],
  });

  const revised = completion.content
    .filter((block) => block.type === "text")
    .map((block: any) => block.text)
    .join("\n")
    .trim();

  return NextResponse.json({ reply: revised });
}
