"use client";

import { createClient } from "@/lib/supabase/client";

export default function GoogleSignInButton() {
  const supabase = createClient();

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <button className="btn btn-primary" onClick={signInWithGoogle}>
      Sign in with Google
    </button>
  );
}
