import {I18nProvider} from '@/lib/i18n/react';
import {DEFAULT_LOCALE,locales} from '@/lib/i18n';
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Noracre CRM",
  description: "Kunder, oppfølging og salg samlet på ett sted.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={DEFAULT_LOCALE} dir={locales[DEFAULT_LOCALE].direction}>
      <body><I18nProvider>{children}</I18nProvider></body>
    </html>
  );
}
