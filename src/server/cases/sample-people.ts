/**
 * Four FICTIONAL mentors/experts so triage can suggest someone and the demo
 * expert login („p-mentor-1", see DEMO_STAFF) has a person behind it. Every
 * row is isSample = true and the UI labels it „przykładowe".
 * No `server-only` here: the seed script (tsx) imports it.
 */
import { db } from "~/server/db";
import { people } from "~/server/db/schema";
import type { MapaArea } from "~/lib/domain";

type SamplePerson = typeof people.$inferInsert & { areas: MapaArea[] };

export const SAMPLE_PEOPLE: SamplePerson[] = [
  {
    id: "p-mentor-1",
    displayName: "Anna Kowalczyk",
    role: "mentor",
    title: "Mentorka — seniorzy i opieka wytchnieniowa",
    areas: ["seniors", "disability"],
    orgName: "Stowarzyszenie (przykładowe)",
    bio: "Przykładowa mentorka. Pomaga gminom uruchamiać usługi dla seniorów i opiekunów osób z niepełnosprawnościami.",
    isSample: true,
  },
  {
    id: "p-mentor-2",
    displayName: "Tomasz Mazur",
    role: "expert",
    title: "Ekspert — bezdomność i ubóstwo",
    areas: ["homelessness", "poverty"],
    orgName: "Fundacja (przykładowa)",
    bio: "Przykładowy ekspert. Doradza przy usługach dla osób w kryzysie bezdomności i wychodzeniu z ubóstwa.",
    isSample: true,
  },
  {
    id: "p-mentor-3",
    displayName: "Katarzyna Zając",
    role: "mentor",
    title: "Mentorka — rodzina i zdrowie psychiczne",
    areas: ["family", "mental_health"],
    orgName: "Centrum wsparcia (przykładowe)",
    bio: "Przykładowa mentorka. Wspiera projekty dla rodzin, pieczy zastępczej i profilaktyki zdrowia psychicznego.",
    isSample: true,
  },
  {
    id: "p-mentor-4",
    displayName: "Piotr Wróbel",
    role: "expert",
    title: "Ekspert — integracja cudzoziemców i zdrowie",
    areas: ["migrants", "health"],
    orgName: "Organizacja (przykładowa)",
    bio: "Przykładowy ekspert. Doradza przy usługach integracyjnych i dostępie do opieki zdrowotnej.",
    isSample: true,
  },
];

/**
 * English titles of the sample people, for staff screens in English. Names
 * stay as they are; other modules may use these too.
 */
export const SAMPLE_PEOPLE_EN: Record<
  string,
  { title: string; orgName: string; bio: string }
> = {
  "p-mentor-1": {
    title: "Mentor — older people and respite care",
    orgName: "Association (sample)",
    bio: "A sample mentor. Helps municipalities set up services for older people and for carers of people with disabilities.",
  },
  "p-mentor-2": {
    title: "Expert — homelessness and poverty",
    orgName: "Foundation (sample)",
    bio: "A sample expert. Advises on services for people experiencing homelessness and on routes out of poverty.",
  },
  "p-mentor-3": {
    title: "Mentor — families and mental health",
    orgName: "Support centre (sample)",
    bio: "A sample mentor. Supports projects for families, foster care and mental health prevention.",
  },
  "p-mentor-4": {
    title: "Expert — integration of foreigners and health",
    orgName: "Organisation (sample)",
    bio: "A sample expert. Advises on integration services and on access to health care.",
  },
};

/** A person's title in the viewer's language (English only for the sample people). */
export function personTitle(
  p: { id: string; title: string | null },
  locale: string,
): string | null {
  return locale === "en" ? (SAMPLE_PEOPLE_EN[p.id]?.title ?? p.title) : p.title;
}

/** Idempotent upsert of the sample people. */
export async function seedSamplePeople(): Promise<void> {
  for (const p of SAMPLE_PEOPLE) {
    await db
      .insert(people)
      .values(p)
      .onConflictDoUpdate({
        target: people.id,
        set: {
          displayName: p.displayName,
          role: p.role,
          title: p.title,
          areas: p.areas,
          orgName: p.orgName,
          bio: p.bio,
          isSample: true,
        },
      });
  }
}

