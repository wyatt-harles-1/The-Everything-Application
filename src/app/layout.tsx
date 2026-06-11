import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { readPreferences } from "@/lib/preferences/server";
import { htmlThemeAttrs } from "@/lib/preferences/cookie";
import { RegisterSW } from "@/components/pwa/RegisterSW";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kosmos",
  description: "Your whole life, in one place.",
  applicationName: "Kosmos",
  appleWebApp: { capable: true, title: "Kosmos", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Browser chrome color follows the OS scheme (the in-app theme is separate).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

// Pre-paint theme resolver. The <html> attributes are already set server-side
// from the cookie, so concrete themes (light/dark/amoled) need nothing. The
// ONLY job here is "system": read the OS preference synchronously and upgrade
// data-theme before the browser paints, so a system-dark user never sees a
// light flash. Runs as the first thing in <body> so it executes during HTML
// parse, ahead of content paint.
const themeScript = `(function(){try{var e=document.documentElement;if(e.getAttribute('data-theme-pref')==='system'){var d=window.matchMedia('(prefers-color-scheme: dark)').matches;e.setAttribute('data-theme',d?'dark':'light');}}catch(_){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const prefs = await readPreferences();
  const attrs = htmlThemeAttrs(prefs);

  return (
    // suppressHydrationWarning: the pre-paint script may flip data-theme
    // (system → dark) before React hydrates, which would otherwise trip a
    // mismatch warning on <html>. Scoped to this element only.
    <html
      lang="en"
      suppressHydrationWarning
      {...attrs}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
