/**
 * Twelve SAMPLE Sprawy (isSample = true, codes „JD-PRZK-…") so the Pulpit,
 * the inbox and the expert's „Moje sprawy" show a working day on a fresh
 * database: every kind and status, two cases waiting over 48 h, two assigned
 * to the demo expert (DEMO_STAFF.expert → p-mentor-1), two written in English.
 *
 * Plain everyday language, no personal data, no crisis texts. Each case has a
 * short thread and a pre-written triage in the exact shape triage.ts stores
 * (flagged `sample: true`) — no AI call, no cost. Library quotes are read from
 * the database by card slug, so every quoted sentence is a real card sentence.
 *
 * Re-running replaces the earlier sample cases (and their messages,
 * notifications, deliveries, outbox events and audit rows) and re-inserts
 * them with dates relative to now. Titles never start with „[test]", so the
 * test cleanup leaves them alone. Imports nothing marked server-only.
 */
import { and, eq, inArray, like, or, sql } from "drizzle-orm";

import {
  CASE_KIND_LABEL,
  CASE_KIND_LABEL_EN,
  type CaseStatus,
} from "~/lib/domain";
import {
  DEMO_EXPERT,
  SAMPLE_CASE_PREFIX,
  SAMPLE_CASES,
  type Lang,
  type Msg,
} from "~/server/admin/sample-cases-data";
import type {
  StaffTriage,
  StaffTriageCard,
} from "~/server/admin/triage-shape";
import { SAMPLE_PEOPLE } from "~/server/cases/sample-people";
import {
  REPLY_CLOSING,
  RESIDENT_TEAM_NAME,
  SYSTEM_NAME,
  TEAM_NAME,
} from "~/server/cases/types";
import { db } from "~/server/db";
import {
  auditLog,
  cases,
  deliveries,
  events,
  innovations,
  messages,
  notifications,
} from "~/server/db/schema";
import {
  generateAccessToken,
  hashToken,
  isCaseCode,
} from "~/server/domain/case-code";

export { SAMPLE_CASE_PREFIX, SAMPLE_CASES };

const H = 3_600_000;

const RECEIVED: Record<Lang, string> = {
  pl: "Sprawa przyjęta. Odpowiemy zwykle w ciągu 2 dni roboczych.",
  en: "Case received. We usually reply within 2 working days.",
};

const siteUrl = () =>
  (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  ).replace(/\/$/, "");

type CardRow = {
  id: string;
  slug: string;
  title: string;
  sentenceId: string;
  sentence: string;
  titleEn: string | null;
  sentenceEn: string | null;
};

async function loadCards(slugs: string[]): Promise<Map<string, CardRow>> {
  if (!slugs.length) return new Map();
  const rows = await db
    .select({
      id: innovations.id,
      slug: innovations.slug,
      title: innovations.title,
      sentences: innovations.sentences,
      en: innovations.en,
    })
    .from(innovations)
    .where(inArray(innovations.slug, slugs));
  const out = new Map<string, CardRow>();
  for (const r of rows) {
    const s =
      r.sentences.find((x) => x.section === "solution") ?? r.sentences[0];
    if (!s) continue;
    out.set(r.slug, {
      id: r.id,
      slug: r.slug,
      title: r.title,
      sentenceId: s.id,
      sentence: s.text,
      titleEn: r.en?.title ?? null,
      sentenceEn: r.en?.sentences[s.id] ?? null,
    });
  }
  return out;
}

/** {title:slug}, {quote:slug} and {link:slug} → the card's own words. */
function fill(text: string, cards: Map<string, CardRow>, lang: Lang): string {
  return text.replace(
    /\{(title|quote|link):([a-z0-9-]+)\}/g,
    (_m, what: string, slug: string) => {
      const c = cards.get(slug);
      if (!c) return "";
      const en = lang === "en";
      if (what === "link") return `${siteUrl()}/library/${slug}`;
      if (what === "title") return `„${en && c.titleEn ? c.titleEn : c.title}”`;
      return en && c.sentenceEn ? c.sentenceEn : c.sentence;
    },
  );
}

