import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaProvider } from "@/components/public/pwa-provider";
import { cookies } from 'next/headers';
import { I18nProvider, type Language } from "@/lib/i18n/i18n-provider";

export const metadata: Metadata = {
  title: "NEXPOS — Enterprise Retail Operating System for Tanzania",
  description: "NEXPOS: Multi-branch inventory, offline-first POS, and automated reconciliation built for Tanzanian retail operations.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#25C26E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialLang = (cookieStore.get('nx_lang')?.value || 'en') as Language;

  return (
    <html lang={initialLang}>
      <body className="antialiased">
        <PwaProvider>
          <I18nProvider initialLanguage={initialLang}>
            {children}
          </I18nProvider>
        </PwaProvider>
      </body>
    </html>
  );
}

