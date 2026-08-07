import Link from "next/link";
import Image from "next/image";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
        <Image src="/logo.png" alt="LPN Launchpad" width={34} height={34} priority />
        <span className="wordmark">
          LPN <span>Launchpad</span>
        </span>
      </Link>
    </header>
  );
}
