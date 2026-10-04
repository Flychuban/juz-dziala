import { TRPCError } from "@trpc/server";
import {
  and,
  arrayContains,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";

import { env } from "~/env";
import { translatorFor } from "~/i18n/server";
import {
  CASE_KINDS,
  caseKindSchema,
  caseStatusSchema,
  MAPA_AREAS,
  mapaAreaSchema,
  type CaseKind,
  type MapaArea,
} from "~/lib/domain";
import { placeLabel } from "~/server/admin/place";
import { triageSummary, type StaffTriage } from "~/server/admin/triage-shape";
import { aiAvailable } from "~/server/ai/structured";
import {
  createTRPCRouter,
  roleProcedure,
  type Context,
} from "~/server/api/trpc";
import type { StaffSession } from "~/server/auth/session";
import { addMessage, setCaseStatus } from "~/server/cases/engine";
import {
  findCaseByCode,
  staffRecipient,
  timelineFor,
  type CaseRow,
} from "~/server/cases/queries";
import { matchContext } from "~/server/cases/match-context";
import { casePayloads } from "~/server/cases/payloads";
import { personTitle } from "~/server/cases/sample-people";
import { triageCase } from "~/server/cases/triage";
import { TEAM_NAME } from "~/server/cases/types";
import {
  auditLog,
  cases,
  deliveries,
  innovations,
  messages,
  notifications,
  people,
} from "~/server/db/schema";
import { decrypt } from "~/server/lib/crypto";
import { mailTransport } from "~/server/mail/send";
import { notify } from "~/server/notify";

/**
 * Module VI — the staff inbox. ROPS sees every case; an expert sees only the
 * cases assigned to them. Opening a case marks its notifications read.
 */
const staff = roleProcedure("rops", "expert");
const codeInput = z.string().trim().min(1).max(40);
const OPEN = ["new", "triaged", "in_progress"] as const;

type StaffCtx = Context & { staff: StaffSession };

function scope(ctx: StaffCtx): SQL | undefined {
  return ctx.staff.role === "expert"
    ? eq(cases.assigneeId, ctx.staff.personId)
    : undefined;
}

async function scopedCase(ctx: StaffCtx, code: string): Promise<CaseRow> {
  const t = translatorFor(ctx.locale, "admin");
  const c = await findCaseByCode(code);
  if (!c) {
    throw new TRPCError({ code: "NOT_FOUND", message: t("errors.noCase") });
  }
  if (ctx.staff.role === "expert" && c.assigneeId !== ctx.staff.personId) {
    throw new TRPCError({ code: "FORBIDDEN", message: t("errors.notYours") });
  }
  return c;
}

/** The Hub team's name in the viewer's language. */
const teamName = (ctx: Context) =>
  ctx.locale === "en" ? translatorFor("en", "admin")("labels.team") : TEAM_NAME;

async function audit(
  ctx: StaffCtx,
  action: string,
  c: CaseRow,
  diff?: Record<string, unknown>,
) {
  await ctx.db.insert(auditLog).values({
    actor: `${ctx.staff.role}:${ctx.staff.personId}`,
    action,
    entity: "case",
    entityId: c.code,
    diff: diff ?? null,
  });
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export const adminInboxRouter = createTRPCRouter({
  list: staff
    .input(
      z
        .object({
          status: caseStatusSchema.optional(),
          kind: caseKindSchema.optional(),
          area: mapaAreaSchema.optional(),
          q: z.string().trim().max(100).optional(),
          /** Open and without activity for 48 h. */
          waiting: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const f = input ?? {};
      const q = f.q ? `%${escapeLike(f.q)}%` : null;
      // Every filter except the kind: the chips show what each kind would add.
      const base = and(
        scope(ctx),
        f.status ? eq(cases.status, f.status) : undefined,
        f.area ? arrayContains(cases.areas, [f.area]) : undefined,
        f.waiting
          ? and(
              inArray(cases.status, [...OPEN]),
              lt(cases.lastActivityAt, new Date(Date.now() - 48 * 3600 * 1000)),
            )
          : undefined,
        q
          ? or(
              ilike(cases.code, q),
              ilike(cases.title, q),
              ilike(cases.bodyRedacted, q),
            )
          : undefined,
      );
      const kindRows = await ctx.db
        .select({ kind: cases.kind, n: count() })
        .from(cases)
        .where(base)
        .groupBy(cases.kind);
      const kindCounts = Object.fromEntries(
        CASE_KINDS.map((k) => [k, 0]),
      ) as Record<CaseKind, number>;
      for (const r of kindRows)
        if (r.kind in kindCounts) kindCounts[r.kind] = r.n;

      const rows = await ctx.db
        .select({
          id: cases.id,
          code: cases.code,
          kind: cases.kind,
          title: cases.title,
          status: cases.status,
          urgency: cases.urgency,
          areas: cases.areas,
          assigneeId: cases.assigneeId,
          authorRole: cases.authorRole,
          locale: cases.locale,
          triage: cases.triage,
          isSample: cases.isSample,
          createdAt: cases.createdAt,
          lastActivityAt: cases.lastActivityAt,
        })
        .from(cases)
        .where(and(base, f.kind ? eq(cases.kind, f.kind) : undefined))
        .orderBy(desc(cases.lastActivityAt))
        .limit(200);

      const ids = rows.map((r) => r.id);
      const [unread, ppl] = await Promise.all([
        ids.length
          ? ctx.db
              .selectDistinct({ caseId: notifications.caseId })
              .from(notifications)
              .where(
                and(
                  eq(notifications.recipient, staffRecipient(ctx.staff)),
                  isNull(notifications.readAt),
                  inArray(notifications.caseId, ids),
                ),
              )
          : [],
        ctx.db
          .select({ id: people.id, displayName: people.displayName })
          .from(people),
      ]);
      const unreadSet = new Set(unread.map((u) => u.caseId));
      const names = new Map(ppl.map((p) => [p.id, p.displayName]));
      const items = rows.map(({ triage, id, ...r }) => {
        const t = triage as StaffTriage | null;
        const summary = triageSummary(t, ctx.locale);
        return {
          ...r,
          unread: unreadSet.has(id),
          summary: summary?.text ?? null,
          summaryLang: summary?.lang ?? null,
          triageSource: t?.source ?? null,
          assigneeName:
            r.assigneeId === "rops"
              ? teamName(ctx)
              : r.assigneeId
                ? (names.get(r.assigneeId) ?? r.assigneeId)
                : null,
        };
      });
      return { items, kindCounts };
    }),

  get: staff
    .input(z.object({ code: codeInput }))
    .query(async ({ ctx, input }) => {
      const c = await scopedCase(ctx, input.code);
      await ctx.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.caseId, c.id),
            eq(notifications.recipient, staffRecipient(ctx.staff)),
            isNull(notifications.readAt),
          ),
        );

      const triage = c.triage as StaffTriage | null;
      const [thread, log, ppl, timeline, match, similar, payloads] =
        await Promise.all([
          ctx.db
            .select({
              id: messages.id,
              authorKind: messages.authorKind,
              authorName: messages.authorName,
              body: messages.body,
              visibleToAuthor: messages.visibleToAuthor,
              createdAt: messages.createdAt,
            })
            .from(messages)
            .where(eq(messages.caseId, c.id))
            .orderBy(asc(messages.createdAt)),
          ctx.db
            .select({
              id: deliveries.id,
              channel: deliveries.channel,
              toMasked: deliveries.toMasked,
              subject: deliveries.subject,
              body: deliveries.body,
              status: deliveries.status,
              error: deliveries.error,
              createdAt: deliveries.createdAt,
            })
            .from(deliveries)
            .where(eq(deliveries.caseId, c.id))
            .orderBy(desc(deliveries.createdAt)),
          ctx.db
            .select({
              id: people.id,
              displayName: people.displayName,
              role: people.role,
              title: people.title,
              areas: people.areas,
              isSample: people.isSample,
            })
            .from(people)
            .where(inArray(people.role, ["mentor", "expert"]))
            .orderBy(asc(people.displayName)),
          timelineFor(c),
          c.matchRunId ? matchContext(c.matchRunId) : null,
          triage?.similarCaseIds.length
            ? ctx.db
                .select({
                  id: cases.id,
                  code: cases.code,
                  title: cases.title,
                  status: cases.status,
                  createdAt: cases.createdAt,
                })
                .from(cases)
                // An expert sees only similar cases assigned to them.
                .where(
                  and(inArray(cases.id, triage.similarCaseIds), scope(ctx)),
                )
            : [],
          casePayloads(c, { staff: true }),
        ]);

      const demoMode = env.DEMO_MODE === "1";
      const contactValue = demoMode
        ? c.contactMasked
        : c.contactEnc
          ? (decrypt(c.contactEnc) ?? c.contactMasked)
          : null;
      // Links and capture dates for every card the triage panel cites.
      const cardIds = [...new Set(triage?.cards.map((k) => k.id) ?? [])];
      const cardRows = cardIds.length
        ? await ctx.db
            .select({
              id: innovations.id,
              slug: innovations.slug,
              title: innovations.title,
              sourceUrl: innovations.sourceUrl,
              capturedAt: innovations.capturedAt,
            })
            .from(innovations)
            .where(inArray(innovations.id, cardIds))
        : [];
      const cardInfo = Object.fromEntries(cardRows.map((r) => [r.id, r]));

      // Sample people have English titles for staff who use English.
      const people_ = ppl.map((p) => ({
        ...p,
        title: personTitle(p, ctx.locale),
      }));
      const suggested = triage?.suggestedExpertId
        ? (people_.find((p) => p.id === triage.suggestedExpertId) ?? null)
        : null;

      return {
        case: {
          id: c.id,
          code: c.code,
          kind: c.kind,
          title: c.title,
          body: c.bodyRedacted,
          status: c.status,
          urgency: c.urgency,
          areas: c.areas,
          authorRole: c.authorRole,
          onBehalf: c.onBehalf,
          contactPref: c.contactPref,
          assigneeId: c.assigneeId,
          gminaTeryt: c.gminaTeryt,
          powiatTeryt: c.powiatTeryt,
          /** „Bochnia (gmina wiejska), powiat bocheński" — never the bare TERYT code. */
          place: placeLabel(c.gminaTeryt, c.powiatTeryt, ctx.locale),
          /** The author's language: replies and the draft use it. */
          locale: c.locale,
          isSample: c.isSample,
          createdAt: c.createdAt,
          lastActivityAt: c.lastActivityAt,
        },
        triage,
        teamName: teamName(ctx),
        suggestedExpert: suggested,
        similarCases: similar,
        /** Similar cases the viewer may not open (other experts' cases). */
        similarHiddenCount: Math.max(
          0,
          (triage?.similarCaseIds.length ?? 0) - similar.length,
        ),
        people: people_,
        messages: thread,
        deliveries: log,
        timeline,
        match,
        cardInfo,
        ...payloads,
        contact: {
          pref: c.contactPref,
          value: contactValue,
          masked: demoMode,
        },
        env: {
          demoMode,
          mail: mailTransport() !== null,
          ai: aiAvailable(),
        },
        viewer: { role: ctx.staff.role, personId: ctx.staff.personId },
      };
    }),

  reply: staff
    .input(
      z.object({
        code: codeInput,
        body: z
          .string()
          .trim()
          .min(2, "Napisz odpowiedź — co najmniej 2 znaki.")
          .max(6000, "Odpowiedź jest za długa — skróć ją do 6000 znaków."),
        sendEmail: z.boolean().default(false),
        internal: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const c = await scopedCase(ctx, input.code);
      let authorName = TEAM_NAME;
      if (ctx.staff.role === "expert") {
        const [p] = await ctx.db
          .select({
            displayName: people.displayName,
            isSample: people.isSample,
          })
          .from(people)
          .where(eq(people.id, ctx.staff.personId));
        // The author reads this name, so it is in the author's language.
        const ta = translatorFor(c.locale === "en" ? "en" : "pl", "admin");
        authorName = p
          ? p.isSample
            ? ta("reply.expertNameSample", { name: p.displayName })
            : ta("reply.expertName", { name: p.displayName })
          : ctx.staff.name;
      }
      const m = await addMessage({
        caseId: c.id,
        authorKind: ctx.staff.role === "expert" ? "expert" : "rops",
        authorName,
        body: input.body,
        visibleToAuthor: !input.internal,
        deliverToAuthor: !input.internal && input.sendEmail,
      });
      if (!input.internal && c.status !== "closed") {
        await setCaseStatus(c.id, "answered");
      }
      await audit(ctx, input.internal ? "note" : "reply", c, {
        messageId: m.id,
        delivery: m.delivery ?? null,
      });
      return { id: m.id, delivery: m.delivery ?? null };
    }),

  assign: roleProcedure("rops")
    .input(
      z.object({
        code: codeInput,
        /** people.id, "rops" for the Hub team, or null to unassign. */
        assigneeId: z.string().max(64).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const c = await scopedCase(ctx, input.code);
      const next = input.assigneeId;
      if (next && next !== "rops") {
        const [p] = await ctx.db
          .select({ id: people.id })
          .from(people)
          .where(eq(people.id, next));
        if (!p) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: translatorFor(ctx.locale, "admin")("errors.noPerson"),
          });
        }
      }
      if (c.assigneeId === next) return { changed: false };
      await ctx.db
        .update(cases)
        .set({ assigneeId: next, updatedAt: new Date() })
        .where(eq(cases.id, c.id));
      if (next && next !== "rops") {
        await notify({ type: "case.assigned", caseId: c.id, assigneeId: next });
      }
      if (next && (c.status === "new" || c.status === "triaged")) {
        await setCaseStatus(c.id, "in_progress");
      }
      await audit(ctx, "assign", c, { from: c.assigneeId, to: next });
      return { changed: true };
    }),

  setStatus: staff
    .input(z.object({ code: codeInput, status: caseStatusSchema }))
    .mutation(async ({ ctx, input }) => {
      const c = await scopedCase(ctx, input.code);
      const changed = await setCaseStatus(c.id, input.status);
      if (changed) {
        await audit(ctx, "status", c, { from: c.status, to: input.status });
      }
      return { changed };
    }),

  /** Runs triage again now (e.g. after the AI key was added) and waits for it. */
  retriage: staff
    .input(z.object({ code: codeInput }))
    .mutation(async ({ ctx, input }) => {
      const c = await scopedCase(ctx, input.code);
      const triage = await triageCase(c.id);
      await audit(ctx, "retriage", c, { source: triage?.source ?? null });
      return { triage };
    }),

  /** Pulpit counters. Experts see their own cases only. */
  stats: staff.query(async ({ ctx }) => {
    const s = scope(ctx);
    const now = Date.now();
    const weekAgo = new Date(now - 7 * 24 * 3600 * 1000);
    const twoDaysAgo = new Date(now - 48 * 3600 * 1000);
    const [fresh, waiting, open, week, latest, unread, kinds] =
      await Promise.all([
        ctx.db
          .select({ n: count() })
          .from(cases)
          .where(and(s, inArray(cases.status, ["new", "triaged"]))),
        ctx.db
          .select({ n: count() })
          .from(cases)
          .where(
            and(
              s,
              inArray(cases.status, [...OPEN]),
              lt(cases.lastActivityAt, twoDaysAgo),
            ),
          ),
        ctx.db
          .select({ n: count() })
          .from(cases)
          .where(and(s, inArray(cases.status, [...OPEN]))),
        ctx.db
          .select({ kind: cases.kind, areas: cases.areas })
          .from(cases)
          .where(and(s, gte(cases.createdAt, weekAgo))),
        ctx.db
          .select({
            code: cases.code,
            kind: cases.kind,
            title: cases.title,
            status: cases.status,
            urgency: cases.urgency,
            triage: cases.triage,
            isSample: cases.isSample,
            createdAt: cases.createdAt,
          })
          .from(cases)
          .where(s)
          .orderBy(desc(cases.createdAt))
          .limit(8),
        ctx.db
          .select({ n: count() })
          .from(notifications)
          .where(
            and(
              eq(notifications.recipient, staffRecipient(ctx.staff)),
              isNull(notifications.readAt),
            ),
          ),
        ctx.db
          .select({ kind: cases.kind, status: cases.status, n: count() })
          .from(cases)
          .where(s)
          .groupBy(cases.kind, cases.status),
      ]);
    const perKind = Object.fromEntries(
      CASE_KINDS.map((k) => [k, { open: 0, total: 0 }]),
    ) as Record<CaseKind, { open: number; total: number }>;
    for (const r of kinds) {
      if (!(r.kind in perKind)) continue;
      perKind[r.kind].total += r.n;
      if ((OPEN as readonly string[]).includes(r.status))
        perKind[r.kind].open += r.n;
    }
    const byKind = Object.fromEntries(CASE_KINDS.map((k) => [k, 0])) as Record<
      CaseKind,
      number
    >;
    const byArea = Object.fromEntries(MAPA_AREAS.map((a) => [a, 0])) as Record<
      MapaArea,
      number
    >;
    for (const r of week) {
      byKind[r.kind] += 1;
      for (const a of r.areas) if (a in byArea) byArea[a] += 1;
    }
    return {
      newCount: fresh[0]?.n ?? 0,
      waitingOver48h: waiting[0]?.n ?? 0,
      openCount: open[0]?.n ?? 0,
      unreadNotifications: unread[0]?.n ?? 0,
      perKind,
      week: { total: week.length, byKind, byArea },
      latest: latest.map(({ triage, ...r }) => {
        const summary = triageSummary(triage as StaffTriage | null, ctx.locale);
        return {
          ...r,
          summary: summary?.text ?? null,
          summaryLang: summary?.lang ?? null,
        };
      }),
    };
  }),
});
