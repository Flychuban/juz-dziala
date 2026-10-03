/**
 * Seed entry point: `pnpm db:seed`. One seed file per domain, imported here
 * in dependency order. Each seed is idempotent (upsert) and marks sample
 * records isSample = true.
 */
import { seedLibrary } from "./library";
import { seedCalls, seedNetwork } from "./network";

const steps: { name: string; run: () => Promise<void> }[] = [
  { name: "library", run: seedLibrary },
  { name: "calls", run: seedCalls },
  { name: "network", run: seedNetwork },
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
