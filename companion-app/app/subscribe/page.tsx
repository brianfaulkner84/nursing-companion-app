"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Subscribe() {
  const [betaCode, setBetaCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleContinue() {
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
      <div className="banner banner-correct" style={{ textTransform: "none", fontWeight: 500 }}>
        Free beta, no plan required right now
      </div>
      <input
        placeholder="Beta code"
        value={betaCode}
        onChange={(e) => setBetaCode(e.target.value)}
        style={{ marginBottom: "0.75rem" }}
      />
      {error && <p className="error-text">{error}</p>}
      <button className="btn btn-primary" onClick={handleContinue}>
        Continue
      </button>
    </div>
  );
}
