import type { Metadata, Viewport } from "next";
import { Overpass } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { APP_NAME, GROUND, SITE_URL, TAGLINE } from "@/lib/config";

import "./globals.css";

// Overpass descends from Highway Gothic, the lettering on road signs, which is
// the whole of Bin Night's voice.
const overpass = Overpass({ subsets: ["latin"], variable: "--font-overpass" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: APP_NAME,
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: TAGLINE,
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, statusBarStyle: "default", title: APP_NAME },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: GROUND.light },
    { media: "(prefers-color-scheme: dark)", color: GROUND.dark },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${overpass.variable} h-full`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
