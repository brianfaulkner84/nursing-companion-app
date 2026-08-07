import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getThinTopics, THIN_TOPIC_THRESHOLD } from "@/lib/content-gaps";
import { getViewer, isAdmin } from "@/lib/roles";
import ExportCsvButton from "@/components/export-csv-button";

export const dynamic = "force-dynamic";

export default async function ContentGaps() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  // Content/taxonomy management stays admin-only, unlike Review inbox and Review feedback --
  // an instructor helps run the classroom, but reshaping the question bank stays curriculum
  // ownership.
  const viewer = await getViewer(supabase, user);
  if (!isAdmin(viewer.role)) redirect("/dashboard");

  const admin = createAdminClient();
  const thin = await getThinTopics(admin);

  return (
    <div>
      <h1>Content gaps</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        Subjects with fewer than {THIN_TOPIC_THRESHOLD} questions. Some of these are worth
        writing more questions for. Others are probably fragments of a bigger topic that
        should get merged into a shared subject instead of padded out on their own, the way
        the Pharmacology drug classes did.
      </p>

      {thin.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <ExportCsvButton
            filename="content-gaps.csv"
            headers={["Subject", "Module", "Question count"]}
            rows={thin.map((t) => [t.subject, t.moduleName, t.count])}
          />
        </div>
      )}

      {thin.length === 0 ? (
        <p className="muted">Nothing under {THIN_TOPIC_THRESHOLD} questions right now.</p>
      ) : (
        <div className="tile-stack">
          {thin.map((t) => (
            <div
              key={t.subject}
              className="card"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}
            >
              <div>
                <p className="tile-title" style={{ marginBottom: "0.15rem" }}>{t.subject}</p>
                <p className="tile-meta">{t.moduleName}</p>
              </div>
              <span className="status-badge status-badge-open">
                {t.count} question{t.count === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      )}

      <Link href="/dashboard" className="back-link">&larr; Back to dashboard</Link>
    </div>
  );
}
