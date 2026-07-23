import fs from "node:fs/promises";
import path from "node:path";
import Parser from "rss-parser";
import { TwitterApi } from "twitter-api-v2";
import { FEEDS, TRANSFER_KEYWORDS, BLOCK_KEYWORDS, CLUB_FILTER } from "./sources.js";

// ------------------------- Einstellungen -------------------------
const CONFIG = {
  timezone: "Europe/Berlin",
  activeFrom: 12,          // ab 12:00 Uhr
  activeTo: 2,             // bis 02:00 Uhr (nachts)
  maxPostsPerRun: 3,       // Spam-Bremse
  maxAgeMinutes: 180,      // älter als 3h wird ignoriert
  similarityThreshold: 0.6,// gegen Doppel-News aus verschiedenen Quellen
  stateFile: path.join(process.cwd(), "state", "seen.json"),
  stateKeepDays: 5,
};

const DRY_RUN = process.env.DRY_RUN === "true";
const IGNORE_TIME_WINDOW = process.env.IGNORE_TIME_WINDOW === "true";

// ------------------------- Hilfsfunktionen -------------------------
const log = (...a) => console.log(new Date().toISOString(), "|", ...a);

function currentHourIn(tz) {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hour: "2-digit", hour12: false,
    }).format(new Date())
  );
}

// Aktiv-Fenster, das über Mitternacht geht (12 -> 2)
function isWithinActiveWindow() {
  if (IGNORE_TIME_WINDOW) return true;
  const h = currentHourIn(CONFIG.timezone);
  const { activeFrom: from, activeTo: to } = CONFIG;
  return from <= to ? h >= from && h < to : h >= from || h < to;
}

function normalize(s = "") {
  return s
    .toLowerCase()
    .replace(/[İI]/g, "i").replace(/ı/g, "i")
    .replace(/[şŞ]/g, "s").replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text, list) {
  const n = normalize(text);
  return list.some((k) => n.includes(normalize(k)));
}

// Jaccard-Ähnlichkeit über Wörter — erkennt dieselbe News in anderer Formulierung
function similarity(a, b) {
  const A = new Set(normalize(a).split(" ").filter((w) => w.length > 3));
  const B = new Set(normalize(b).split(" ").filter((w) => w.length > 3));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size);
}

// ------------------------- State (bereits gepostet) -------------------------
async function loadState() {
  try {
    const raw = await fs.readFile(CONFIG.stateFile, "utf8");
    const parsed = JSON.parse(raw);
    const cutoff = Date.now() - CONFIG.stateKeepDays * 864e5;
    return (Array.isArray(parsed) ? parsed : []).filter((e) => e.ts > cutoff);
  } catch {
    return [];
  }
}

async function saveState(state) {
  await fs.mkdir(path.dirname(CONFIG.stateFile), { recursive: true });
  await fs.writeFile(CONFIG.stateFile, JSON.stringify(state, null, 2));
}

// ------------------------- Feeds einlesen -------------------------
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; TransferBot/1.0)" },
});

async function fetchAllFeeds() {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items || []).map((item) => ({
        source: feed.name,
        title: (item.title || "").trim(),
        summary: (item.contentSnippet || item.content || "").trim().slice(0, 600),
        link: item.link || "",
        publishedAt: item.isoDate ? new Date(item.isoDate) : null,
        id: item.guid || item.link || item.title,
      }));
    })
  );

  const items = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else log(`⚠️  Feed nicht erreichbar: ${FEEDS[i].url} (${r.reason?.message})`);
  });
  return items;
}

// ------------------------- Filtern -------------------------
function filterItems(items, state) {
  const seenIds = new Set(state.map((e) => e.id));
  const maxAge = CONFIG.maxAgeMinutes * 60_000;
  const out = [];

  for (const item of items) {
    if (!item.title || seenIds.has(item.id)) continue;

    // Zu alt?
    if (item.publishedAt && Date.now() - item.publishedAt.getTime() > maxAge) continue;

    const haystack = `${item.title} ${item.summary}`;
    if (!containsAny(haystack, TRANSFER_KEYWORDS)) continue;
    if (containsAny(haystack, BLOCK_KEYWORDS)) continue;
    if (CLUB_FILTER.length && !containsAny(haystack, CLUB_FILTER)) continue;

    // Gleiche News schon in State oder in dieser Runde?
    const dup =
      state.some((e) => similarity(e.title, item.title) > CONFIG.similarityThreshold) ||
      out.some((e) => similarity(e.title, item.title) > CONFIG.similarityThreshold);
    if (dup) continue;

    out.push(item);
  }

  // Neueste zuerst
  return out.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
}

