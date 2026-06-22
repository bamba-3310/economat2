import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
// Bilingual (FR/EN) support: wraps the whole app so any component can read the
// current language via useI18n(). Added during the bilingual pass.
import { LanguageProvider } from "@/lib/i18n";
// Configurable restaurant name. BrandingProvider exposes useBranding() and
// updates the tab title at runtime; the static metadata below uses the default.
import { BrandingProvider, DEFAULT_RESTAURANT_NAME } from "@/lib/branding";

// Primary UI typeface for the redesign. Exposed as --font-sans (consumed by the
// new design system in globals.css). Geist/Geist Mono are kept: Geist Mono still
// styles lot codes / QR values (--font-geist-mono) in not-yet-converted views.
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: DEFAULT_RESTAURANT_NAME,
  description: "Application de gestion d'économat et de stock.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${sans.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <BrandingProvider>{children}</BrandingProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
