// Prüft, welche Feeds aus sources.js tatsächlich erreichbar sind.
// Aufruf:  npm run check-feeds

import Parser from "rss-parser";
import { FEEDS } from "./sources.js";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; TransferBot/1.0)" },
});

console.log(`\nTeste ${FEEDS.length} Feeds...\n`);

let ok = 0;
for (const feed of FEEDS) {
  try {
    const parsed = await parser.parseURL(feed.url);
    const n = parsed.items?.length ?? 0;
    const newest = parsed.items?.[0]?.title?.slice(0, 60) ?? "-";
    console.log(`✅ ${feed.name.padEnd(14)} ${String(n).padStart(3)} Artikel  | ${newest}`);
    ok++;
  } catch (err) {
    console.log(`❌ ${feed.name.padEnd(14)} FEHLER: ${err.message}`);
    console.log(`   ${feed.url}`);
  }
}

console.log(`\n${ok}/${FEEDS.length} Feeds laufen. Kaputte Zeilen in src/sources.js löschen.\n`);
