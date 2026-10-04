import { type NextRequest } from "next/server";

import { localeFromCookieHeader } from "~/i18n/config";
import { translatorFor } from "~/i18n/server";

/**
 * Machine-readable description of the service (ustawa o zapewnianiu
 * dostępności, art. 6 pkt 3 lit. c). English when the jd_lang cookie is "en",
 * Polish otherwise; the text lives in messages/<lang>/legal.json.
 */
export function GET(req: NextRequest) {
  const locale = localeFromCookieHeader(req.headers.get("cookie"));
  const text = translatorFor(locale, "legal")("about.text");
  return new Response(text, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-language": locale,
      vary: "Cookie",
    },
  });
}
