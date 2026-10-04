import "~/styles/globals.css";

import { type Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Red_Hat_Display } from "next/font/google";

import { SiteFooter } from "~/components/layout/site-footer";
import { SiteHeader } from "~/components/layout/site-header";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";
import { env } from "~/env";
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

/**
 * Browser translation (Chrome „Przetłumacz", Edge, Safari) swaps text nodes for <font>
 * wrappers. When React later removes or moves a node it no longer owns, removeChild /
 * insertBefore throw and the whole page turns into „Application error" — it happened on
 * /match the moment AI verification replaced the preliminary results. Tolerate the
 * mismatch (facebook/react#11538) so the site keeps working for residents who read it
 * translated, instead of blocking translation for them.
 */
const translateGuardScript = `(function(){if(typeof Node!=="function"||!Node.prototype)return;var rm=Node.prototype.removeChild;Node.prototype.removeChild=function(c){if(c&&c.parentNode!==this){if(c.parentNode)rm.call(c.parentNode,c);return c;}return rm.apply(this,arguments);};var ins=Node.prototype.insertBefore;Node.prototype.insertBefore=function(n,r){if(r&&r.parentNode!==this)return ins.call(this,n,null);return ins.apply(this,arguments);};})();`;

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
        <script dangerouslySetInnerHTML={{ __html: translateGuardScript }} />
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
            {env.DEMO_MODE === "1" && (
              <p className="bg-warning-bg text-foreground border-hairline border-b px-4 py-1.5 text-center text-sm leading-snug [overflow-wrap:anywhere]">
                Wersja demonstracyjna — nie wpisuj prawdziwych danych.
              </p>
            )}
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
