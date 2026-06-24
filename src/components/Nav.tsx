"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";

export default function Nav() {
  const pathname = usePathname();
  if (pathname?.startsWith("/login")) return null;

  const links = [
    { href: "/", label: "Lookup" },
    { href: "/cards", label: "My Cards" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <header className="sticky top-0 z-10 border-b border-ledger-800 bg-ledger-950/90 backdrop-blur">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-y-2 px-4 py-4">
        <Link href="/" className="shrink-0 font-display text-sm font-medium tracking-[0.2em] text-ink-100 uppercase">
          Ledger<span className="text-foil">·</span>Optimizer
        </Link>
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs tracking-wide uppercase sm:gap-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "text-foil"
                  : "text-ink-500 hover:text-ink-100"
              }
            >
              {link.label}
            </Link>
          ))}
          <form action={signOut}>
            <button
              type="submit"
              className="font-mono text-xs tracking-wide text-ink-500 uppercase hover:text-alert"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
