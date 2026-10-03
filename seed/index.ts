/**
 * Seed entry point: `pnpm db:seed`. One seed file per domain, imported here
 * in dependency order. Each seed is idempotent (upsert) and marks sample
 * records isSample = true.
 */
import { seedLibrary } from "./library";
import { cleanTestCases } from "./clean-tests";
import { seedDemoFlags } from "./demo";
import { seedCalls, seedNetwork } from "./network";
import { seedSampleNeeds } from "~/server/admin/sample-needs";
import { seedSamplePeople } from "~/server/cases/sample-people";

const steps: { name: string; run: () => Promise<unknown> }[] = [
  { name: "library", run: seedLibrary },
  { name: "calls", run: seedCalls },
  { name: "network", run: seedNetwork },
  { name: "people (przykładowi mentorzy)", run: seedSamplePeople },
  { name: "needs (przykładowe potrzeby do trendów)", run: seedSampleNeeds },
  { name: "demo flags", run: seedDemoFlags },
  { name: "clean [test] cases", run: cleanTestCases },
];

async function main() {
  for (const s of steps) {
    console.log(`[seed] ${s.name}…`);
    await s.run();
  }
  console.log("[seed] done");
  process.exit(0);
}

void main();
