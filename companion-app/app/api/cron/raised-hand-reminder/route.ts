import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Vercel Cron hits this once a day (see vercel.json). It's the escalation net, not the
// instructor's primary notification: an instructor sees new raised hands the moment they open
// /admin/inbox, this route only exists to catch the ones nobody got to. It checks for anything
// still open past a 24-hour SLA and emails NOTIFY_EMAIL (Brian's personal inbox, not a public
// address -- nothing about this route is student- or instructor-facing) one deep link per
// thread straight into /admin/inbox, so opening the email is one tap from being in front of the
// exact conversation that needs him, not a queue he has to search through.
//
// Caveat worth knowing: this only runs once a day, so the true worst case for a hand raised
// right after the daily run is closer to 48 hours before this catches it, not a clean 24. Vercel
// Cron on the free/Hobby tier only allows once-a-day schedules; running this every few hours
// for a tighter SLA needs a paid Vercel plan (see vercel.json).
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 24);

  const { data: openHands } = await admin
    .from("raised_hands")
    .select("id, created_at, questions(subject)")
    .eq("status", "open")
    .lt("created_at", cutoff.toISOString())
    .order("created_at", { ascending: true });

  if (openHands && openHands.length > 0 && process.env.RESEND_API_KEY) {
    const origin = new URL(request.url).origin;
    const lines = openHands.map((h: any) => {
      const subject = h.questions?.subject ?? "Question";
      return `${subject} (waiting since ${new Date(h.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })})\n${origin}/admin/inbox?thread=${h.id}`;
    });

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nursing Companion <questions@lpnlaunchpad.com>",
        to: process.env.NOTIFY_EMAIL,
        subject: `${openHands.length} raised hand(s) past 24 hours`,
        text: `These have gone unanswered more than 24 hours:\n\n${lines.join("\n\n")}`,
      }),
    });
  }

  return NextResponse.json({ checked: openHands?.length ?? 0 });
}
