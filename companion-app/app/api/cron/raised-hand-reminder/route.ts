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

// Engagement threshold for the check-in sweep below: a student with this many sent replies and
// zero reactions on any of them gets asked, once, whether they're actually seeing responses.
// This is the answer to "if a thread silently never reached a student, how would I ever know" --
// without some signal, that looks identical to a student who simply never bothers reacting.
// Matches the five-reply threshold already used elsewhere in the app (category trust ladder) so
// the numbers in this system stay consistent rather than picking a new one arbitrarily.
const ENGAGEMENT_CHECKIN_THRESHOLD = 5;

// A one-time, reason-agnostic nudge. Deliberately does not ask "did you get this on time" or
// name any specific bug -- it doesn't know why a student might be quiet, only that they are.
const CHECKIN_BODY =
  "Quick check-in: you've gotten a few replies to your raised hands, and we haven't heard back " +
  "on any of them, not even a quick reaction. If you're seeing these and everything's fine, no " +
  "need to do anything. But if replies aren't showing up for you, or something looks off, reply " +
  "here and let us know.";

// Finds every student with ENGAGEMENT_CHECKIN_THRESHOLD+ real sent replies (human or AI,
// excluding the hold acknowledgment and any earlier check-in) and zero reactions across all of
// them, who hasn't already been sent a check-in, and sends one, attached to their most recently
// active thread. Runs as part of the same daily cron as the SLA email below rather than a
// separate cron entry -- Vercel's Hobby tier caps how many cron schedules are available, and this
// doesn't need its own cadence.
async function runEngagementCheckinSweep(admin: ReturnType<typeof createAdminClient>) {
  const { data: replies } = await admin
    .from("raised_hand_messages")
    .select("raised_hand_id, user_id, reaction, is_checkin, created_at")
    .eq("sender", "instructor")
    .eq("is_acknowledgment", false)
    .order("created_at", { ascending: false });

  if (!replies || replies.length === 0) return { checkinsSent: 0, subjects: [] as string[] };

  type PerStudent = { total: number; reacted: number; alreadyCheckedIn: boolean; mostRecentHandId: string };
  const byStudent = new Map<string, PerStudent>();
  for (const r of replies as any[]) {
    if (r.is_checkin) {
      const existing = byStudent.get(r.user_id);
      if (existing) existing.alreadyCheckedIn = true;
      else byStudent.set(r.user_id, { total: 0, reacted: 0, alreadyCheckedIn: true, mostRecentHandId: r.raised_hand_id });
      continue;
    }
    const existing = byStudent.get(r.user_id);
    if (existing) {
      existing.total += 1;
      if (r.reaction) existing.reacted += 1;
    } else {
      byStudent.set(r.user_id, {
        total: 1,
        reacted: r.reaction ? 1 : 0,
        alreadyCheckedIn: false,
        // replies is ordered newest-first, so the first row seen for a student is their most
        // recent thread with a sent reply -- exactly where the check-in should land.
        mostRecentHandId: r.raised_hand_id,
      });
    }
  }

  const toCheckIn = Array.from(byStudent.entries()).filter(
    ([, s]) => !s.alreadyCheckedIn && s.total >= ENGAGEMENT_CHECKIN_THRESHOLD && s.reacted === 0
  );

  const subjects: string[] = [];
  for (const [userId, s] of toCheckIn) {
    await admin.from("raised_hand_messages").insert({
      raised_hand_id: s.mostRecentHandId,
      user_id: userId,
      sender: "instructor",
      sender_id: null,
      body: CHECKIN_BODY,
      is_checkin: true,
    });
    subjects.push(s.mostRecentHandId);
  }

  return { checkinsSent: toCheckIn.length, subjects };
}

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

  const { checkinsSent } = await runEngagementCheckinSweep(admin);

  if (((openHands && openHands.length > 0) || checkinsSent > 0) && process.env.RESEND_API_KEY) {
    const origin = new URL(request.url).origin;
    const lines = (openHands ?? []).map((h: any) => {
      const subject = h.questions?.subject ?? "Question";
      return `${subject} (waiting since ${new Date(h.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })})\n${origin}/admin/inbox?thread=${h.id}`;
    });
    const checkinLine = checkinsSent > 0 ? `\n\n${checkinsSent} engagement check-in message(s) auto-sent to students with no reaction on several replies.` : "";
    const handCount = openHands?.length ?? 0;
    const subjectLine =
      handCount > 0 && checkinsSent > 0
        ? `${handCount} raised hand(s) past 24 hours, ${checkinsSent} check-in(s) sent`
        : handCount > 0
        ? `${handCount} raised hand(s) past 24 hours`
        : `${checkinsSent} engagement check-in(s) sent`;
    const bodyText = handCount > 0 ? `These have gone unanswered more than 24 hours:\n\n${lines.join("\n\n")}${checkinLine}` : checkinLine.trim();

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Nursing Companion <questions@lpnlaunchpad.com>",
        to: process.env.NOTIFY_EMAIL,
        subject: subjectLine,
        text: bodyText,
      }),
    });
  }

  return NextResponse.json({ checked: openHands?.length ?? 0, checkinsSent });
}
