import Link from "next/link";
import Image from "next/image";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import ProfileMenu from "@/components/profile-menu";
import MobileNavMenu, { type NavLinkItem } from "@/components/mobile-nav-menu";
import { getThinTopics } from "@/lib/content-gaps";
import { getViewer, canReviewStudents, getSchoolUserIds } from "@/lib/roles";

export default async function SiteHeader() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const viewer = user ? await getViewer(supabase, user) : null;
  const canReview = !!viewer && canReviewStudents(viewer.role);
  const isAdmin = viewer?.role === "admin";

  // Only fetched for instructor/admin accounts, students never pay this cost. This is the
  // in-app stand-in for real notifications until email or push is worth setting up. Admin
  // sees counts across every school; an instructor's counts are scoped to their own school's
  // students, same as the pages these badges link to.
  let openHandsCount = 0;
  let thinTopicsCount = 0;
  let feedbackCount = 0;
  if (canReview && viewer) {
    const admin = createAdminClient();
    const studentIds = viewer.role === "instructor" ? await getSchoolUserIds(admin, viewer.schoolId) : null;
    const scoped = studentIds !== null ? (studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"]) : null;

    let openHandsQuery = admin.from("raised_hands").select("id", { count: "exact", head: true }).eq("status", "open");
    let newFeedbackQuery = admin.from("app_feedback").select("id", { count: "exact", head: true }).eq("status", "new");
    let openFlagsQuery = admin.from("question_flags").select("id", { count: "exact", head: true }).eq("status", "open");
    if (scoped) {
      openHandsQuery = openHandsQuery.in("user_id", scoped);
      newFeedbackQuery = newFeedbackQuery.eq("sender_role", "student").in("user_id", scoped);
      openFlagsQuery = openFlagsQuery.eq("sender_role", "student").in("user_id", scoped);
    }

    const [openHandsResult, newFeedbackResult, openFlagsResult] = await Promise.all([
      openHandsQuery,
      newFeedbackQuery,
      openFlagsQuery,
    ]);
    openHandsCount = openHandsResult.count ?? 0;
    feedbackCount = (newFeedbackResult.count ?? 0) + (openFlagsResult.count ?? 0);

    if (isAdmin) {
      const thinTopics = await getThinTopics(admin);
      thinTopicsCount = thinTopics.length;
    }
  }

  const navLinks: NavLinkItem[] = [
    { href: "/help", label: "Help" },
    { href: "/inbox", label: "Inbox" },
    { href: "/feedback", label: "Feedback" },
    ...(canReview
      ? [
          { href: "/admin/inbox", label: "Review inbox", badge: openHandsCount },
          { href: "/admin/feedback", label: "Review feedback", badge: feedbackCount },
        ]
      : []),
    ...(isAdmin ? [{ href: "/admin/content-gaps", label: "Content gaps", badge: thinTopicsCount }] : []),
  ];

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
            {navLinks.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
                {!!l.badge && <span className="nav-badge">{l.badge}</span>}
              </Link>
            ))}
          </nav>
          <MobileNavMenu links={navLinks} />
          <ProfileMenu email={user.email} />
        </div>
      )}
    </header>
  );
}
