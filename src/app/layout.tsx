import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, JetBrains_Mono, Pixelify_Sans } from "next/font/google";
import "./globals.css";
import { profile } from "@/data/profile";
import { siteDescription, siteTitle, siteUrl } from "@/lib/site";

const pixel = Pixelify_Sans({ subsets: ["latin"], variable: "--ff-pixel", display: "swap" });
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--ff-body",
  display: "swap",
  weight: ["400", "500", "600"],
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--ff-mono",
  display: "swap",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: `%s · ${profile.displayName}` },
  description: siteDescription,
  applicationName: "DhirajOS",
  authors: [{ name: profile.name, url: profile.github.url }],
  creator: profile.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "DhirajOS — Dhiraj Reddy's portfolio",
    title: siteTitle,
    description: siteDescription,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "DhirajOS — a retro desktop portfolio for Dhiraj Reddy, AI / Software Engineer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a1020",
  colorScheme: "dark",
};

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  alternateName: profile.displayName,
  jobTitle: profile.role,
  description: profile.summary,
  url: siteUrl,
  sameAs: [profile.github.url, profile.linkedin, profile.blog.url],
  address: { "@type": "PostalAddress", addressLocality: "Hyderabad", addressRegion: "Telangana", addressCountry: "IN" },
  knowsAbout: ["Artificial intelligence", "Machine learning", "Generative AI", "AI agents", "Retrieval-augmented generation", "Computer vision", "Backend engineering", "Python", "FastAPI"],
};

/** Runs before first paint: returning visitors skip the boot overlay with no flash. */
const bootFlag = `try{var d=document.documentElement;if(localStorage.getItem('dhirajos:booted')==='1'||/[?&]skipboot/.test(location.search))d.dataset.boot='skip'}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${pixel.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootFlag }} />
      </head>
      <body>
        {children}
        <noscript>
          <style>{`.boot-screen{display:none!important}`}</style>
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c") }}
        />
      </body>
    </html>
  );
}
