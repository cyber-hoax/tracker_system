"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/dsa", label: "DSA" },
  { href: "/patterns", label: "Patterns" },
  { href: "/graph", label: "Graph" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-ctp-surface0 bg-ctp-mantle">
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-3 px-5 py-3">
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-ctp-overlay0 hover:text-ctp-mauve"
        >
          SDE tracker
        </Link>
        <nav aria-label="Primary" className="flex flex-wrap items-center">
          {LINKS.map((link, index) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`powerline-seg font-mono text-xs ${
                  active
                    ? "bg-ctp-mauve text-ctp-crust"
                    : "bg-ctp-surface0 text-ctp-subtext0 hover:bg-ctp-surface1 hover:text-ctp-text"
                } ${index === 0 ? "powerline-seg-first" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
