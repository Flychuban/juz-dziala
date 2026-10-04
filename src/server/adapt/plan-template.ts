/**
 * The Ramowy Plan Wdrożenia, built without AI — every section filled from the
 * innovation card, the gmina's GUS figures, the institution's answers and the
 * ROPS calls, with „[DO UZUPEŁNIENIA]" ("[TO BE COMPLETED]") where only the
 * institution knows.
 *
 * Sections 2 (scale), 7 (budget) and 10 (funding) are ALWAYS taken from here,
 * even when the AI writes the rest: figures, money and call facts never come
 * from the model.
 *
 * Every word comes from messages/{pl,en}/adapt.json (`plan.*`) in the plan's
 * language (`ctx.locale`). Card quotes are always OUR text for a sentence id:
 * the Polish original, or in English the translated sentence, labelled so.
 */
import { formatDate } from "~/components/kit/format";
import type { Locale } from "~/i18n/config";
import { labelsFor, type MapaArea } from "~/lib/domain";
import { adaptT, type AdaptT } from "./i18n";
import { BUDGET_BOUNDS, optionLabels, type PlanSource } from "./options";
import { int, kindLabel, pct, powiatDisplay, signedPct } from "./profile";
import type { CardSentence, PlanCard, PlanContext } from "./types";

/** The gap marker, by language. */
export const TODO = "[DO UZUPEŁNIENIA]";
export const TODO_EN = "[TO BE COMPLETED]";
export const CHECK = "do weryfikacji";
export function todoMarker(locale: Locale): string {
  return locale === "en" ? TODO_EN : TODO;
}

export const SECTION_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type SectionNumber = (typeof SECTION_NUMBERS)[number];
/** Sections whose content is computed on the server in every mode. */
export const FIXED_SECTIONS: readonly SectionNumber[] = [2, 7, 10];
/** Sections the AI writes (the template stands in when it does not). */
export const AI_SECTIONS: readonly SectionNumber[] = [1, 3, 4, 5, 6, 8, 9];

/** The card title in the plan's language. */
export function cardTitle(card: PlanCard, locale: Locale): string {
  return locale === "en" && card.en?.title ? card.en.title : card.title;
}

export function sectionTitle(
  n: SectionNumber,
  title: string,
  locale: Locale = "pl",
): string {
  return adaptT(locale)(`plan.titles.s${n}`, { title });
}

export function sectionHeading(
  n: SectionNumber,
  title: string,
  locale: Locale = "pl",
): string {
  return `## ${n}. ${sectionTitle(n, title, locale)}`;
}

// ---------------------------------------------------------------------------
// Small Markdown helpers
// ---------------------------------------------------------------------------

