import { createClient } from "@/lib/supabase/server";
import GoogleSignInButton from "@/components/google-sign-in-button";

export default async function SignIn() {
  const supabase = createClient();
  // Public read (RLS: is_published = true), no auth required. head:true skips
  // fetching rows and just returns the count.
  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true });
  const questionCount = count ?? 0;

  return (
    <div>
      <div className="card-dark" style={{ marginBottom: "1rem" }}>
        <h1 style={{ color: "var(--cream-100)", marginBottom: "0.4rem" }}>Welcome back</h1>
        <p style={{ color: "var(--sage-200)", margin: 0 }}>
          Sign in to pick up your NCLEX-PN practice where you left off.
        </p>
      </div>

      {questionCount > 0 && (
        <div className="growth-banner">
          Now with {questionCount.toLocaleString()} practice questions and rising!
        </div>
      )}

      <GoogleSignInButton />
    </div>
  );
}
