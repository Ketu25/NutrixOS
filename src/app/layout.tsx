import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, themeInitScript } from "@/components/system/ThemeProvider";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NutrixOS — AI Nutrition Copilot",
  description:
    "Tell it what you ate. NutrixOS tracks, understands, and adapts your nutrition to your goal.",
  appleWebApp: { capable: true, title: "NutrixOS", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  // The app is a full-height surface with its own scroll containers; letting
  // the page zoom or rubber-band breaks the fixed tab bar on iOS.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#16181d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The init script below stamps `data-theme` on this element before React
    // hydrates, so the server and client markup differ here by design. Scoped
    // to <html> only — it suppresses the warning for this element's attributes,
    // not for the tree underneath it.
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before first paint, so a dark-mode user
            never sees a white flash on load. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
