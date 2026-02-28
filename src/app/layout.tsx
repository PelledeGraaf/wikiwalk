import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WikiWalk - Ontdek Wikipedia op de kaart",
  description:
    "Verken Wikipedia artikelen op een interactieve kaart. Ontdek gebouwen, monumenten, natuur en meer in je omgeving.",
  keywords: ["wikipedia", "kaart", "wandelen", "ontdekken", "geo", "monument"],
  manifest: "/manifest.json",
  openGraph: {
    title: "WikiWalk - Ontdek Wikipedia op de kaart",
    description:
      "Verken Wikipedia artikelen op een interactieve kaart. Ontdek gebouwen, monumenten, natuur en meer in je omgeving.",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WikiWalk",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('wikiwalk-theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
