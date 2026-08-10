"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type NavLinkItem = { href: string; label: string; badge?: number };

// The header's horizontal link row (.header-nav) grows with every admin feature and stops
// fitting a phone screen. Below the CSS breakpoint that hides .header-nav, this hamburger
// takes over as the only way to reach those same links -- same click-outside-to-close pattern
// as ProfileMenu, kept as its own component since this is about navigation, not the account.
export default function MobileNavMenu({ links }: { links: NavLinkItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="mobile-nav-menu" ref={ref}>
      <button
        className="mobile-nav-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
      >
        <span />
        <span />
        <span />
      </button>
      {open && (
        <div className="mobile-nav-dropdown">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
              {l.badge ? <span className="nav-badge">{l.badge}</span> : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
