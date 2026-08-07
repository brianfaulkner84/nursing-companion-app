"use client";

import { createClient } from "@/lib/supabase/client";

export default function SignIn() {
  const supabase = createClient();

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div>
      <div className="card-dark" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ color: "var(--cream-100)", marginBottom: "0.4rem" }}>Welcome back</h1>
        <p style={{ color: "var(--sage-200)", margin: 0 }}>
          Sign in to pick up your NCLEX-PN practice where you left off.
        </p>
      </div>
      <button className="btn btn-primary" onClick={signInWithGoogle}>
        Sign in with Google
      </button>
    </div>
  );
}
