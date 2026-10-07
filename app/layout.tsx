import {I18nProvider} from '@/lib/i18n/react';
import {resolveLocale,locales} from '@/lib/i18n';
import {cookies} from 'next/headers';
import {LANGUAGE_COOKIE} from '@/lib/i18n/preference';
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Noracre CRM",
  description: "Kunder, oppfølging og salg samlet på ett sted.",
  icons: { icon: "/favicon.svg" },
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale=resolveLocale((await cookies()).get(LANGUAGE_COOKIE)?.value);
  return (
    <html lang={locale} dir={locales[locale].direction}>
      <body><I18nProvider locale={locale}>{children}</I18nProvider></body>
    </html>
  );
}
