import { Syne, Space_Grotesk, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import Script from "next/script";
import Nav from "@/components/Nav.jsx";
import { SITE } from "@/lib/site.js";
import "./globals.css";
import "./motion.css";

const syne = Syne({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-syne", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-space-grotesk", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });

export const metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.name, template: `%s | ${SITE.name}` },
  description: SITE.description,
  icons: {
    icon: [
      { url: "/assets/img/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/assets/img/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/assets/img/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/assets/img/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/assets/img/apple-touch-icon.png",
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${syne.variable} ${spaceGrotesk.variable} ${inter.variable}`}>
      <body>
        <div className="wrap">
          <Nav />
          {children}
        </div>
        <Analytics />
        {process.env.NEXT_PUBLIC_GA_ID && <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />}
        {process.env.NEXT_PUBLIC_UMAMI_ID && (
          <Script src="https://cloud.umami.is/script.js" data-website-id={process.env.NEXT_PUBLIC_UMAMI_ID} strategy="afterInteractive" />
        )}
      </body>
    </html>
  );
}
