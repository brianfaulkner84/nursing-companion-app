import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import ProfileMenu from "@/components/profile-menu";

export default async function SiteHeader() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="site-header">
      <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
        <Image src="/logo.png" alt="LPN Launchpad" width={34} height={34} priority />
        <span className="wordmark">
          LPN <span>Launchpad</span>
        </span>
      </Link>
      {user?.email && <ProfileMenu email={user.email} />}
    </header>
  );
}
