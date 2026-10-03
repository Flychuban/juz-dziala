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
