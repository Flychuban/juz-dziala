import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MESSAGES_EN, MESSAGES_PL } from "./messages";

type Tree = { [k: string]: string | Tree };

function leaves(t: object, prefix = ""): [string, string][] {
  return Object.entries(t as Tree).flatMap(([k, v]) =>
    typeof v === "string" ? [[`${prefix}${k}`, v] as [string, string]] : leaves(v, `${prefix}${k}.`),
  );
}

const PROPER = (JSON.parse(readFileSync(join(process.cwd(), "messages", "proper-names.json"), "utf8")) as string[])
  .sort((a, b) => b.length - a.length);

/** English text with proper names, quoted Polish terms („…”) and ICU arguments removed. */
function strip(s: string) {
  let out = s.replace(/„[^”]*”/g, "").replace(/\{[^{}]*\}/g, "");
  for (const p of PROPER) out = out.split(p).join("");
  return out;
}

describe("messages", () => {
  const pl = leaves(MESSAGES_PL);
  const en = new Map(leaves(MESSAGES_EN));

  it("English has every Polish key (and nothing extra)", () => {
    const missing = pl.filter(([k]) => !en.has(k)).map(([k]) => k);
    const extra = [...en.keys()].filter((k) => !pl.some(([p]) => p === k));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it("English strings contain no Polish letters outside proper names and quoted terms", () => {
    // common.lang is written in the language you switch TO (the „Polski" link).
    const polish = [...en.entries()].filter(
      ([k, v]) => !k.startsWith("common.lang.") && /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(strip(v)),
    );
    expect(polish.map(([k, v]) => `${k}: ${v}`)).toEqual([]);
  });

  it("no empty strings", () => {
    const empty = [...pl, ...en.entries()].filter(([, v]) => !v.trim()).map(([k]) => k);
    expect(empty).toEqual([]);
  });
});
