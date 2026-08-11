import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { decideTier } from "@/lib/tier";
import { getAnthropic, NO_FABRICATED_CONTEXT_INSTRUCTION } from "@/lib/anthropic";

export async function POST(request: Request) {
  const { questionId, selected, note } = await request.json();
  const selectedIds: string[] = (selected ?? "").split(",").filter(Boolean);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: question } = await admin
    .from("questions")
    .select(
      "*, question_interactions(*, question_options(*), response_keys(*)), critical_thinking_frameworks(name)"
    )
    .eq("id", questionId)
    .single();
  if (!question) return NextResponse.json({ error: "question not found" }, { status: 404 });

  // Every question has exactly one interaction today.
  const interaction = (question.question_interactions ?? [])[0];
  const options = [...(interaction?.question_options ?? [])].sort(
    (a: any, b: any) => a.display_order - b.display_order
  );
  const correctIds = new Set<string>(
    (interaction?.response_keys ?? []).map((k: any) => k.choice_id as string).filter(Boolean)
  );
  const correctOptions = options.filter((o: any) => correctIds.has(o.id));
  const incorrectOptions = options.filter((o: any) => !correctIds.has(o.id));
  const selectedOptions = options.filter((o: any) => selectedIds.includes(o.id));
  const frameworkName = question.critical_thinking_frameworks?.name;

  const optionsSummary = options
    .map((o: any) => `${o.option_label}) ${o.option_text}${correctIds.has(o.id) ? " [correct]" : ""}`)
    .join(" ");

  const strategySnapshot = [
    question.strategy_1_understand,
    question.strategy_2_clear_stem,
    question.strategy_3_identify_correct,
    incorrectOptions.map((o: any) => `${o.option_label}: ${o.option_rationale}`).join(" "),
    frameworkName ? `Framework (${frameworkName}): ${question.framework_application ?? ""}` : "",
  ].filter(Boolean).join(" ");

  // Live Claude call: draft a reply in Brian's classroom voice, for him to approve or edit before it goes to the student.
  // Haiku is the cheapest model and plenty for a short, templated draft reply like this.
  const completion = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{
      role: "user",
      content:
        `You are drafting a reply from a nursing instructor to a student who is confused about a practice question, in a direct, encouraging classroom voice. ` +
        `Question: ${question.question_text}\n` +
        `Options: ${optionsSummary}\n` +
        `Correct answer(s): ${correctOptions.map((o: any) => o.option_label).join(", ")}\n` +
        `Strategy walkthrough already shown to the student: ${strategySnapshot}\n` +
        `Rationale already shown to the student: ${question.correct_answer_rationale}\n` +
        `Student's selected answer(s): ${selectedOptions.map((o: any) => o.option_label).join(", ")}\n` +
        `Student's note: ${note || "(no note provided)"}\n\n` +
        `Write a short reply (3 to 6 sentences) addressing their specific confusion, not just repeating the rationale. ` +
        `${NO_FABRICATED_CONTEXT_INSTRUCTION} ` +
        `Plain text only: no Markdown, no headers, no asterisks for bold or italics, no bullet points. ` +
        `Write it exactly as it should appear to the student, since it is shown as-is with no formatting applied.`,
    }],
  });

  const draftReply = completion.content
    .filter((block) => block.type === "text")
    .map((block: any) => block.text)
    .join("\n");

  // Tiered AI reply review (MNGT 745 Week 6 capstone). A second, short Claude call self-audits
  // the draft above: does it stay inside the strategy/rationale the student already saw for
  // this exact question, or does it have to reach past that, plus a 1-5 confidence score with a
  // required reason, and whether the student's own note reads as emotionally distressed. This
  // score never decides the tier by itself -- it's stored for admin to watch over time and
  // compare against what actually happens on review, not treated as a vote. Deferred from this
  // build, on purpose: verifying the draft against outside sources (the platinum/gold/silver/
  // bronze list and the recency rule from the design summary). The grounded check alone is what
  // gates auto-send here; nothing sends on a reply that has to extend past the stored material,
  // source-checked or not.
  const auditCompletion = await getAnthropic().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    messages: [{
      role: "user",
      content:
        `Audit a draft reply to a nursing student. Respond with ONLY a JSON object, no other text, no Markdown fences.\n\n` +
        `Strategy and rationale already shown to the student (the only material this reply should need): ${strategySnapshot} ${question.correct_answer_rationale}\n` +
        `Student's note: ${note || "(no note provided)"}\n` +
        `Draft reply: ${draftReply}\n\n` +
        `Return this exact JSON shape: {"grounded": boolean, "confidence_score": number (1-5), "confidence_reason": string (one sentence), "emotionally_distressed": boolean}. ` +
        `"grounded" is true only if the draft reply's content is fully supported by the strategy and rationale given above, with nothing added that isn't already there. ` +
        `This includes claimed sources: if the reply references lecture notes, "our unit," a specific textbook, or any other course material as if it knows what the student's class covered, that is not grounded, even if the underlying clinical fact happens to be correct, since nothing in this prompt gave it that context. ` +
        `"emotionally_distressed" is about the student's note, not the reply: true if the note reads as hopeless, overwhelmed, or questioning whether they belong in the program, not just ordinary confusion about the question.`,
    }],
  });

  const auditText = auditCompletion.content
    .filter((block) => block.type === "text")
    .map((block: any) => block.text)
    .join("");

  let grounded = false;
  let confidenceScore = 1;
  let confidenceReason = "Self-audit response could not be parsed; held for review as a precaution.";
  let emotionallyDistressed = false;
  try {
    // Haiku sometimes wraps the JSON in a ```json fence or adds a stray sentence before/after it
    // despite being told not to -- pull out the first {...} block instead of requiring the whole
    // response to be pure JSON, so a harmless wrapper doesn't trigger the fail-closed path below
    // on every single call. Every recent audit was hitting that fallback, which meant nothing
    // could ever auto-send regardless of category trust; this is the actual fix for that.
    const jsonMatch = auditText.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : auditText);
    grounded = parsed.grounded === true;
    confidenceScore = Math.min(5, Math.max(1, Math.round(Number(parsed.confidence_score) || 1)));
    confidenceReason = String(parsed.confidence_reason || confidenceReason);
    emotionallyDistressed = parsed.emotionally_distressed === true;
  } catch {
    // Fail closed: an unparseable audit response is treated the same as "not grounded," which
    // forces a hold in decideTier below, never an auto-send. Logged so a repeat of this doesn't
    // require blind guessing again -- the raw text is what actually tells you whether it was
    // truncation, a markdown fence the regex above didn't catch, or something else entirely.
    console.error("[/api/raise-hand] audit JSON parse failed, raw response:", auditText);
  }

  // The three signals decideTier needs beyond the audit itself: how much this subject has
  // already been trusted, whether this question already has an open content flag, and whether
  // this student has already raised a hand on this exact question before.
  const { data: trustRow } = await admin
    .from("category_trust")
    .select("current_tier")
    .eq("subject", question.subject)
    .maybeSingle();
  const categoryTier = (trustRow?.current_tier as "hold" | "high" | "low") ?? "hold";

  const { count: openFlagCount } = await admin
    .from("question_flags")
    .select("id", { count: "exact", head: true })
    .eq("question_id", questionId)
    .eq("status", "open");

  const { count: priorRaisedHandCount } = await admin
    .from("raised_hands")
    .select("id", { count: "exact", head: true })
    .eq("question_id", questionId)
    .eq("user_id", user.id);

  const { tier, holdReason } = decideTier({
    grounded,
    categoryTier,
    openFlagCount: openFlagCount ?? 0,
    questionContentStatus: question.content_status ?? "live",
    emotionallyDistressed,
    isRepeat: (priorRaisedHandCount ?? 0) > 0,
  });

  const autoSend = tier === "high" || tier === "low";

  const { data: inserted, error: insertError } = await admin
    .from("raised_hands")
    .insert({
      user_id: user.id,
      question_id: questionId,
      selected_option_ids: selectedIds,
      strategy_snapshot: strategySnapshot,
      rationale_snapshot: question.correct_answer_rationale,
      student_note: note,
      claude_draft_reply: draftReply,
      // Hold behaves exactly as it does today: nothing sent, waits in the approval queue.
      // High and low priority auto-send immediately -- see the design summary's audit-step and
      // category-trust-ladder sections for why each tier is allowed to do that.
      sent_reply: autoSend ? draftReply : null,
      status: autoSend ? "resolved" : "open",
      answered_at: autoSend ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await admin.from("reply_audits").insert({
    raised_hand_id: inserted.id,
    question_id: questionId,
    subject: question.subject,
    tier,
    grounded,
    confidence_score: confidenceScore,
    confidence_reason: confidenceReason,
  });

  // This is the thread's first message. Everything after it, both directions, gets appended
  // here instead of overwriting a single note/reply pair, so the student and instructor can
  // keep going back and forth on the same question.
  if (note && note.trim()) {
    await admin.from("raised_hand_messages").insert({
      raised_hand_id: inserted.id,
      user_id: user.id,
      sender: "student",
      body: note.trim(),
    });
  }

  // For an auto-sent reply, append it to the thread the same way a human instructor's reply
  // would show up via /api/raised-hands/[id]/respond -- same sender type, so the thread view
  // doesn't need special-casing to render it. sender_id stays null here specifically, the same
  // field the respond route sets to a real instructor's id, so admin can always tell an
  // AI-auto-sent message apart from one a specific instructor personally sent.
  if (autoSend) {
    await admin.from("raised_hand_messages").insert({
      raised_hand_id: inserted.id,
      user_id: user.id,
      sender: "instructor",
      sender_id: null,
      body: draftReply,
    });
  } else {
    // A held thread used to sit in total silence until an instructor got to it -- nothing sent,
    // nothing in the student's inbox but their own note, for however long the review queue took.
    // This sends an immediate, honest placeholder instead: not Claude's specific (unverified,
    // that's the whole reason it's holding) answer, just an acknowledgment that someone's coming.
    // A distressed note gets a warmer, personal version, not the same "good question" framing
    // used for an ordinary content hold. is_acknowledgment marks this as a status note, not a
    // clinical answer, so the UI doesn't attach the AI-answer disclosure/flag block to it.
    const ackBody =
      holdReason === "distressed"
        ? "Thanks for sending this over. An instructor is going to look at it personally and get back to you soon."
        : "Good question. This one needs an instructor's eyes before a full answer goes out, so hang tight, you'll hear back soon.";
    await admin.from("raised_hand_messages").insert({
      raised_hand_id: inserted.id,
      user_id: user.id,
      sender: "instructor",
      sender_id: null,
      body: ackBody,
      is_acknowledgment: true,
    });
  }

  // Email Brian. Hold keeps the existing approval-request email unchanged. Auto-sent replies
  // get a different subject line so it's immediately clear from the inbox which kind of email
  // this is, an approval still waiting on him versus something that already went out and is
  // sitting in the new Sent, Needs Review queue.
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
        subject: autoSend
          ? `Auto-sent (${tier} priority): ${question.subject}`
          : `Raised hand: ${question.subject}`,
        text: `Question: ${question.question_text}\n\nStudent note: ${note}\n\nClaude's draft reply:\n${draftReply}\n\nAudit: grounded=${grounded}, confidence=${confidenceScore}/5 (${confidenceReason}), tier=${tier}`,
      }),
    });
  }

  return NextResponse.json({ ok: true });
}
