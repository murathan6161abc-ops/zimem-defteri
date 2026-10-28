import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import BottomNav from "@/components/layout/BottomNav";
import ScanWatcher from "@/components/scan/ScanWatcher";
import ToastHost from "@/components/ui/ToastHost";
import AuthGate from "@/components/auth/AuthGate";
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import { I18nProvider } from "@/lib/i18n";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

function buildContentSecurityPolicy(): string | null {
  if (process.env.NODE_ENV !== 'production') return null;

  const connectSources = ["'self'"];
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (configuredUrl) {
    try {
      const origin = new URL(configuredUrl).origin;
      connectSources.push(origin, origin.replace(/^https:/, 'wss:'));
    } catch {
      // Invalid configuration is handled by the client; keep the CSP closed.
    }
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    `connect-src ${connectSources.join(' ')}`,
    "worker-src 'self' blob:",
    "media-src 'self'",
    "manifest-src 'self'",
  ].join('; ');
}

const contentSecurityPolicy = buildContentSecurityPolicy();

export const metadata: Metadata = {
  title: "Dijital Zimem Defteri",
  description: "Kadim İyilik, Dijital İz — anonim, sosyal iyilik platformu.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#1d2436",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={`${inter.variable} h-full antialiased`}>
      <head>
        {contentSecurityPolicy && (
          <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy} />
        )}
        <meta name="referrer" content="no-referrer" />
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider>
          <Header />
          <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-5 pb-16">
            <AuthGate>{children}</AuthGate>
          </main>
          <ToastHost />
          <OnboardingModal />
          <Footer />
          <BottomNav />
          <ScanWatcher />
        </I18nProvider>
      </body>
    </html>
  );
}
