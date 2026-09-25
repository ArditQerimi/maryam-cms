import type { Metadata } from "next";
import { Inter, Spectral } from "next/font/google";
import "./globals.css";
import AppToaster from "@/components/ui/AppToaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// The storefront (copied from point-of-sale) styles itself with
// `var(--font-spectral)`, so the root layout must always provide it.
const spectral = Spectral({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-spectral",
});

export const metadata: Metadata = {
  title: {
    default: "Maryam CMS",
    template: "%s | Maryam CMS",
  },
  description:
    "Maryam CMS — content, themes and commerce management for your storefront.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq" className={`${inter.variable} ${spectral.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