// ------------------------- Claude: Post schreiben -------------------------
async function writePost(item) {
  const prompt = `Du bist Redakteur für einen türkischen Süper-Lig-Transfer-Account auf X.

SCHLAGZEILE: ${item.title}
TEXT: ${item.summary}
QUELLE: ${item.source}

Schreibe daraus einen eigenständigen Post auf Türkisch. Regeln:
- Formuliere komplett NEU. Übernimm keine Satzteile wörtlich.
- Maximal 200 Zeichen, damit die Quellenzeile noch reinpasst.
- Nur Fakten aus dem Text. Erfinde nichts dazu, übertreibe nicht.
- Wenn es ein Gerücht ist, kennzeichne es ("iddia edildi", "öne sürüldü").
- Starte mit einem passenden Emoji (🔴 bestätigt, 🟡 Gerücht, ⚪ sonstiges).
- Keine Hashtags, keine Links, keine Anführungszeichen um den Post.
- Wenn es KEINE echte Transfer-News ist, antworte exakt: SKIP

Gib nur den Post-Text aus, sonst nichts.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();

  if (!text || text === "SKIP") return null;
  return `${text}\n\n📌 Kaynak: ${item.source}`;
}

// ------------------------- Posten -------------------------
function getTwitterClient() {
  const { X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
  if (!X_APP_KEY || !X_APP_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) return null;
  return new TwitterApi({
    appKey: X_APP_KEY,
    appSecret: X_APP_SECRET,
    accessToken: X_ACCESS_TOKEN,
    accessSecret: X_ACCESS_SECRET,
  });
}

async function postToTelegram(text) {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = process.env;
  if (!token || !chat) return false;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text }),
  });
  if (!res.ok) log("⚠️  Telegram-Fehler:", await res.text());
  return res.ok;
}

// ------------------------- Ablauf -------------------------
async function main() {
  if (!isWithinActiveWindow()) {
    log(`😴 Außerhalb des Zeitfensters (${CONFIG.activeFrom}–${CONFIG.activeTo} Uhr ${CONFIG.timezone}). Ende.`);
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY fehlt");

  const state = await loadState();
  log(`📚 ${state.length} Einträge im Gedächtnis`);

  const items = await fetchAllFeeds();
  log(`📥 ${items.length} Artikel aus ${FEEDS.length} Feeds geladen`);

  const candidates = filterItems(items, state).slice(0, CONFIG.maxPostsPerRun);
  log(`🎯 ${candidates.length} relevante neue Transfer-News`);

  if (!candidates.length) return;

  const twitter = DRY_RUN ? null : getTwitterClient();
  let posted = 0;

  for (const item of candidates) {
    try {
      const text = await writePost(item);

      // Auch bei SKIP merken, damit wir es nicht nochmal an Claude schicken
      state.push({ id: item.id, title: item.title, ts: Date.now() });
      if (!text) {
        log(`⏭️  Übersprungen (keine echte News): ${item.title.slice(0, 60)}`);
        continue;
      }

      if (DRY_RUN) {
        log(`\n--- TESTLAUF, nichts gepostet ---\n${text}\n---------------------------------\n`);
      } else {
        if (twitter) await twitter.v2.tweet(text);
        await postToTelegram(text);
        log(`✅ Gepostet: ${text.slice(0, 70)}...`);
      }

      posted++;
      await new Promise((r) => setTimeout(r, 3000)); // kurze Pause
    } catch (err) {
      log(`❌ Fehler bei "${item.title.slice(0, 50)}":`, err.message);
    }
  }

  await saveState(state);
  log(`🏁 Fertig. ${posted} Post(s) in diesem Durchlauf.`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
