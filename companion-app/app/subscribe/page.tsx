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
      <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "0.75rem", margin: "1rem 0" }}>
        Free beta, no plan required right now
      </div>
      <input
        placeholder="Beta code"
        value={betaCode}
        onChange={(e) => setBetaCode(e.target.value)}
        style={{ width: "100%", padding: "0.6rem", marginBottom: "0.5rem" }}
      />
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button onClick={handleContinue} style={{ width: "100%", padding: "0.75rem" }}>
        Continue
      </button>
    </div>
  );
}
