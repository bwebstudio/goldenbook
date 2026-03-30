import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Goldenbook",
  description: "Goldenbook management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${roboto.className} h-full`}>
      <body className="h-full bg-surface">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
