import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

// Scores an attempt server-side against response_keys and records it. The quiz screen
// itself never fetches response_keys, so this is where "is that actually correct" gets
// decided, not in the browser.
export async function POST(request: Request) {
  const { questionId, interactionId, selectedChoiceIds } = await request.json();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  if (!questionId || !interactionId || !Array.isArray(selectedChoiceIds) || selectedChoiceIds.length === 0) {
    return NextResponse.json({ error: "missing or invalid answer" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: keys, error: keysError } = await admin
    .from("response_keys")
    .select("choice_id")
    .eq("interaction_id", interactionId);
  if (keysError) return NextResponse.json({ error: keysError.message }, { status: 500 });

  const correctIds = (keys ?? []).map((k) => k.choice_id).filter(Boolean).sort();
  const chosenIds = [...selectedChoiceIds].sort();
  const correct =
    correctIds.length === chosenIds.length && correctIds.every((id, i) => id === chosenIds[i]);

  const { error: insertError } = await admin.from("attempts").insert({
    user_id: user.id,
    question_id: questionId,
    interaction_id: interactionId,
    selected_choice_ids: selectedChoiceIds,
    correct,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ correct });
}
