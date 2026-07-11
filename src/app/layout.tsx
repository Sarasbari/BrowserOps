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
          colorInputBackground: "#1A1A1D",
          colorInputText: "#FFFFFF",
          colorText: "#FFFFFF",
          colorTextSecondary: "#9CA3AF",
          borderRadius: "0.75rem",
        },
        elements: {
          card: "border border-[#D4AF37]/20 shadow-[0_0_20px_rgba(212,175,55,0.05)]",
          headerTitle: "text-white",
          headerSubtitle: "text-gray-400",
          socialButtonsBlockButton: "border-[#D4AF37]/20 hover:bg-[#1A1A1D]",
          socialButtonsBlockButtonText: "text-white",
          dividerLine: "bg-[#D4AF37]/20",
          dividerText: "text-gray-400",
          formFieldLabel: "text-gray-300",
          formFieldInput: "border-[#D4AF37]/20 focus:border-[#D4AF37] focus:ring-[#D4AF37]/20",
          footerActionText: "text-gray-400",
          footerActionLink: "text-[#D4AF37] hover:text-[#F3E5AB]",
        }
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
