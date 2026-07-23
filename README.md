# Süper Lig Transfer Bot

Liest Transfer-News aus RSS-Feeds türkischer Sportmedien, lässt Claude daraus
einen eigenen kurzen Post schreiben und veröffentlicht ihn mit Quellenangabe —
täglich zwischen 12:00 und 02:00 Uhr, vollautomatisch über GitHub Actions.

---

## Warum RSS statt Twitter-Timelines?

Das war der ursprüngliche Plan, aber er geht nicht mehr auf:

Seit Februar 2026 hat X keinen kostenlosen API-Tier mehr. Neue Entwickler landen
bei Pay-per-Use — ungefähr **$0,005 pro gelesenem Post**. Zwanzig Journalisten
alle 30 Minuten abfragen kostet dich grob **40–60 € im Monat**.

Und die "kostenlosen" Umwege taugen nichts:

| Weg | Problem |
|---|---|
| Nitter-Instanzen | Fast alle seit 2024 tot |
| Selenium / Puppeteer mit deinem Login | Verstößt gegen die X-Nutzungsbedingungen, Account-Ban-Risiko |
| Inoffizielle Scraper-Libraries | Gehen ständig kaputt, gleiches Ban-Risiko |

**Die Lösung:** Wenn Yağız Sabuncuoğlu oder Ertan Süzgün etwas raushauen, steht
es innerhalb von Minuten bei Fotomaç, A Spor und Sporx — und die haben
kostenlose, offizielle RSS-Feeds. Fotomaç hat sogar einen reinen Transfer-Feed.
Du verlierst vielleicht 2–5 Minuten gegenüber dem Original-Tweet, zahlst dafür
nichts und riskierst deinen Account nicht.

Zusätzlich liegt ein Google-News-Feed drin, der gezielt nach Journalisten-Namen
sucht. Damit fängst du auch "Sabuncuoğlu duyurdu: …"-Artikel ab.

---

## Was kostet der Betrieb?

| Posten | Kosten |
|---|---|
| GitHub Actions | 0 € (öffentliches Repo = unbegrenzt) |
| RSS-Feeds lesen | 0 € |
| Claude API | ca. 1–3 € / Monat bei ~10 Posts pro Tag |
| X-API (nur Schreiben) | $0,015 pro Post ≈ **4–5 € / Monat** |
| Telegram statt X | 0 € |

**Wichtig:** Ein Post **mit Link** kostet auf X $0,20 statt $0,015 — das
Dreizehnfache. Deshalb schreibt der Bot bewusst nur `📌 Kaynak: Fotomaç` als
Text statt einen Link zu setzen. Bau da keinen Link rein, sonst zahlst du bei
300 Posts/Monat 60 € statt 4,50 €.

Wenn du erstmal gar nichts zahlen willst: nur Telegram konfigurieren, X-Secrets
leer lassen. Der Bot läuft dann komplett kostenlos und du siehst genau, was er
posten *würde*.

---

## Einrichtung

### 1. Repository anlegen

Neues **öffentliches** GitHub-Repo (privat hat nur 2000 Actions-Minuten/Monat,
öffentlich ist unbegrenzt). Alle Dateien aus diesem Ordner hochladen.

### 2. Claude API Key

