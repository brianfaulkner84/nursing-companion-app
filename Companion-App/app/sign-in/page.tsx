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
      <h1>Sign in</h1>
      <button onClick={signInWithGoogle} style={{ width: "100%", padding: "0.75rem", marginTop: "1rem" }}>
        Sign in with Google
      </button>
    </div>
  );
}
