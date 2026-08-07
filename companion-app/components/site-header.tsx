import Link from "next/link";
import Image from "next/image";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import ProfileMenu from "@/components/profile-menu";
import { getThinTopics } from "@/lib/content-gaps";

export default async function SiteHeader() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = !!user?.email && !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;

  // Only fetched for the admin account, students never pay this cost. This is the in-app
  // stand-in for real notifications until email or push is worth setting up.
  let openHandsCount = 0;
  let thinTopicsCount = 0;
  if (isAdmin) {
    const admin = createAdminClient();
    const [openHandsResult, thinTopics] = await Promise.all([
      admin.from("raised_hands").select("id", { count: "exact", head: true }).eq("status", "open"),
      getThinTopics(admin),
    ]);
    openHandsCount = openHandsResult.count ?? 0;
    thinTopicsCount = thinTopics.length;
  }

  return (
    <header className="site-header">
      <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
        <Image src="/logo.png" alt="LPN Launchpad" width={34} height={34} priority />
        <span className="wordmark">
          LPN <span>Launchpad</span>
        </span>
      </Link>
      {user?.email && (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <nav className="header-nav">
            <Link href="/help">Help</Link>
            <Link href="/inbox">Inbox</Link>
            {isAdmin && (
              <Link href="/admin/inbox">
                Review inbox
                {openHandsCount > 0 && <span className="nav-badge">{openHandsCount}</span>}
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin/content-gaps">
                Content gaps
                {thinTopicsCount > 0 && <span className="nav-badge">{thinTopicsCount}</span>}
              </Link>
            )}
          </nav>
          <ProfileMenu email={user.email} />
        </div>
      )}
    </header>
  );
}