/** Card text inside our Markdown: one line, no accidental emphasis or links. */
export function mdText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/([\\*_`[\]|])/g, "\\$1");
}

/** A sentence as a plan quotes it: our text, its card section, translated or not. */
export type QuotedSentence = Pick<CardSentence, "text" | "section"> & {
  /** True when `text` is the English translation of the card sentence. */
  translated?: boolean;
};

/**
 * A card sentence as we print it — always OUR text for the id, cited by the
 * card section it comes from. Internal sentence ids never reach the reader.
 * In English the citation says whether the words are a translation.
 */
export function quoteSentence(s: QuotedSentence, locale: Locale = "pl"): string {
  const section = labelsFor(locale).section[s.section];
  const key =
    locale === "en"
      ? s.translated
        ? "plan.quoteTranslated"
        : "plan.quoteOriginal"
      : "plan.quote";
  return adaptT(locale)(key, { text: mdText(s.text), section });
}

/** Every sentence of the card in the plan's language, by id. */
export function planSentences(
  card: PlanCard,
  locale: Locale,
): Map<string, QuotedSentence> {
  return new Map(
    card.sentences.map((s) => {
      const en = locale === "en" ? card.en?.sentences[s.id]?.trim() : undefined;
      return [
        s.id,
        en
          ? { text: en, section: s.section, translated: true }
          : { text: s.text, section: s.section, translated: false },
      ];
    }),
  );
}

const MONEY: Record<Locale, Intl.NumberFormat> = {
  pl: new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }),
  en: new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }),
};
function roundMoney(n: number): number {
  const step = n < 10_000 ? 100 : n < 100_000 ? 500 : 1000;
  return Math.round(n / step) * step;
}
function amount(n: number, locale: Locale): string {
  return MONEY[locale].format(roundMoney(n));
}
/** „90 000 zł" / "PLN 90,000". */
export function zl(n: number, locale: Locale = "pl"): string {
  return adaptT(locale)("plan.money", { amount: amount(n, locale) });
}

/** The context plus its translator and gap markers. */
type Ctx = PlanContext & {
  t: AdaptT;
  todo: string;
  check: string;
  quotes: Map<string, QuotedSentence>;
};

function withT(ctx: PlanContext): Ctx {
  const t = adaptT(ctx.locale);
  return {
    ...ctx,
    t,
    todo: t("plan.todo"),
    check: t("plan.check"),
    quotes: planSentences(ctx.card, ctx.locale),
  };
}

function sentencesOf(
  c: Ctx,
  section: CardSentence["section"],
  max: number,
): QuotedSentence[] {
  return c.card.sentences
    .filter((s) => s.section === section && s.text.trim().length > 0)
    .slice(0, max)
    .map((s) => c.quotes.get(s.id)!);
}

function quoteBlock(c: Ctx, sentences: QuotedSentence[]): string {
  return sentences.map((s) => `> ${quoteSentence(s, c.locale)}`).join("\n>\n");
}

function gminaPhrase(c: Ctx): string {
  const p = c.profile;
  return c.t("plan.gminaPhrase", {
    name: p.name,
    kind: kindLabel(p.kind, c.locale),
    powiat: powiatDisplay(p.powiatName, c.locale),
  });
}

function people(c: Ctx, n: number): string {
  return c.t("plan.people", { count: n });
}

function row(...cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}
function tableHead(...cells: string[]): string[] {
  return [row(...cells), `|${cells.map(() => "---").join("|")}|`];
}

// ---------------------------------------------------------------------------
// Header and footer
// ---------------------------------------------------------------------------

export function planHeader(ctx: PlanContext): string {
  const c = withT(ctx);
  const { card, inputs, t } = c;
  const o = optionLabels(c.locale);
  const title = mdText(cardTitle(card, c.locale));
  const lines = [
    t("plan.header.title", { title }),
    "",
    `**${o.institution[inputs.institution]}** · ${gminaPhrase(c)}`,
    "",
    `> **${t("disclaimer")}.**`,
    "",
  ];
  if (ctx.ramowyPlan) {
    const link = ctx.ramowyPlan.sourceUrl
      ? t("plan.header.callLink", { url: ctx.ramowyPlan.sourceUrl })
      : "";
    lines.push(`> ${t("plan.header.ramowy", { link })}`, "");
  }
  lines.push(
    ...tableHead(t("plan.header.colAssumption"), t("plan.header.colValue")),
    row(t("plan.header.innovation"), t("plan.header.innovationValue", { title })),
    row(t("plan.header.institution"), o.institution[inputs.institution]),
    row(t("plan.header.gmina"), gminaPhrase(c)),
    row(t("plan.header.staff"), o.staff[inputs.staff]),
    row(t("plan.header.budget"), `${o.budget[inputs.budget]} (${c.check})`),
    row(t("plan.header.timeframe"), o.timeframe[inputs.timeframe]),
    row(
      t("plan.header.groupSize"),
      inputs.groupSize ? people(c, inputs.groupSize) : t("plan.notGiven"),
    ),
    "",
  );
  return lines.join("\n");
}

/** Sources and „who prepared this" — the source is known only at the end. */
export function planFooter(ctx: PlanContext, source: PlanSource): string {
  const c = withT(ctx);
  const { card, gus, t } = c;
  const calls = ctx.funding.filter((f) => f.sourceUrl);
  const how =
    source === "ai"
      ? t("plan.footer.howAi")
      : source === "mixed"
        ? t("plan.footer.howMixed")
        : t("plan.footer.howTemplate");
  const cardKey =
    c.locale === "en" && card.en ? "plan.footer.cardTranslated" : "plan.footer.card";
  const lines = [
    "",
    "---",
    "",
    `## ${t("plan.footer.sources")}`,
    "",
    `- ${t(cardKey, {
      title: mdText(cardTitle(card, c.locale)),
      url: card.sourceUrl,
      date: formatDate(card.capturedAt, c.locale),
    })}`,
    `- ${t("plan.footer.gus", {
      name: gus.name,
      year: String(gus.year),
      url: gus.url,
      date: formatDate(gus.capturedAt, c.locale),
    })}`,
    ...calls.map(
      (f) =>
        `- ${t("plan.footer.call", {
          name: mdText(shortCallName(f.name, c.locale)),
          url: f.sourceUrl!,
        })}`,
    ),
    "",
    t("plan.footer.prepared", {
      date: formatDate(ctx.generatedAt, c.locale),
      how,
    }),
    "",
    `**${t("disclaimer")}.**`,
    "",
  ];
  return lines.join("\n");
}

