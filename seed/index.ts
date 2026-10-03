/**
 * Seed entry point: `pnpm db:seed`. One seed file per domain, imported here
 * in dependency order. Each seed is idempotent (upsert) and marks sample
 * records isSample = true.
 */
const steps: { name: string; run: () => Promise<void> }[] = [];

async function main() {
  for (const s of steps) {
    console.log(`[seed] ${s.name}…`);
    await s.run();
  }
  console.log("[seed] done");
  process.exit(0);
}

void main();
