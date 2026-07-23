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
  maxAgeMinutes: Number(process.env.MAX_AGE_MINUTES || 720), // Standard 12h
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

function similarity(a, b) {
  const A = new Set(normalize(a).split(" ").filter((w) => w.length > 3));
  const B = new Set(normalize(b).split(" ").filter((w) => w.length > 3));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size);
}

// ------------------------- State -------------------------
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

// ------------------------- Feeds -------------------------
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
        transferOnly: Boolean(feed.transferOnly),
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
  const stat = { total: items.length, neu: 0, aktuell: 0, transfer: 0, superlig: 0, final: 0 };

  for (const item of items) {
    if (!item.title || seenIds.has(item.id)) continue;
    stat.neu++;

    if (item.publishedAt && Date.now() - item.publishedAt.getTime() > maxAge) continue;
    stat.aktuell++;

    const haystack = `${item.title} ${item.summary}`;
    if (containsAny(haystack, BLOCK_KEYWORDS)) continue;
    if (!item.transferOnly && !containsAny(haystack, TRANSFER_KEYWORDS)) continue;
    stat.transfer++;

    if (CLUB_FILTER.length && !containsAny(haystack, CLUB_FILTER)) continue;
    stat.superlig++;

    const dup =
      state.some((e) => similarity(e.title, item.title) > CONFIG.similarityThreshold) ||
      out.some((e) => similarity(e.title, item.title) > CONFIG.similarityThreshold);
    if (dup) continue;
    stat.final++;

    out.push(item);
  }

  log(
    `📊 ${stat.total} gesamt → ${stat.neu} ungesehen → ${stat.aktuell} aktuell ` +
    `→ ${stat.transfer} Transfer-Bezug → ${stat.superlig} Süper Lig → ${stat.final} übrig`
  );

  return out.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
}

// ------------------------- Post bauen -------------------------

// Wörter, die auf eine bestätigte Meldung hindeuten
const CONFIRMED = ["resmen", "imzaladi", "imzayi atti", "acikladi", "duyurdu", "tamam", "bitti"];
// Wörter, die auf ein Gerücht hindeuten
const RUMOR = ["iddia", "one suruldu", "gundem", "istiyor", "kanca", "rota", "sicak gelisme", "temas"];

function pickEmoji(title) {
  const n = normalize(title);
  if (CONFIRMED.some((w) => n.includes(normalize(w)))) return "🔴";
  if (RUMOR.some((w) => n.includes(normalize(w)))) return "🟡";
  return "⚪";
}

// Ohne Claude: Schlagzeile aufräumen und mit Quelle ausgeben
function buildPostLocal(item) {
  let title = item.title
    .replace(/\s+/g, " ")
    .replace(/^["'«»]+|["'«»]+$/g, "")
    .trim();

  // Clickbait-Endungen wegkürzen
  title = title.replace(/\s*\.{3,}$/, "");

  const emoji = pickEmoji(title);
  const footer = `\n\n📌 Kaynak: ${item.source}`;
  const maxTitle = 280 - footer.length - emoji.length - 1;

  if (title.length > maxTitle) title = title.slice(0, maxTitle - 1).trim() + "…";

  return `${emoji} ${title}${footer}`;
}

// Mit Claude (nur wenn ANTHROPIC_API_KEY gesetzt ist)
async function buildPostWithClaude(item) {
  const prompt = `Du bist Redakteur für einen türkischen Süper-Lig-Transfer-Account auf X.

SCHLAGZEILE: ${item.title}
TEXT: ${item.summary}
QUELLE: ${item.source}

Schreibe daraus einen eigenständigen Post auf Türkisch. Regeln:
- Formuliere komplett NEU. Übernimm keine Satzteile wörtlich.
- Maximal 200 Zeichen.
- Nur Fakten aus dem Text. Erfinde nichts dazu.
- Gerüchte kennzeichnen ("iddia edildi", "öne sürüldü").
- Starte mit einem Emoji (🔴 bestätigt, 🟡 Gerücht, ⚪ sonstiges).
- Keine Hashtags, keine Links.
- Keine echte Transfer-News? Antworte exakt: SKIP

Gib nur den Post-Text aus.`;

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

// ------------------------- Senden -------------------------
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
    log(`😴 Außerhalb des Zeitfensters (${CONFIG.activeFrom}–${CONFIG.activeTo} Uhr). Ende.`);
    return;
  }

  const useClaude = Boolean(process.env.ANTHROPIC_API_KEY);
  log(useClaude ? "🤖 Modus: Claude schreibt um" : "📰 Modus: Schlagzeile direkt (kostenlos)");

  const hasTelegram = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  const twitter = DRY_RUN ? null : getTwitterClient();
  if (!DRY_RUN && !hasTelegram && !twitter) {
    log("⚠️  Weder Telegram noch X konfiguriert — es wird nichts gesendet.");
  }

  const state = await loadState();
  log(`📚 ${state.length} Einträge im Gedächtnis`);

  const items = await fetchAllFeeds();
  log(`📥 ${items.length} Artikel aus ${FEEDS.length} Feeds geladen`);

  const candidates = filterItems(items, state).slice(0, CONFIG.maxPostsPerRun);
  log(`🎯 ${candidates.length} relevante neue Transfer-News`);

  if (!candidates.length) return;

  let posted = 0;

  for (const item of candidates) {
    try {
      const text = useClaude ? await buildPostWithClaude(item) : buildPostLocal(item);

      if (!DRY_RUN) state.push({ id: item.id, title: item.title, ts: Date.now() });
      if (!text) {
        log(`⏭️  Übersprungen: ${item.title.slice(0, 60)}`);
        continue;
      }

      if (DRY_RUN) {
        log(`\n--- TESTLAUF, nichts gesendet ---\n${text}\n---------------------------------\n`);
      } else {
        if (twitter) await twitter.v2.tweet(text);
        if (hasTelegram) await postToTelegram(text);
        log(`✅ Gesendet: ${text.slice(0, 70)}...`);
      }

      posted++;
      await new Promise((r) => setTimeout(r, 3000));
    } catch (err) {
      log(`❌ Fehler bei "${item.title.slice(0, 50)}":`, err.message);
    }
  }

  if (!DRY_RUN) await saveState(state);
  log(`🏁 Fertig. ${posted} Meldung(en) in diesem Durchlauf.`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
