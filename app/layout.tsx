import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { ProgressBar } from "@/components/providers/progress-bar";
import { QueryProvider } from "@/components/providers/query-provider";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "CoWork — Collaborative Workspace Platform",
    template: "%s — CoWork",
  },
  description:
    "A local-first, real-time collaborative workspace for teams. Edit offline, propose changes, review history.",
  openGraph: {
    siteName: "CoWork",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col bg-background text-foreground">
        <AuthSessionProvider>
          <QueryProvider>
            <TooltipProvider>
              <Suspense fallback={null}>
                <ProgressBar />
              </Suspense>
              {children}
              <Toaster richColors position="bottom-right" />
            </TooltipProvider>
          </QueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
