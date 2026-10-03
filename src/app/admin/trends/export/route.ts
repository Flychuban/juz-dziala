import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

import { MAPA_AREA_LABEL, mapaAreaSchema } from "~/lib/domain";
import {
  loadNeeds,
  powiatName,
  summarize,
  TREND_DAYS,
} from "~/server/admin/trends";
import { STAFF_COOKIE, verifyStaffSession } from "~/server/auth/session";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

const cell = (v: string | number) => {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/**
 * CSV of needs by week × Mapa area × powiat (ROPS only). Semicolon-separated
 * with a UTF-8 BOM, so it opens correctly in a Polish Excel.
 */
export async function GET(req: NextRequest) {
  const staff = await verifyStaffSession(
    (await cookies()).get(STAFF_COOKIE)?.value,
  );
  if (staff?.role !== "rops")
    return new Response("Zaloguj się jako pracownik ROPS.", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const area = mapaAreaSchema.safeParse(sp.get("area"));
  const daysRaw = Number(sp.get("days") ?? 30);
  const days = (TREND_DAYS as readonly number[]).includes(daysRaw)
    ? daysRaw
    : 30;
  const { cells } = summarize(
    await loadNeeds(db, { days, area: area.success ? area.data : null }),
  );

  const header = [
    "tydzień od",
    "obszar (kod)",
    "obszar",
    "powiat (TERYT)",
    "powiat",
    "potrzeby",
    "bez dopasowania",
  ];
  const lines = cells.map((c) =>
    [
      c.week,
      c.area,
      c.area === "none"
        ? "bez obszaru"
        : MAPA_AREA_LABEL[c.area as keyof typeof MAPA_AREA_LABEL],
      c.powiat,
      powiatName(c.powiat || null),
      c.count,
      c.unmet,
    ]
      .map(cell)
      .join(";"),
  );
  const csv = `﻿${header.join(";")}\n${lines.join("\n")}\n`;
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="potrzeby-${days}dni-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
