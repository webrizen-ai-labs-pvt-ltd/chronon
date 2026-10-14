import type { Metadata, Viewport } from "next";
import { Averia_Libre, Martian_Mono } from "next/font/google";
import { Ambient } from "@/components/ambient";
import { SmoothScroll } from "@/components/smooth-scroll";
import { site } from "@/lib/site";
import { Providers } from "./providers";
import "./globals.css";

const averia = Averia_Libre({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  style: ["normal", "italic"],
  variable: "--font-averia",
  display: "swap",
});

const martian = Martian_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-martian",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: "Chronon: free utility APIs by Webrizen", template: "%s · Chronon" },
  description:
    "Free, open-source utility APIs built and hosted by Webrizen AI Labs. Sign in, create a key, make your first request in under a minute.",
  applicationName: "Chronon",
  openGraph: { siteName: "Chronon", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#0F1220" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${averia.variable} ${martian.variable}`}>
      <body className="min-h-dvh">
        <noscript>
          <style>{"[data-reveal]{opacity:1;transform:none}"}</style>
        </noscript>
        <Providers>{children}</Providers>
        <Ambient />
        <SmoothScroll />
      </body>
    </html>
  );
}
