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
    <html lang="nb">
      <body>{children}</body>
    </html>
  );
}