/** The same draft the no-AI triage writes, in the author's language. */
function draft(cards: CardRow[], lang: Lang): string {
  const en = lang === "en";
  const closing = en
    ? "If you have any questions, reply here — we'll answer in this thread."
    : REPLY_CLOSING;
  const hello = en ? "Hello," : "Dzień dobry,";
  if (!cards.length) {
    return en
      ? `${hello}\n\nthank you for getting in touch.\n\n[TO FILL IN: answer]\n\nNext step: [TO FILL IN: what you can do now]\n\n${closing}\n\n${RESIDENT_TEAM_NAME}`
      : `${hello}\n\ndziękujemy za zgłoszenie.\n\n[DO UZUPEŁNIENIA: odpowiedź]\n\nNastępny krok: [DO UZUPEŁNIENIA: co możesz zrobić teraz]\n\n${closing}\n\n${RESIDENT_TEAM_NAME}`;
  }
  const list = cards
    .map((c) => {
      const title = en && c.titleEn ? c.titleEn : c.title;
      const sentence = en && c.sentenceEn ? c.sentenceEn : c.sentence;
      return `– „${title}”: ${sentence}\n  ${siteUrl()}/library/${c.slug}`;
    })
    .join("\n\n");
  return en
    ? `${hello}\n\nthank you for getting in touch. The ROPS Social Innovation Library has solutions that may fit your situation:\n\n${list}\n\nNext step: read the description of the solution at the link and tell us which one suits you best — we will help you get in touch with the people who run it.\n\n${closing}\n\n${RESIDENT_TEAM_NAME}`
    : `${hello}\n\ndziękujemy za zgłoszenie. W Bibliotece Innowacji Społecznych ROPS są rozwiązania, które mogą pasować do Twojej sprawy:\n\n${list}\n\nNastępny krok: przeczytaj opis rozwiązania pod linkiem i napisz nam, które najbardziej Ci odpowiada — pomożemy skontaktować się z osobami, które je prowadzą.\n\n${closing}\n\n${RESIDENT_TEAM_NAME}`;
}

