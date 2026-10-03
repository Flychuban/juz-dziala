"use client";

import { useId, useMemo } from "react";

import {
  AUTHOR_ROLE_LABEL,
  AUTHOR_ROLES,
  CONTACT_PREF_LABEL,
  CONTACT_PREFS,
  type AuthorRole,
  type ContactPref,
} from "~/lib/domain";
import { contactProblem } from "~/server/ideas/schema";
import { CheckLine, ChoiceCards, TextField } from "./form";

/** Gminas and powiats as the server pages pass them (data/gminas.json + powiaty.json). */
export type GminaOption = { teryt: string; name: string; kind: string; powiatTeryt: string };
export type PowiatOption = { teryt: string; name: string };

const selectClass =
  "border-input bg-background text-foreground min-h-12 w-full rounded-md border-2 px-3 py-2 text-lg disabled:opacity-60";

/**
 * Two plain selects — powiat, then gmina — rather than one list of 183: easier
 * to scan, and native selects work with every screen reader and on phones.
 */
export function GminaPicker({
  gminas,
  powiaty,
  value,
  onChange,
  label = "Twoja gmina",
}: {
  gminas: readonly GminaOption[];
  powiaty: readonly PowiatOption[];
  value: string | undefined;
  onChange: (teryt: string | undefined) => void;
  label?: string;
}) {
  const pId = useId();
  const gId = useId();
  const current = gminas.find((g) => g.teryt === value);
  const powiat = current?.powiatTeryt ?? (value?.length === 4 ? value : undefined);
  const inPowiat = useMemo(() => gminas.filter((g) => g.powiatTeryt === powiat), [gminas, powiat]);
  if (gminas.length === 0) return null;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-lg font-semibold">
        {label} <span className="text-muted-foreground font-normal">(nieobowiązkowe)</span>
      </legend>
      <p className="text-muted-foreground mb-3">Dzięki temu ROPS zobaczy, gdzie w Małopolsce jest potrzeba. Nie podajemy adresu.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={pId} className="font-semibold">
            Powiat
          </label>
          <select
            id={pId}
            className={selectClass}
            value={powiat ?? ""}
            onChange={(e) => onChange(e.target.value ? e.target.value : undefined)}
          >
            <option value="">— nie wybieram —</option>
            {powiaty.map((p) => (
              <option key={p.teryt} value={p.teryt}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={gId} className="font-semibold">
            Gmina
          </label>
          <select
            id={gId}
            className={selectClass}
            value={current?.teryt ?? ""}
            disabled={!powiat}
            onChange={(e) => onChange(e.target.value ? e.target.value : powiat)}
          >
            <option value="">{powiat ? "— wybierz gminę —" : "— najpierw wybierz powiat —"}</option>
            {inPowiat.map((g) => (
              <option key={g.teryt} value={g.teryt}>
                {inPowiat.filter((x) => x.name === g.name).length > 1 ? `${g.name} (gmina ${g.kind})` : g.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </fieldset>
  );
}

/** A picked powiat without a gmina is not a gmina TERYT — send only full 7-digit codes. */
export function gminaOrUndefined(v: string | undefined): string | undefined {
  return v && /^12\d{5}$/.test(v) ? v : undefined;
}

export type WhoFields = { authorRole: AuthorRole; onBehalf: boolean };

export function WhoFieldset({
  value,
  onChange,
  legend = "Kim jesteś?",
}: {
  value: WhoFields;
  onChange: (v: WhoFields) => void;
  legend?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ChoiceCards
        legend={legend}
        name="authorRole"
        options={AUTHOR_ROLES.map((r) => ({ value: r, label: AUTHOR_ROLE_LABEL[r] }))}
        value={value.authorRole}
        onChange={(authorRole) => onChange({ ...value, authorRole })}
        columns={2}
      />
      <CheckLine
        label="Zgłaszam w imieniu innej osoby lub grupy"
        description="Na przykład w imieniu mamy, sąsiada albo podopiecznych."
        checked={value.onBehalf}
        onChange={(onBehalf) => onChange({ ...value, onBehalf })}
      />
    </div>
  );
}

export type ContactValue = { contactPref: ContactPref; contact: string };

export function ContactFieldset({
  value,
  onChange,
  legend = "Jak mamy się z Tobą kontaktować?",
}: {
  value: ContactValue;
  onChange: (v: ContactValue) => void;
  legend?: string;
}) {
  const needs = value.contactPref !== "none";
  return (
    <div className="flex flex-col gap-4">
      <ChoiceCards
        legend={legend}
        hint="Zaszyfrujemy go i pokażemy tylko w skróconej formie. Odpowiedź zobaczysz też po kodzie sprawy."
        optional
        name="contactPref"
        options={CONTACT_PREFS.map((p) => ({ value: p, label: CONTACT_PREF_LABEL[p] }))}
        value={value.contactPref}
        onChange={(contactPref) => onChange({ ...value, contactPref })}
        columns={2}
      />
      {needs ? (
        <TextField
          label={value.contactPref === "email" ? "Adres e-mail" : "Numer telefonu"}
          type={value.contactPref === "email" ? "email" : "tel"}
          inputMode={value.contactPref === "email" ? "email" : "tel"}
          autoComplete={value.contactPref === "email" ? "email" : "tel"}
          value={value.contact}
          onChange={(contact) => onChange({ ...value, contact })}
          maxLength={200}
          required
        />
      ) : null}
    </div>
  );
}

/** Polish validation message for the contact step, or null. */
export function contactError(v: ContactValue): string | null {
  return v.contactPref === "none" ? null : contactProblem(v.contactPref, v.contact);
}
