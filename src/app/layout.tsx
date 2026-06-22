import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Credit Card Optimizer",
  description: "Pick the right card for every purchase.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${plexMono.variable} ${publicSans.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-ledger-950 text-ink-100">
        <Nav />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