/**
 * „Usługa Wrażliwa – upowszechnianie… (II nabór)" out of the long official
 * call name: the quoted project name, plus the call's ordinal when it has one.
 * The project name is a proper name and stays Polish in both languages.
 */
export function shortCallName(name: string, locale: Locale = "pl"): string {
  const m = /[„"]([^”"]+)[”"]/.exec(name);
  const short = m?.[1]?.trim() ?? name;
  const ordinal = /^([IVX]+)\s+nabór/i.exec(name.trim())?.[1];
  return ordinal
    ? adaptT(locale)("plan.callOrdinal", { name: short, ordinal })
    : short;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function section1(c: Ctx): string {
  const { card, inputs, profile, t } = c;
  const o = optionLabels(c.locale);
  const problems = sentencesOf(c, "problems", 2);
  const out = [
    t("plan.s1.intro", {
      gmina: profile.name,
      title: mdText(cardTitle(card, c.locale)),
      institution: o.institution[inputs.institution],
    }),
    "",
  ];
  if (problems.length) {
    out.push(t("plan.s1.problems"), "", quoteBlock(c, problems), "");
  }
  if (inputs.needs) {
    out.push(t("plan.s1.needs"), "", `> ${mdText(inputs.needs)}`, "");
  }
  out.push(
    inputs.groupSize
      ? t("plan.s1.goalPlanned", {
          todo: c.todo,
          people: people(c, inputs.groupSize),
        })
      : t("plan.s1.goal", { todo: c.todo }),
  );
  return out.join("\n");
}

/** Section 2 — computed on the server from GUS, never by the model. */
function section2Of(c: Ctx): string {
  const { card, profile: p, gus, inputs, t, locale } = c;
  const target = sentencesOf(c, "targetGroup", 2);
  const out: string[] = [];
  if (target.length) {
    out.push(t("plan.s2.target"), "", quoteBlock(c, target), "");
  }
  const change =
    p.popChange10y === null
      ? t("plan.s2.changeNone", { from: String(gus.baseYear) })
      : p.popChange10y < 0
        ? t("plan.s2.changeFalling", { change: signedPct(p.popChange10y, locale) })
        : signedPct(p.popChange10y, locale);
  out.push(
    t("plan.s2.residents", {
      name: p.name,
      kind: kindLabel(p.kind, locale),
      powiat: powiatDisplay(p.powiatName, locale),
      year: String(p.year),
    }),
    "",
    ...tableHead(t("plan.s2.colIndicator"), t("plan.s2.colValue")),
    row(t("plan.s2.population"), int(p.population, locale)),
    row(
      t("plan.s2.pop65"),
      t("plan.s2.pop65Value", {
        n: int(p.pop65, locale),
        share: pct(p.share65, locale),
      }),
    ),
    row(
      t("plan.s2.pop80"),
      t("plan.s2.pop80Value", {
        n: int(p.pop80, locale),
        share: pct(p.share80, locale),
        median: pct(p.medianShare80, locale),
      }),
    ),
    row(t("plan.s2.change", { from: String(gus.baseYear), to: String(p.year) }), change),
    "",
    t("plan.s2.source", {
      name: gus.name,
      year: String(p.year),
      url: gus.url,
      date: formatDate(gus.capturedAt, locale),
    }),
    "",
  );
  const seniorsCard = card.mapaAreas.includes("seniors");
  if (inputs.groupSize) {
    out.push(
      seniorsCard && p.pop65 > 0
        ? t("plan.s2.scaleSeniors", {
            people: people(c, inputs.groupSize),
            share: pct((inputs.groupSize / p.pop65) * 100, locale),
          })
        : t("plan.s2.scale", { people: people(c, inputs.groupSize) }),
    );
  } else {
    out.push(t("plan.s2.scaleTodo", { todo: c.todo }));
  }
  if (!seniorsCard) {
    out.push("", t("plan.s2.targetTodo", { todo: c.todo }));
  }
  return out.join("\n");
}
export function section2(ctx: PlanContext): string {
  return section2Of(withT(ctx));
}

function section3(c: Ctx): string {
  const { card, profile, t } = c;
  const out: string[] = [];
  const solution = sentencesOf(c, "solution", 4);
  const who = sentencesOf(c, "whoCanUse", 2);
  const works = sentencesOf(c, "doesItWork", 2);
  if (solution.length)
    out.push(t("plan.s3.solution"), "", quoteBlock(c, solution), "");
  if (who.length) out.push(t("plan.s3.who"), "", quoteBlock(c, who), "");
  if (works.length) out.push(t("plan.s3.works"), "", quoteBlock(c, works), "");
  out.push(t("plan.s3.adapt", { gmina: profile.name, todo: c.todo }));
  const materials = [
    card.folderUrl ? t("plan.s3.folder", { url: card.folderUrl }) : null,
    card.materialsUrl ? t("plan.s3.materials", { url: card.materialsUrl }) : null,
    t("plan.s3.card", { url: card.sourceUrl }),
  ].filter(Boolean);
  out.push("", t("plan.s3.materialsLine", { list: materials.join(", ") }));
  out.push(
    "",
    card.licence
      ? t("plan.s3.licence", { licence: mdText(card.licence) })
      : t("plan.s3.licenceNone", { todo: c.todo }),
  );
  return out.join("\n");
}

function section4(c: Ctx): string {
  const { inputs, card, profile, t } = c;
  const o = optionLabels(c.locale);
  const head = tableHead(
    t("plan.s4.colMonth"),
    t("plan.s4.colStage"),
    t("plan.s4.colTodo"),
  );
  const licence = card.licence
    ? ` ${t("plan.s4.licence", { licence: mdText(card.licence) })}`
    : "";
  const staff = o.staff[inputs.staff];
  const gmina = profile.name;
  let rows: string[];
  if (inputs.timeframe === "6") {
    rows = [
      row("1", t("plan.s4.prepTeam"), t("plan.s4.prepTeamTodo", { licence, staff })),
      row("2", t("plan.s4.recruit"), t("plan.s4.recruitShortTodo", { gmina })),
      row("3–5", t("plan.s4.deliver"), t("plan.s4.deliverTodo")),
      row("6", t("plan.s4.evalSummary"), t("plan.s4.evalSummaryTodo")),
    ];
  } else {
    rows = [
      row("1", t("plan.s4.prep"), t("plan.s4.prepTodo", { licence })),
      row("2", t("plan.s4.team"), t("plan.s4.teamTodo", { staff })),
      row("3", t("plan.s4.recruit"), t("plan.s4.recruitTodo", { gmina })),
      row("4–10", t("plan.s4.deliver"), t("plan.s4.deliverTodo")),
      row("11", t("plan.s4.evaluation"), t("plan.s4.evaluationTodo")),
      row("12", t("plan.s4.summary"), t("plan.s4.summaryTodo")),
    ];
    if (inputs.timeframe === "24") {
      rows.push(
        row(
          t("plan.s4.month13"),
          t("plan.s4.continue"),
          t("plan.s4.continueTodo", { todo: c.todo }),
        ),
      );
    }
  }
  return [t("plan.s4.intro", { todo: c.todo }), "", ...head, ...rows].join("\n");
}

function section5(c: Ctx): string {
  const { inputs, t } = c;
  const o = optionLabels(c.locale);
  const out = [
    t("plan.s5.team", { staff: o.staff[inputs.staff] }),
    "",
    ...tableHead(t("plan.s5.colRole"), t("plan.s5.colTasks"), t("plan.s5.colSkills")),
    row(
      t("plan.s5.coordinator"),
      t("plan.s5.coordinatorTasks"),
      t("plan.s5.coordinatorSkills"),
    ),
    row(
      t("plan.s5.leaders"),
      t("plan.s5.leadersTasks"),
      t("plan.s5.leadersSkills", { todo: c.todo }),
    ),
    row(t("plan.s5.authors"), t("plan.s5.authorsTasks"), t("plan.s5.authorsSkills")),
  ];
  if (inputs.staff === "1") {
    out.push("", t("plan.s5.onePerson"));
  }
  return out.join("\n");
}

const PARTNER_AREAS: readonly MapaArea[] = [
  "seniors",
  "family",
  "disability",
  "health",
  "mental_health",
  "homelessness",
  "poverty",
  "migrants",
];

function section6(c: Ctx): string {
  const { card, inputs, profile, t, locale } = c;
  const authors = (
    (locale === "en" ? card.en?.sections.authors : null) ?? card.sections.authors
  )?.trim();
  const rows = [
    ...tableHead(t("plan.s6.colPartner"), t("plan.s6.colRole")),
    row(
      t("plan.s6.authors", {
        authors: authors
          ? mdText(authors)
          : t("plan.s6.authorsNone", { todo: c.todo }),
      }),
      t("plan.s6.authorsRole"),
    ),
    row(t("plan.s6.rops"), t("plan.s6.ropsRole")),
  ];
  if (inputs.institution !== "ops" && inputs.institution !== "cus") {
    rows.push(row(t("plan.s6.ops", { gmina: profile.name }), t("plan.s6.opsRole")));
  }
  if (
    inputs.institution !== "pcpr" &&
    (card.mapaAreas.includes("family") || card.mapaAreas.includes("disability"))
  ) {
    rows.push(
      row(
        t("plan.s6.pcpr", { powiat: powiatDisplay(profile.powiatName, locale) }),
        t("plan.s6.pcprRole"),
      ),
    );
  }
  for (const a of card.mapaAreas) {
    if (!PARTNER_AREAS.includes(a)) continue;
    rows.push(row(t(`plan.s6.area.${a}`), t("plan.s6.areaRole")));
  }
  return [...rows, "", t("plan.s6.localTodo", { todo: c.todo })].join("\n");
}

const BUDGET_SHARES = [
  { key: "staff", min: 45, max: 60 },
  { key: "training", min: 5, max: 10 },
  { key: "materials", min: 10, max: 20 },
  { key: "travel", min: 3, max: 10 },
  { key: "info", min: 2, max: 5 },
  { key: "monitoring", min: 3, max: 5 },
] as const;

/** Section 7 — ranges only, each „do weryfikacji", from the chosen range. */
function section7Of(c: Ctx): string {
  const { inputs, profile, t, locale } = c;
  const o = optionLabels(locale);
  const b = BUDGET_BOUNDS[inputs.budget];
  const rural = profile.kind !== "miejska";
  const range = (minShare: number, maxShare: number) => {
    if (b.max === null)
      return t("plan.s7.from", { money: zl((b.min * minShare) / 100, locale) });
    if (b.min === 0)
      return t("plan.s7.upTo", { money: zl((b.max * maxShare) / 100, locale) });
    return t("plan.s7.between", {
      from: amount((b.min * minShare) / 100, locale),
      to: amount((b.max * maxShare) / 100, locale),
    });
  };
  const rows = BUDGET_SHARES.map((s) => {
    const shares = rural && s.key === "travel" ? { min: 5, max: 15 } : s;
    return row(
      t(`plan.s7.cat.${s.key}`),
      `${shares.min}–${shares.max}%`,
      range(shares.min, shares.max),
      c.check,
    );
  });
  const uw = c.funding.find((f) => f.kind === "usluga-wrazliwa" && f.amountMax);
  const out = [
    t("plan.s7.chosen", { budget: o.budget[inputs.budget], check: c.check }),
    "",
    ...tableHead(
      t("plan.s7.colCategory"),
      t("plan.s7.colShare"),
      t("plan.s7.colRange"),
      t("plan.s7.colStatus"),
    ),
    ...rows,
    row(t("plan.s7.cat.indirect"), t("plan.s7.indirectShare"), c.todo, c.check),
    "",
    t("plan.s7.note"),
  ];
  if (rural) {
    out.push("", t("plan.s7.rural"));
  }
  if (uw?.amountMax && (b.max === null || b.max > uw.amountMax)) {
    out.push("", t("plan.s7.uwLimit", { money: zl(uw.amountMax, locale) }));
  }
  return out.join("\n");
}
export function section7(ctx: PlanContext): string {
  return section7Of(withT(ctx));
}

function section8(c: Ctx): string {
  const { profile, inputs, t, locale } = c;
  const rows = [
    ...tableHead(t("plan.s8.colRisk"), t("plan.s8.colPrevent")),
    row(t("plan.s8.lowUptake"), t("plan.s8.lowUptakePrevent")),
    row(t("plan.s8.notFit"), t("plan.s8.notFitPrevent")),
    row(t("plan.s8.staffLeaves"), t("plan.s8.staffLeavesPrevent")),
    row(t("plan.s8.noMoney"), t("plan.s8.noMoneyPrevent")),
    row(t("plan.s8.data"), t("plan.s8.dataPrevent")),
  ];
  if (profile.depopulating && profile.popChange10y !== null) {
    rows.push(
      row(
        t("plan.s8.dispersed", { change: signedPct(profile.popChange10y, locale) }),
        t("plan.s8.dispersedPrevent"),
      ),
    );
  }
  if (profile.kind !== "miejska") {
    rows.push(row(t("plan.s8.travel"), t("plan.s8.travelPrevent")));
  }
  if (inputs.staff === "1") {
    rows.push(row(t("plan.s8.onePerson"), t("plan.s8.onePersonPrevent")));
  }
  return rows.join("\n");
}

function section9(c: Ctx): string {
  const { inputs, t } = c;
  return [
    ...tableHead(
      t("plan.s9.colIndicator"),
      t("plan.s9.colTarget"),
      t("plan.s9.colMeasure"),
    ),
    row(
      t("plan.s9.served"),
      inputs.groupSize ? people(c, inputs.groupSize) : c.todo,
      t("plan.s9.servedMeasure"),
    ),
    row(t("plan.s9.rated"), c.todo, t("plan.s9.ratedMeasure")),
    row(t("plan.s9.trained"), c.todo, t("plan.s9.trainedMeasure")),
    row(t("plan.s9.specific"), c.todo, c.todo),
    row(
      t("plan.s9.decision"),
      t("plan.s9.decisionTarget"),
      t("plan.s9.decisionMeasure"),
    ),
  ].join("\n");
}

function callWindow(c: Ctx, from: string | null, to: string | null): string {
  if (!from && !to) return c.t("plan.notGiven");
  return c.t("plan.s10.windowRange", {
    from: from ? formatDate(from, c.locale) : "?",
    to: to ? formatDate(to, c.locale) : "?",
  });
}

/** Section 10 — the calls exactly as stored in the ROPS calls table. */
function section10Of(c: Ctx): string {
  const { t, locale } = c;
  const status = labelsFor(locale).callStatus;
  const out = [
    t("plan.s10.asOf", { date: formatDate(c.generatedAt, locale) }),
    "",
  ];
  if (c.funding.length === 0) {
    out.push(t("plan.s10.none", { todo: c.todo }));
    return out.join("\n");
  }
  for (const f of c.funding) {
    const en = locale === "en" ? f.en : null;
    const program = en?.program ?? f.program;
    const operator = en?.operator ?? f.operator;
    const purpose = en?.purpose ?? f.purpose;
    const own = en?.ownContribution ?? f.ownContribution;
    const titles = en?.innovationTitles.length
      ? en.innovationTitles
      : f.innovationTitles;
    out.push(`### ${mdText(shortCallName(f.name, locale))}`, "");
    if (program) out.push(`- ${t("plan.s10.program", { value: mdText(program) })}`);
    if (operator)
      out.push(`- ${t("plan.s10.operator", { value: mdText(operator) })}`);
    out.push(
      `- ${t("plan.s10.amount", {
        value: f.amountMax
          ? t("plan.s7.upTo", { money: zl(f.amountMax, locale) })
          : t("plan.notGiven"),
      })}`,
      `- ${t("plan.s10.window", { value: callWindow(c, f.windowFrom, f.windowTo) })}`,
      `- ${t("plan.s10.status", { value: status[f.status] })}`,
    );
    if (purpose) out.push(`- ${t("plan.s10.purpose", { value: mdText(purpose) })}`);
    if (own) out.push(`- ${t("plan.s10.ownContribution", { value: mdText(own) })}`);
    if (f.kind === "usluga-wrazliwa" && titles.length > 0) {
      out.push(
        `- ${
          f.includesInnovation
            ? t("plan.s10.onList")
            : t("plan.s10.notOnList", {
                list: titles
                  .map((x) => t("plan.s10.listItem", { title: mdText(x) }))
                  .join(", "),
              })
        }`,
      );
    }
    if (f.kind === "iws") out.push(`- ${t("plan.s10.iwsNote")}`);
    if (f.sourceUrl) out.push(`- ${t("plan.s10.source", { url: f.sourceUrl })}`);
    out.push("");
  }
  const openUw = c.funding.filter(
    (f) => f.kind === "usluga-wrazliwa" && f.status === "open",
  );
  if (openUw.length > 0) {
    const f = openUw[0]!;
    out.push(
      t("plan.s10.conclusionOpen", {
        name: mdText(shortCallName(f.name, locale)),
        until: f.windowTo
          ? t("plan.s10.until", { date: formatDate(f.windowTo, locale) })
          : "",
        onlyList:
          f.innovationTitles.length > 0 && !f.includesInnovation
            ? t("plan.s10.onlyList")
            : "",
      }),
    );
  } else {
    out.push(t("plan.s10.conclusionClosed", { todo: c.todo }));
  }
  return out.join("\n");
}
export function section10(ctx: PlanContext): string {
  return section10Of(withT(ctx));
}

const BUILDERS: Record<SectionNumber, (c: Ctx) => string> = {
  1: section1,
  2: section2Of,
  3: section3,
  4: section4,
  5: section5,
  6: section6,
  7: section7Of,
  8: section8,
  9: section9,
  10: section10Of,
};

/** Every section with its heading, ready to print. */
export function templateSections(
  ctx: PlanContext,
): Record<SectionNumber, string> {
  const c = withT(ctx);
  const title = cardTitle(ctx.card, ctx.locale);
  return Object.fromEntries(
    SECTION_NUMBERS.map((n) => [
      n,
      `${sectionHeading(n, title, ctx.locale)}\n\n${BUILDERS[n](c)}\n`,
    ]),
  ) as Record<SectionNumber, string>;
}

/** The whole plan without AI. */
export function templatePlan(ctx: PlanContext): string {
  const s = templateSections(ctx);
  return [
    planHeader(ctx),
    ...SECTION_NUMBERS.map((n) => s[n]),
    planFooter(ctx, "template"),
  ].join("\n");
}
