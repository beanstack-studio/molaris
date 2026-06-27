import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { PWAUpdateBanner } from "@/components/shared/PWAUpdateBanner";
import { AppProviders } from "./AppProviders";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Molaris — Clinic Portal",
  description: "Clinic management portal by Molaris",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "hsl(205, 52%, 72%)" },
    { media: "(prefers-color-scheme: dark)",  color: "#0f172a" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${mono.variable} antialiased`}>
        <PWAUpdateBanner />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
