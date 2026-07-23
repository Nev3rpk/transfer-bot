// ============================================================
//  QUELLEN — hier trägst du alles ein, was der Bot lesen soll
// ============================================================
//
//  name        = wird als "Kaynak: X" unter dem Post genannt
//  url         = RSS-Feed URL
//  transferOnly = true  -> Feed enthält NUR Transfer-News,
//                          Stichwort-Filter wird übersprungen
//
//  Testen mit:  npm run check-feeds
//

export const FEEDS = [
  // --- Fotomaç ---
  { name: "Fotomaç", url: "https://www.fotomac.com.tr/rss/transfer.xml", transferOnly: true },
  { name: "Fotomaç", url: "https://www.fotomac.com.tr/rss/superlig.xml" },
  { name: "Fotomaç", url: "https://www.fotomac.com.tr/rss/galatasaray.xml" },
  { name: "Fotomaç", url: "https://www.fotomac.com.tr/rss/fenerbahce.xml" },
  { name: "Fotomaç", url: "https://www.fotomac.com.tr/rss/besiktas.xml" },
  { name: "Fotomaç", url: "https://www.fotomac.com.tr/rss/trabzonspor.xml" },

  // --- A Spor ---
  { name: "A Spor", url: "https://www.aspor.com.tr/rss/anasayfa.xml" },

  // --- Sporx (korrigierte Adresse) ---
  { name: "Sporx", url: "https://www.sporx.com/son-dakika-rss" },

  // --- Google News: fängt Scoops namentlich genannter Journalisten ab ---
  // Deine Journalisten-Liste kommt hier rein, mit OR getrennt.
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

// Artikel muss mindestens EINS davon enthalten (außer bei transferOnly-Feeds).
export const TRANSFER_KEYWORDS = [
  // klassisch
  "transfer", "imza", "anlaşma", "anlaştı", "bonservis", "sözleşme",
  "teklif", "görüşme", "kiralık", "kiraya", "ayrılık", "ayrılıyor",
  "resmen", "gündem", "prensip", "el sıkıştı", "sağlık kontrol",
  // wie türkische Schlagzeilen wirklich klingen
  "rota", "kanca", "gözünü dikti", "istiyor", "peşinde", "takip",
  "geliyor", "gidiyor", "yolcu", "veda", "bitiriyor", "bitirdi",
  "gelişme", "iddia", "öne sürüldü", "duyurdu", "açıkladı",
  "kadrosuna", "kadroya", "yeni transferi", "hedefinde", "temas",
  "milyon euro", "opsiyon", "menajer", "görüştü", "masada",
  "yıldız", "bombası", "harekete geçti", "devrede", "karar",
];

// Wenn eins davon vorkommt, wird der Artikel VERWORFEN.
export const BLOCK_KEYWORDS = [
  // andere Sportarten
  "basketbol", "voleybol", "NBA", "Euroleague", "tenis", "Formula",
  "at yarışı", "iddaa", "kupon", "burç", "magazin", "dizi",
  "güreş", "boks", "yüzme", "atletizm", "hentbol", "sutopu",
  "para tekvando", "golf", "bilardo", "judo", "olimpiyat",
  // Spielvorschauen / Live-Ticker — keine Transfer-News
  "hangi kanalda", "saat kaçta", "muhtemel 11", "ilk 11",
  "maçı canlı", "canlı anlatım", "canlı izle", "canlı skor",
  "ne zaman, saat", "maç önü", "puan durumu", "fikstür",
  "maçı ne zaman", "hangi kanaldan", "şifresiz mi",
  "maç sonucu", "maçın ardından", "kadro açıklandı",
];

// Nur Süper Lig: Artikel muss einen dieser Klubs erwähnen.
// Auf [] setzen, wenn du den Filter nicht willst.
export const CLUB_FILTER = [
  "Galatasaray", "Fenerbahçe", "Beşiktaş", "Trabzonspor", "Başakşehir",
  "Samsunspor", "Göztepe", "Konyaspor", "Kasımpaşa", "Alanyaspor",
  "Rizespor", "Kayserispor", "Gaziantep", "Eyüpspor", "Kocaelispor",
  "Gençlerbirliği", "Antalyaspor", "Karagümrük", "Çorum", "Erzurumspor",
  "Amed", "Süper Lig", "Cimbom", "Aslan", "Kartal", "Kanarya", "Bordo",
  "sarı-kırmızı", "sarı-lacivert", "siyah-beyaz", "bordo-mavi",
];
