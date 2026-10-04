import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

import { localeFromCookieHeader } from "~/i18n/config";
import { translatorFor } from "~/i18n/server";
import {
  cardFromDocument,
  MAX_DOCUMENT_BYTES,
  type DocumentInput,
} from "~/server/admin/card-from-document";
import { STAFF_COOKIE, verifyStaffSession } from "~/server/auth/session";

export const runtime = "nodejs";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
export const maxDuration = 120;

/**
 * „Dodaj z dokumentu": POST multipart form data — `kind` = pdf | text | url,
 * with `file`, `text` or `url`. ROPS staff only. Returns the drafted card
 * (each field with its quote, always in Polish) or a message in the staff
 * member's language.
 */
export async function POST(req: NextRequest) {
  const locale = localeFromCookieHeader(req.headers.get("cookie"));
  const t = translatorFor(locale, "admin");
  const staff = await verifyStaffSession(
    (await cookies()).get(STAFF_COOKIE)?.value,
  );
  if (staff?.role !== "rops")
    return Response.json(
      { ok: false, message: t("document.login") },
      { status: 401 },
    );

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json(
      { ok: false, message: t("document.badForm") },
      { status: 400 },
    );
  }
  const kind = str(form.get("kind"));
  let input: DocumentInput;
  if (kind === "pdf") {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0)
      return Response.json(
        { ok: false, message: t("document.chooseFile") },
        { status: 400 },
      );
    if (file.size > MAX_DOCUMENT_BYTES)
      return Response.json(
        { ok: false, message: t("document.tooBig") },
        { status: 413 },
      );
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    input = { kind: "pdf", base64, filename: file.name.slice(0, 200) };
  } else if (kind === "text") {
    input = { kind: "text", text: str(form.get("text")).slice(0, 200_000) };
  } else if (kind === "url") {
    input = { kind: "url", url: str(form.get("url")).trim() };
  } else {
    return Response.json(
      { ok: false, message: t("document.chooseSource") },
      { status: 400 },
    );
  }

  const res = await cardFromDocument(input, locale);
  return Response.json(res, {
    status: res.ok ? 200 : res.reason === "input" ? 400 : 200,
  });
}
