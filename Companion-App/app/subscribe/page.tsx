"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Subscribe() {
  const [betaCode, setBetaCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleContinue() {
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const trimmed = betaCode.trim().toUpperCase();
    if (trimmed) {
      const { data: code } = await supabase
        .from("beta_codes")
        .select("code, grant_type, active")
        .eq("code", trimmed)
        .maybeSingle();

      if (!code || !code.active) {
        setError("That beta code isn't valid.");
        return;
      }

      await supabase
        .from("profiles")
        .update({ beta_code_used: trimmed, access_type: "lifetime-free" })
        .eq("id", user.id);
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
