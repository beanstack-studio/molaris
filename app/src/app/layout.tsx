import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import AppShell from "@/components/layout/AppShell";
import { ClinicProvider } from "@/contexts/ClinicContext";
import { DevOverrideProvider } from "@/contexts/DevOverrideContext";
import { PWAUpdateBanner } from "@/components/shared/PWAUpdateBanner";
import { DevViewToggle } from "@/components/dev/DevViewToggle";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
};

export const viewport = {
  themeColor: "#0f172a",
};

const isDev = process.env.NEXT_PUBLIC_DEV_TOOLS === "true";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent dark-mode flash: set class before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('molaris_theme');if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${mono.variable} antialiased`}>
        <PWAUpdateBanner />
        {isDev ? (
          <DevOverrideProvider>
            <ClinicProvider>
              <AppShell>{children}</AppShell>
              <DevViewToggle />
            </ClinicProvider>
          </DevOverrideProvider>
        ) : (
          <ClinicProvider>
            <AppShell>{children}</AppShell>
          </ClinicProvider>
        )}
      </body>
    </html>
  );
}
