import "~/styles/globals.css";

import { type Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Red_Hat_Display } from "next/font/google";

import { SiteFooter } from "~/components/layout/site-footer";
import { SiteHeader } from "~/components/layout/site-header";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";
import { SITE } from "~/lib/domain";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} — ${SITE.hub}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.tagline,
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

/** Atkinson Hyperlegible Next (Braille Institute) for reading; Red Hat Display (ROPS) for headings. */
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  variable: "--font-atkinson",
  display: "swap",
  adjustFontFallback: false,
});
const redhat = Red_Hat_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-redhat",
  display: "swap",
});

/** Applies saved A+/contrast preferences before paint (no flash). Storage may be blocked. */
const prefsScript = `try{var d=document.documentElement;var t=localStorage.getItem("jd_text_size");if(t)d.dataset.textSize=t;var c=localStorage.getItem("jd_contrast");if(c)d.dataset.contrast=c;var e=localStorage.getItem("jd_easy");if(e)d.dataset.easy=e;}catch(_){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pl"
      className={`${atkinson.variable} ${redhat.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="focus:bg-background focus:text-foreground sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-4 focus:py-3"
        >
          Przejdź do treści
        </a>
        <TRPCReactProvider>
          <TooltipProvider>
            <SiteHeader />
            <main id="main" tabIndex={-1} className="flex-1 outline-none">
              {children}
            </main>
            <SiteFooter />
            <Toaster />
          </TooltipProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
