/** Fetch URLs politely through the archive and print where the bytes landed. Usage: tsx scripts/get.ts <url>... */
import { politeFetch } from "./lib/http";

for (const url of process.argv.slice(2)) {
  const r = await politeFetch(url, { allowError: true });
  console.log(`${r.status ?? "?"}\t${r.bytes}\t${r.fromArchive ? "archive" : "fetched"}\t${r.file}\t${url}`);
}
