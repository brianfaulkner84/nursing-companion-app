import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BuilderClient from "./builder-client";

const SPECIALTIES = [
  { name: "Pediatrics", slug: "pediatrics" },
  { name: "Pharmacology", slug: "pharmacology" },
  { name: "OB/GYN", slug: "ob-gyn" },
];

export default async function Exams() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: subjects } = await supabase
    .from("subjects")
    .select("name, display_order, specialties(name, slug)")
    .order("display_order", { ascending: true });

  const { data: folders } = await supabase
    .from("subject_folders")
    .select("id, name, subject_folder_items(subject)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const allSubjectNames = (subjects ?? []).map((s: any) => s.name);

  function quickStartHref(specialtySlug: string | null) {
    const names = specialtySlug
      ? (subjects ?? []).filter((s: any) => s.specialties?.slug === specialtySlug).map((s: any) => s.name)
      : allSubjectNames;
    const label = specialtySlug ? SPECIALTIES.find((s) => s.slug === specialtySlug)!.name : "Full";
    if (names.length === 0) return null;
    return `/review-session?subjects=${encodeURIComponent(names.join(","))}&label=${encodeURIComponent(`${label} Review`)}`;
  }

  const fullHref = quickStartHref(null);

  return (
    <div>
      <h1>Build a review</h1>

      <h3>Quick start</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1.75rem" }}>
        {fullHref ? (
          <Link href={fullHref} className="btn btn-primary">Full Review</Link>
        ) : (
          <button disabled className="btn btn-primary">Full Review</button>
        )}
        {SPECIALTIES.map((s) => {
          const href = quickStartHref(s.slug);
          return href ? (
            <Link key={s.slug} href={href} className="btn btn-outline">{s.name} Review</Link>
          ) : (
            <button key={s.slug} disabled className="btn btn-outline">
              {s.name} (not tagged yet)
            </button>
          );
        })}
      </div>

      <h3>Your saved exams</h3>
      <BuilderClient
        allSubjects={(subjects ?? []).map((s: any) => s.name)}
        folders={(folders ?? []).map((f: any) => ({
          id: f.id,
          name: f.name,
          subjects: (f.subject_folder_items ?? []).map((i: any) => i.subject),
        }))}
      />

      <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
    </div>
  );
}
