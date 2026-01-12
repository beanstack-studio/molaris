import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import TopNavWrapper from "@/components/TopNavWrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MDS Clinic Portal",
  description: "Manage patient records and appointments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <TopNavWrapper />
        {children}
      </body>
    </html>
  );
}
