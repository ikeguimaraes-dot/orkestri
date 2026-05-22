import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KPH OS",
  description: "Sistema operacional do grupo KPH — hospitalidade premium.",
  manifest: "/manifest.json",
  // appleWebApp.capable=false impede iOS de oferecer "Add to Home Screen"
  // como app standalone — homescreen vira bookmark Safari, mantendo
  // localStorage compartilhado e sessão Supabase persistente.
  // (PWA standalone tem storage isolado que quebra @supabase/ssr.)
  appleWebApp: {
    capable: false,
    title: "KPH Ponto",
  },
};

export const viewport: Viewport = {
  themeColor: "#D4A574",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground flex flex-col">
        {children}
      </body>
    </html>
  );
}
