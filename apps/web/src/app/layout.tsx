import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AetherMind — AI Multi-Agent Workspace & Knowledge Graph",
  description:
    "Real-time multi-agent orchestration, hybrid vector search, and interactive Knowledge Graph workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#06090f] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
