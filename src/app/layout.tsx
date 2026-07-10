import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
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
  title: "BrowserOps — Resilient Browser Automation",
  description:
    "AI-powered browser automation platform with self-healing workflows, Human-in-the-Loop recovery, session replay, scheduling, and resilient Playwright execution.",
  keywords: [
    "browser automation",
    "workflow builder",
    "self-healing",
    "playwright",
    "HITL",
    "session replay",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#D4AF37",
          colorBackground: "#0A0A0B",
          borderRadius: "0.75rem",
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-[var(--obsidian)]">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
