import type { Metadata, Viewport } from "next";
import { Cinzel, Outfit } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Royale 21 — Private Blackjack Club",
  description:
    "Premium blackjack with casino rules, private accounts, computer opponents, and live multiplayer tables.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${outfit.variable} antialiased`}
    >
      <body>
        <div className="scene" aria-hidden>
          <div className="noise" />
        </div>
        <div className="app">{children}</div>
      </body>
    </html>
  );
}