1. [console.anthropic.com](https://console.anthropic.com) → Account anlegen
2. Guthaben aufladen (5 $ reicht für Monate)
3. **API Keys** → **Create Key** → kopieren

### 3. X Developer Account

1. [developer.x.com](https://developer.x.com) → mit deinem Account einloggen
2. Projekt + App anlegen
3. Bei **User authentication settings**: App permissions auf **Read and Write**
   stellen — sonst kann der Bot nicht posten
4. Unter **Keys and tokens** vier Werte erzeugen und kopieren:
   - API Key → `X_APP_KEY`
   - API Key Secret → `X_APP_SECRET`
   - Access Token → `X_ACCESS_TOKEN`
   - Access Token Secret → `X_ACCESS_SECRET`

> Falls du die Access Tokens **vor** dem Umstellen auf "Read and Write" erzeugt
> hast: neu generieren. Sonst kommt beim Posten Fehler 403.

**Dein X-Passwort brauchst du hier nirgends** und solltest es auch nirgends
eintragen. Nur die vier Keys. Die kannst du jederzeit widerrufen, ohne dein
Passwort zu ändern.

### 4. Telegram (optional, aber gut zum Testen)

1. In Telegram [@BotFather](https://t.me/botfather) anschreiben → `/newbot`
   → Name eingeben → Username eingeben (**muss auf `bot` enden**)
2. Token kopieren → `TELEGRAM_BOT_TOKEN`
3. Kanal anlegen, deinen Bot als **Admin** hinzufügen (nur Admins dürfen posten)
4. Irgendwas in den Kanal schreiben
5. Chat-ID holen — diese URL im Browser öffnen, Token einsetzen:
   ```
   https://api.telegram.org/bot<DEIN_TOKEN>/getUpdates
   ```
   Im JSON nach `"chat":{"id":-100...}` suchen. Diese Zahl **mit Minus** ist
   deine `TELEGRAM_CHAT_ID`.
6. Testen, ob es funktioniert:
   ```
   https://api.telegram.org/bot<DEIN_TOKEN>/sendMessage?chat_id=<CHAT_ID>&text=test
   ```
   Kommt "test" im Kanal an, passt alles.

> Ohne Kanal geht es auch: Schreib dem Bot direkt `/start`, dann `getUpdates`
> aufrufen. Die ID ist dann eine positive Zahl ohne Minus. Bots dürfen dir erst
> schreiben, nachdem du ihnen einmal geschrieben hast.

### 5. Secrets in GitHub eintragen

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Name | Pflicht |
|---|---|
| `ANTHROPIC_API_KEY` | ja |
| `X_APP_KEY` | für X |
| `X_APP_SECRET` | für X |
| `X_ACCESS_TOKEN` | für X |
| `X_ACCESS_SECRET` | für X |
| `TELEGRAM_BOT_TOKEN` | für Telegram |
| `TELEGRAM_CHAT_ID` | für Telegram |

### 6. Testlauf

Repo → **Actions** → **Süper Lig Transfer Bot** → **Run workflow**
→ `dry_run` auf **true** lassen → starten.

Im Log siehst du genau, was der Bot posten würde, ohne dass etwas rausgeht.
Sieht gut aus? Nochmal starten mit `dry_run` auf **false**.

Danach läuft er automatisch alle 30 Minuten im Zeitfenster.

---

## Anpassen

### Quellen ändern

Alles in `src/sources.js`. Neue Zeitung hinzufügen:

```js
{ name: "Sabah Spor", url: "https://www.sabah.com.tr/rss/spor.xml" },
```

Danach lokal prüfen, ob der Feed lebt:

```bash
npm install
npm run check-feeds
```

Feeds, die ❌ zeigen, einfach wieder rauslöschen.

### Journalisten-Liste einbauen

Deine lange Liste kommt in den Google-News-Feed unten in `sources.js`. Namen in
Anführungszeichen, mit `OR` getrennt:

```js
'"Yağız Sabuncuoğlu" OR "Ertan Süzgün" OR "Nevzat Dindar" OR "Sercan Hamzaoğlu" transfer'
```

So werden Artikel gefunden, in denen diese Journalisten namentlich als Quelle
genannt werden.

### Häufigkeit und Menge

In `src/bot.js` ganz oben bei `CONFIG`:

```js
maxPostsPerRun: 3,      // wie viele Posts pro Durchlauf maximal
maxAgeMinutes: 180,     // alles Ältere wird ignoriert
activeFrom: 12,         // Startstunde
activeTo: 2,            // Endstunde
```

Öfter als alle 30 Minuten prüfen: in `.github/workflows/transfer-bot.yml` das
`*/30` auf `*/15` ändern.

### Ton der Posts ändern

Der Prompt steht in `src/bot.js` in der Funktion `writePost()`. Da kannst du
alles umstellen — Sprache, Länge, Emojis, Stil.

---

## Wie der Bot Doppel-Posts vermeidet

Drei Ebenen:

1. **ID-Abgleich** — jeder Artikel wird über seine GUID gemerkt (`state/seen.json`)
2. **Ähnlichkeitsprüfung** — dieselbe News von Fotomaç, A Spor *und* Sporx wird
   über Wortüberschneidung erkannt und nur einmal gepostet
3. **Claude-Filter** — was keine echte Transfer-News ist, antwortet mit `SKIP`
   und fliegt raus

`state/seen.json` wird nach jedem Lauf automatisch ins Repo zurückgeschrieben.
Nicht löschen, sonst postet der Bot alte News nochmal.

---

## Was du wissen solltest

**Der Bot ist nicht sekundenschnell.** GitHub-Actions-Cron ist auf kostenlosen
Runnern oft 5–15 Minuten verzögert. Plus 2–5 Minuten, bis die Zeitung die News
hat. Realistisch bist du **10–20 Minuten nach dem Original-Tweet** dran. Für
einen Aggregator-Account reicht das; ein Wettrennen gegen Fabrizio Romano
gewinnst du damit nicht.

**GitHub schaltet Cron-Jobs nach 60 Tagen ohne Repo-Aktivität ab.** Der Bot
committet bei jedem Lauf `seen.json`, damit passiert das normalerweise nicht.
Trotzdem alle paar Wochen mal reinschauen.

**Zur Quellenangabe:** Fakten sind nicht urheberrechtlich geschützt, Formulierungen
schon. Der Prompt weist Claude explizit an, komplett neu zu formulieren statt
umzustellen — und die Quelle steht unter jedem Post. Bau das nicht auf reines
Copy-Paste um: das ist rechtlich angreifbar, und Aggregator-Accounts, die
wörtlich abschreiben, werden von den Zeitungen auch gemeldet.

**Prüfe die ersten Tage mit.** Claude erfindet nichts dazu, aber wenn die
Ausgangsmeldung Quatsch ist, ist der Post auch Quatsch. Türkische Sportpresse
und Transfergerüchte — du weißt, wie das läuft. Der Bot kennzeichnet Gerüchte
mit 🟡, aber lies die ersten 20–30 Posts gegen.

---

## Fehlerbehebung

| Fehler | Ursache |
|---|---|
| `403 Forbidden` beim Posten | App-Permissions nicht auf "Read and Write", oder Access Tokens vor der Umstellung erzeugt |
| `401 Unauthorized` | Keys falsch kopiert (Leerzeichen am Ende?) |
| `429 Too Many Requests` | Rate Limit — `maxPostsPerRun` runtersetzen |
| Feed liefert 403 | Zeitung blockt den Bot; Feed rauswerfen oder anderen nehmen |
| Workflow startet nicht | Actions im Repo aktiviert? Läuft er außerhalb 12–02 Uhr? |
| Bot postet nichts | Ist normal — im Log steht, wie viele Artikel gefiltert wurden |
