// ============================================================
//  QUELLEN — hier trägst du alles ein, was der Bot lesen soll
// ============================================================
//
//  name  = wird als "Kaynak: X" unter dem Post genannt
//  url   = RSS-Feed URL
//
//  Neue Quelle hinzufügen? Einfach eine Zeile anhängen.
//  Vorher testen mit:  npm run check-feeds
//

export const FEEDS = [
  // --- Fotomaç (verifiziert, hat einen reinen Transfer-Feed) ---
  { name: "Fotomaç", url: "https://www.fotomac.com.tr/rss/transfer.xml" },
  { name: "Fotomaç", url: "https://www.fotomac.com.tr/rss/superlig.xml" },
  { name: "Fotomaç", url: "https://www.fotomac.com.tr/rss/galatasaray.xml" },
  { name: "Fotomaç", url: "https://www.fotomac.com.tr/rss/fenerbahce.xml" },
  { name: "Fotomaç", url: "https://www.fotomac.com.tr/rss/besiktas.xml" },
  { name: "Fotomaç", url: "https://www.fotomac.com.tr/rss/trabzonspor.xml" },

  // --- Weitere Quellen: mit `npm run check-feeds` testen, ob sie laufen ---
  { name: "A Spor", url: "https://www.aspor.com.tr/rss/anasayfa.xml" },
  { name: "NTV Spor", url: "https://www.ntvspor.net/rss" },
  { name: "Sporx", url: "https://www.sporx.com/rss/anasayfa.xml" },

  // --- Google News: fängt Scoops namentlich genannter Journalisten ab ---
  // Ersetz die Namen durch die aus deiner Liste. So bekommst du z.B.
  // "Yağız Sabuncuoğlu duyurdu: ..." Artikel automatisch rein.
  {
    name: "Google News",
    url:
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent(
        '"Yağız Sabuncuoğlu" OR "Ertan Süzgün" OR "Nevzat Dindar" transfer'
      ) +
      "&hl=tr&gl=TR&ceid=TR:tr",
  },
];

// Nur Artikel, die mindestens EINS davon enthalten, werden verarbeitet.
export const TRANSFER_KEYWORDS = [
  "transfer", "imza", "anlaşma", "anlaştı", "bonservis", "sözleşme",
  "teklif", "görüşme", "kiralık", "ayrılık", "resmen", "gündem",
  "prensip", "el sıkıştı", "İstanbul'a geliyor", "sağlık kontrol",
];

// Wenn eins davon vorkommt, wird der Artikel VERWORFEN.
// Hält Nicht-Transfer-Rauschen raus.
export const BLOCK_KEYWORDS = [
  "basketbol", "voleybol", "NBA", "Euroleague", "tenis", "Formula",
  "at yarışı", "iddaa", "kupon", "burç", "magazin", "dizi",
];

// Nur Süper Lig: Artikel muss einen dieser Klubs erwähnen.
// Auf [] setzen, wenn du den Filter nicht willst.
export const CLUB_FILTER = [
  "Galatasaray", "Fenerbahçe", "Beşiktaş", "Trabzonspor", "Başakşehir",
  "Samsunspor", "Göztepe", "Konyaspor", "Kasımpaşa", "Alanyaspor",
  "Rizespor", "Kayserispor", "Gaziantep", "Eyüpspor", "Kocaelispor",
  "Gençlerbirliği", "Antalyaspor", "Karagümrük", "Çorum", "Erzurumspor",
  "Amed", "Süper Lig", "Cimbom", "Aslan", "Kartal", "Kanarya", "Bordo",
];