/** Removes every earlier sample case of this seed, with everything hanging off it. */
async function removeSampleCases(): Promise<number> {
  const rows = await db
    .select({ id: cases.id, code: cases.code })
    .from(cases)
    .where(
      and(eq(cases.isSample, true), like(cases.code, `${SAMPLE_CASE_PREFIX}%`)),
    );
  if (!rows.length) return 0;
  const ids = rows.map((r) => r.id);
  const codes = rows.map((r) => r.code);
  await db.transaction(async (tx) => {
    await tx.delete(messages).where(inArray(messages.caseId, ids));
    await tx.delete(notifications).where(
      or(
        inArray(notifications.caseId, ids),
        inArray(
          notifications.recipient,
          ids.map((id) => `case:${id}`),
        ),
      ),
    );
    await tx.delete(deliveries).where(inArray(deliveries.caseId, ids));
    await tx.delete(events).where(
      sql`${events.payload}->>'caseId' in (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
    await tx
      .delete(auditLog)
      .where(
        and(eq(auditLog.entity, "case"), inArray(auditLog.entityId, codes)),
      );
    await tx.delete(cases).where(inArray(cases.id, ids));
  });
  return rows.length;
}

const authorNameFor = (by: Msg["by"], lang: Lang) => {
  if (by === "rops") return TEAM_NAME;
  if (by === "expert") {
    const p = SAMPLE_PEOPLE.find((x) => x.id === DEMO_EXPERT)!;
    return lang === "en"
      ? `${p.displayName}, Hub expert (sample person)`
      : `${p.displayName}, ekspert Hubu (osoba przykładowa)`;
  }
  return null;
};

/** Seeds the sample cases. Safe to run again. */
export async function seedSampleCases(): Promise<void> {
  for (const c of SAMPLE_CASES) {
    if (!isCaseCode(c.code) || !c.code.startsWith(SAMPLE_CASE_PREFIX))
      throw new Error(`[seed] invalid sample case code ${c.code}`);
  }
  const removed = await removeSampleCases();

  const slugs = [
    ...new Set(
      SAMPLE_CASES.flatMap((c) => [
        ...c.triage.cards,
        ...(c.innovationSlug ? [c.innovationSlug] : []),
        ...[...`${c.thread.map((m) => m.body).join(" ")}`.matchAll(
          /\{(?:title|quote|link):([a-z0-9-]+)\}/g,
        )].map((m) => m[1]!),
      ]),
    ),
  ];
  const cards = await loadCards(slugs);
  const missing = slugs.filter((s) => !cards.has(s));
  if (missing.length)
    console.warn(`[seed] sample cases: cards not in the library: ${missing.join(", ")}`);

  const now = Date.now();
  const at = (hoursAgo: number) => new Date(now - hoursAgo * H);
  let unread = 0;

  for (const c of SAMPLE_CASES) {
    const createdAt = at(c.hoursAgo);
    const visible = c.thread.filter((m) => !m.internal);
    const lastActivityAt = visible.length
      ? at(Math.min(...visible.map((m) => m.hoursAgo)))
      : createdAt;
    const triagedAt = new Date(createdAt.getTime() + 2 * 60_000);
    const quoted: StaffTriageCard[] = c.triage.cards.flatMap((slug) => {
      const k = cards.get(slug);
      return k ? [{ ...k, matchedTerms: [] }] : [];
    });
    const triage: StaffTriage = {
      source: "ai",
      aiStatus: "ok",
      sample: true,
      summary: c.triage.summary,
      summaryEn: c.triage.summaryEn,
      areas: c.areas,
      urgency: c.urgency,
      crisis: null,
      powiatGuess: c.triage.powiatGuess,
      suggestedExpertId: c.triage.suggestedExpertId,
      similarCaseIds: [],
      replyDraft: draft(
        c.triage.cards.flatMap((s) => cards.get(s) ?? []),
        c.locale,
      ),
      draftLocale: c.locale,
      cards: quoted,
      appliedAreas: true,
      createdAt: triagedAt.toISOString(),
    };

    const [row] = await db
      .insert(cases)
      .values({
        code: c.code,
        // Like a real case: only the hash of a private-link token is kept.
        tokenHash: hashToken(generateAccessToken()),
        kind: c.kind,
        title: c.title,
        bodyRedacted: c.body,
        gminaTeryt: c.gminaTeryt,
        powiatTeryt: c.gminaTeryt.slice(0, 4),
        areas: c.areas,
        urgency: c.urgency,
        status: c.status,
        assigneeId: c.assigneeId ?? null,
        authorRole: c.authorRole,
        onBehalf: c.onBehalf ?? false,
        contactPref: c.contactPref,
        locale: c.locale,
        contactEnc: null,
        contactMasked: c.contactMasked ?? null,
        triage,
        innovationId: c.innovationSlug
          ? (cards.get(c.innovationSlug)?.id ?? null)
          : null,
        rating: c.rating ?? null,
        isSample: true,
        createdAt,
        updatedAt: lastActivityAt,
        lastActivityAt,
      })
      .returning({ id: cases.id });
    if (!row) throw new Error(`[seed] sample case ${c.code} not inserted`);
    const caseId = row.id;

    // The thread: the receipt, then the conversation.
    const thread = [
      {
        caseId,
        authorKind: "system" as const,
        authorName: SYSTEM_NAME,
        body: RECEIVED[c.locale],
        visibleToAuthor: true,
        createdAt: new Date(createdAt.getTime() + 1000),
      },
      ...c.thread.map((m) => ({
        caseId,
        authorKind: m.by,
        authorName: authorNameFor(m.by, c.locale),
        body: fill(m.body, cards, c.locale),
        visibleToAuthor: !m.internal,
        createdAt: at(m.hoursAgo),
      })),
    ];
    const inserted = await db
      .insert(messages)
      .values(thread)
      .returning({ id: messages.id, authorKind: messages.authorKind, createdAt: messages.createdAt });

    // The outbox, so the status timeline has dates (as notify() would write it).
    const ev: { type: string; payload: Record<string, unknown>; createdAt: Date }[] = [
      { type: "case.created", payload: { type: "case.created", caseId }, createdAt },
    ];
    if (c.status !== "new")
      ev.push({
        type: "case.triaged",
        payload: { type: "case.triaged", caseId, assigneeId: null },
        createdAt: triagedAt,
      });
    const firstStaff = c.thread.find((m) => m.by !== "author");
    if (c.assigneeId && c.assigneeId !== "rops") {
      const assignedAt = firstStaff
        ? at(firstStaff.hoursAgo + 0.5)
        : new Date(triagedAt.getTime() + H);
      ev.push({
        type: "case.assigned",
        payload: { type: "case.assigned", caseId, assigneeId: c.assigneeId },
        createdAt: assignedAt,
      });
    }
    const order: CaseStatus[] = ["triaged", "in_progress", "answered", "closed"];
    const reached = order.slice(1, order.indexOf(c.status) + 1);
    for (const [i, status] of reached.entries()) {
      const base = firstStaff ? firstStaff.hoursAgo : c.hoursAgo / 2;
      const t =
        status === "closed"
          ? at(Math.max(0.2, Math.min(...visible.map((m) => m.hoursAgo)) - 8))
          : at(base - i * 0.01);
      ev.push({
        type: "case.status",
        payload: { type: "case.status", caseId, status },
        createdAt: t,
      });
    }
    for (const m of inserted)
      if (m.authorKind !== "system")
        ev.push({
          type: "message.created",
          payload: {
            type: "message.created",
            caseId,
            messageId: m.id,
            authorKind: m.authorKind,
          },
          createdAt: m.createdAt,
        });
    await db.insert(events).values(ev);

    // Unread bell items for the Hub team (and the assigned expert).
    if (c.unread) {
      const kindPl = CASE_KIND_LABEL[c.kind];
      const kindEn = CASE_KIND_LABEL_EN[c.kind];
      const last = inserted.at(-1);
      const note =
        c.unread === "created"
          ? {
              kind: "case.created",
              title: `Nowa sprawa: ${kindPl}`,
              body: c.triage.summary,
              en: { title: `New case: ${kindEn}`, body: c.triage.summaryEn },
              createdAt: new Date(createdAt.getTime() + 1000),
            }
          : {
              kind: "message.author",
              title: `Nowa wiadomość od autora: ${c.code}`,
              body: c.thread.at(-1)!.body,
              en: {
                title: `New message from the author: ${c.code}`,
                body: c.thread.at(-1)!.body,
              },
              createdAt: last?.createdAt ?? lastActivityAt,
            };
      await db.insert(notifications).values({
        recipient: "rops",
        caseId,
        href: `/admin/cases/${c.code}`,
        ...note,
      });
      unread++;
    }
    if (c.assigneeId === DEMO_EXPERT && c.status === "in_progress") {
      await db.insert(notifications).values({
        recipient: `expert:${DEMO_EXPERT}`,
        caseId,
        kind: "case.assigned",
        title: `Przydzielono Ci sprawę: ${CASE_KIND_LABEL[c.kind]}`,
        body: c.title,
        en: {
          title: `A case has been assigned to you: ${CASE_KIND_LABEL_EN[c.kind]}`,
          body: c.title,
        },
        href: `/expert?code=${c.code}`,
        createdAt: at(c.hoursAgo - 4),
      });
    }
  }

  console.log(
    `[seed] sample cases: ${SAMPLE_CASES.length} (replaced ${removed}), ${unread} unread notifications for the Hub team`,
  );
}
