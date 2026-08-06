import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Vercel Cron hits this once a day (see vercel.json). It checks for raised hands
// that have been open more than 1 to 2 business days and emails Brian a reminder,
// so nothing silently ages out past his 24-hour response goal.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 2);

  const { data: openHands } = await admin
    .from("raised_hands")
    .select("id, question_id, created_at")
    .eq("status", "open")
    .lt("created_at", cutoff.toISOString());

  if (openHands && openHands.length > 0 && process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nursing Companion <questions@lpnlaunchpad.com>",
        to: process.env.NOTIFY_EMAIL,
        subject: `${openHands.length} raised hand(s) waiting on you`,
        text: `${openHands.length} raised hand(s) have been open more than 1 to 2 business days. Check the raised_hands table.`,
      }),
    });
  }

  return NextResponse.json({ checked: openHands?.length ?? 0 });
}
