// Tiered AI reply review (MNGT 745 Week 6 capstone). See the LPN Launchpad Capstone design
// summary for the full reasoning behind each check. Pure decision function, no I/O, so the
// actual queries (category trust lookup, open flag count, repeat-raised-hand check) stay in the
// route that calls this and this stays easy to reason about and test on its own.

export type Tier = "hold" | "high" | "low";

// Why a reply landed on hold, distinct from the tier itself. Drives which acknowledgment the
// student sees immediately (see app/api/raise-hand/route.ts): a distressed note gets a warmer,
// personal message instead of the default "an instructor needs to look at this" one. Not
// surfaced anywhere else right now, but keeping the reason around rather than collapsing
// everything into a bare "hold" makes that distinction possible without re-deriving it.
export type HoldReason = "not_grounded" | "content_flagged" | "distressed" | "repeat" | "untrusted";

export function decideTier(input: {
  // Did the draft stay inside the question's stored rationale/strategy, or did it have to
  // extend past what's already vetted for this exact question? An ungrounded draft always
  // holds, regardless of confidence score or how trusted the subject is -- confidence never
  // overrides a real check, it's an observational signal for admin, not a vote (see the design
  // summary's AI self-reported confidence section).
  grounded: boolean;
  // The subject's current standing on the category trust ladder. Defaults to "hold" for any
  // subject with no track record yet -- nothing auto-sends on day one with zero data.
  categoryTier: Tier;
  // Open question_flags on this specific question. Any open flag holds AI replies about that
  // question, well below the two-flag threshold that pulls the question from service entirely
  // (the per-question circuit breaker) -- a first flag is reason enough for extra caution on
  // replies, even before the bigger action of pulling the question itself.
  openFlagCount: number;
  // Defensive redundancy: if the question itself isn't live (already held by the circuit
  // breaker), nothing about it should auto-send even if this specific reply looks clean.
  questionContentStatus: "live" | "needs_rewrite" | "needs_removal";
  // Student's note read as emotionally distressed. Not an accuracy problem, a person problem --
  // holds regardless of how well-grounded or how trusted the subject is.
  emotionallyDistressed: boolean;
  // This student has already raised a hand on this exact question before. A second ask on the
  // same question is a live signal something isn't landing; hold rather than let the AI take a
  // second unsupervised swing.
  isRepeat: boolean;
}): { tier: Tier; holdReason: HoldReason | null } {
  if (!input.grounded) return { tier: "hold", holdReason: "not_grounded" };
  if (input.questionContentStatus !== "live") return { tier: "hold", holdReason: "content_flagged" };
  if (input.openFlagCount > 0) return { tier: "hold", holdReason: "content_flagged" };
  if (input.emotionallyDistressed) return { tier: "hold", holdReason: "distressed" };
  if (input.isRepeat) return { tier: "hold", holdReason: "repeat" };
  if (input.categoryTier === "hold") return { tier: "hold", holdReason: "untrusted" };
  return { tier: input.categoryTier, holdReason: null };
}

// Category trust ladder movement. Called after an admin/instructor reviews a sent reply as
// clean (approved as-is) or corrects it. One correction steps the subject back up a tier
// immediately, not all the way to hold; a category that's earned real trust doesn't get thrown
// out over one miss, but it also doesn't get ignored.
export function nextCategoryTier(
  currentTier: Tier,
  consecutiveCleanCount: number,
  outcome: "clean" | "corrected"
): { tier: Tier; consecutiveCleanCount: number } {
  if (outcome === "corrected") {
    const steppedUp = currentTier === "low" ? "high" : "hold";
    return { tier: steppedUp, consecutiveCleanCount: 0 };
  }

  const count = consecutiveCleanCount + 1;
  if (currentTier === "hold" && count >= 5) return { tier: "high", consecutiveCleanCount: count };
  if (currentTier === "high" && count >= 15) return { tier: "low", consecutiveCleanCount: count };
  return { tier: currentTier, consecutiveCleanCount: count };
}
