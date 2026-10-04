import { createHash, timingSafeEqual } from "node:crypto";

import { and, asc, gt, inArray, type SQL } from "drizzle-orm";
import { type NextRequest } from "next/server";

import { SITE } from "~/lib/domain";
import { db } from "~/server/db";
import { cases, events } from "~/server/db/schema";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/**
 * Bearer token check against INTEGRATION_TOKEN, compared in constant time.
 * Read straight from process.env: the variable is optional and, while it is
 * not set, the endpoint stays closed (401) instead of open.
 */
function authorized(req: NextRequest): boolean {
  const expected = process.env.INTEGRATION_TOKEN?.trim();
  if (!expected) return false;
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") ?? "");
  if (!m?.[1]) return false;
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(m[1].trim()), digest(expected));
}

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/**
 * Integration API for other systems of the Hub (e.g. the grant database): the
 * outbox of domain events (jd_event, written by notify()), oldest first.
 *
 *   GET /api/v1/events?since=<ISO date>&after=<event id>&limit=<1–500>
 *   Authorization: Bearer <INTEGRATION_TOKEN>
 *
 * No personal data leaves through here: no text, no contact, no case code
 * (a code opens the case page) and no person ids — only the event type, ids,
 * timestamps and the case's kind, Mapa areas, status and sample flag. Page
 * with `after` = the last `id` you received (`next.after`).
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json(
      {
        error: "unauthorized",
        message:
          "Wymagany nagłówek Authorization: Bearer <INTEGRATION_TOKEN> (Authorization: Bearer <INTEGRATION_TOKEN> is required).",
      },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Bearer realm="jd-events"',
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const sp = req.nextUrl.searchParams;
  const sinceRaw = sp.get("since");
  const since = sinceRaw ? new Date(sinceRaw) : null;
  if (since && Number.isNaN(since.getTime())) {
    return Response.json(
      {
        error: "bad_request",
        message:
          "Parametr since musi być datą ISO 8601, np. 2026-10-01T00:00:00Z (since must be an ISO 8601 date).",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const afterRaw = sp.get("after");
  const after = afterRaw && /^\d{1,12}$/.test(afterRaw) ? Number(afterRaw) : null;
  const limitRaw = Number(sp.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isInteger(limitRaw)
    ? Math.min(MAX_LIMIT, Math.max(1, limitRaw))
    : DEFAULT_LIMIT;

  const where: SQL[] = [];
  if (since) where.push(gt(events.createdAt, since));
  if (after !== null) where.push(gt(events.id, after));
  const rows = await db
    .select()
    .from(events)
    .where(where.length ? and(...where) : undefined)
    .orderBy(asc(events.id))
    .limit(limit);

  const caseIds = [
    ...new Set(
      rows.flatMap((r) => {
        const id = str((r.payload as Record<string, unknown>).caseId);
        return id && /^[0-9a-f-]{36}$/i.test(id) ? [id] : [];
      }),
    ),
  ];
  const caseRows = caseIds.length
    ? await db
        .select({
          id: cases.id,
          kind: cases.kind,
          areas: cases.areas,
          status: cases.status,
          isSample: cases.isSample,
        })
        .from(cases)
        .where(inArray(cases.id, caseIds))
    : [];
  const caseById = new Map(caseRows.map((c) => [c.id, c]));

  const data = rows.map((r) => {
    const p = r.payload as Record<string, unknown>;
    const caseId = str(p.caseId);
    const c = caseId ? caseById.get(caseId) : undefined;
    const assignee = str(p.assigneeId);
    return {
      id: r.id,
      type: r.type,
      createdAt: r.createdAt.toISOString(),
      processedAt: r.processedAt?.toISOString() ?? null,
      caseId: caseId ?? null,
      case: c
        ? { kind: c.kind, areas: c.areas, status: c.status, isSample: c.isSample }
        : null,
      // Only what the event is about — never names, texts or person ids.
      ...(str(p.status) ? { status: str(p.status) } : {}),
      ...(str(p.authorKind) ? { authorKind: str(p.authorKind) } : {}),
      ...(str(p.messageId) ? { messageId: str(p.messageId) } : {}),
      ...(str(p.callId) ? { callId: str(p.callId) } : {}),
      ...(str(p.innovationId) ? { innovationId: str(p.innovationId) } : {}),
      ...(r.type === "case.assigned" || r.type === "case.triaged"
        ? {
            assignedTo: assignee
              ? assignee === "rops"
                ? "rops"
                : "expert"
              : null,
          }
        : {}),
    };
  });

  const last = rows.at(-1);
  return Response.json(
    {
      source: {
        name: "Już Działa — zdarzenia (outbox)",
        publisher: SITE.owner,
      },
      generatedAt: new Date().toISOString(),
      count: data.length,
      // Page by id: ids only grow, timestamps of seeded rows may not.
      next: last && rows.length === limit ? { after: last.id } : null,
      data,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
