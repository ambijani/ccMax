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
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-slate-100">
          CC Optimizer
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "text-indigo-400"
                  : "text-slate-400 hover:text-slate-200"
              }
            >
              {link.label}
            </Link>
          ))}
          <form action={signOut}>
            <button type="submit" className="text-slate-500 hover:text-slate-300">
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
