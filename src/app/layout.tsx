import type { Metadata, Viewport } from "next";
import { Bungee, Outfit } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/lib/site";
import "./globals.css";

const bungee = Bungee({ variable: "--font-bungee", weight: "400", subsets: ["latin"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

const description = `Wager on SolPump with code ${site.referralCode} and race the ZeeDude community for a weekly SOL prize pool.`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "SolPump Wager Leaderboard | ZeeDude", template: "%s | ZeeDude Rewards" },
  description,
  openGraph: {
    type: "website",
    siteName: site.name,
    title: "ZeeDude SolPump Wager Leaderboard",
    description,
  },
  twitter: { card: "summary_large_image", title: "ZeeDude SolPump Wager Leaderboard", description },
  icons: { icon: "/brand/zeedude-logo.webp" },
};

export const viewport: Viewport = {
  themeColor: "#07050d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bungee.variable} ${outfit.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-gold px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
