"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccessBlockReason } from "@/lib/access";

const blockMessages: Record<Exclude<AccessBlockReason, null>, string> = {
  profile_archived: "Your access was paused by your instructor. Reach out to them if you think that's a mistake.",
  school_archived: "Your school's access to LPN Launchpad has ended. Reach out to your instructor if you think that's a mistake.",
  school_expired: "Your school's access period has ended. Reach out to your instructor about renewing, or subscribe individually below to keep going in the meantime.",
};

export default function SubscribeForm({ blockReason }: { blockReason: AccessBlockReason }) {
  const [betaCode, setBetaCode] = useState("");
  const [error, setError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const router = useRouter();

  async function startCheckout() {
    setError("");
    setCheckoutLoading(true);
    const res = await fetch("/api/create-checkout-session", { method: "POST" });
    if (!res.ok) {
      setCheckoutLoading(false);
      setError("Something went wrong starting checkout. Try again.");
      return;
    }
    const { url } = await res.json();
    window.location.href = url;
  }

  async function handleBetaCode() {
    setError("");

    const res = await fetch("/api/redeem-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: betaCode }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div>
      <h1>Subscribe</h1>

      {blockReason && (
        <div className="banner banner-incorrect" style={{ textTransform: "none", fontWeight: 500, marginBottom: "1rem" }}>
          {blockMessages[blockReason]}
        </div>
      )}

      {blockReason !== "profile_archived" && blockReason !== "school_archived" && (
        <>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h3>$5 / month</h3>
            <p style={{ margin: "0.3rem 0 0.75rem" }}>
              14 days free, then $5/month. Cancel any time from your account.
            </p>
            <button className="btn btn-primary" onClick={startCheckout} disabled={checkoutLoading}>
              {checkoutLoading ? "Starting checkout..." : "Start 14-day free trial"}
            </button>
          </div>

          <p className="muted" style={{ margin: "1rem 0 0.5rem" }}>Have a beta code instead?</p>
          <input
            placeholder="Beta code"
            value={betaCode}
            onChange={(e) => setBetaCode(e.target.value)}
            style={{ marginBottom: "0.75rem" }}
          />
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-secondary" onClick={handleBetaCode}>
            Redeem code
          </button>
        </>
      )}
    </div>
  );
}
