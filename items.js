// Kategorien und Item-Vorschlaege fuer die Boerse (Itemliste aus der Minezon-Vorlage).
// Die Schluessel muessen zur Liste in market_create (schema.sql) passen.
window.MARKET_CATEGORIES = [
  ["erze", "Erze"],
  ["materialien", "Materialien"],
  ["ruestung", "Rüstung"],
  ["werkzeuge", "Werkzeuge"],
  ["waffen", "Waffen"],
  ["essen", "Essen"],
  ["redstone", "Redstone"],
  ["traenke", "Tränke"],
  ["verzauberung", "Verzauberungen"],
  ["tiere", "Tiere"],
  ["farm", "Farm & Pflanzen"],
  ["deko", "Deko & Bau"],
  ["transport", "Transport"],
  ["spezial", "Spezial"],
  ["dienste", "Dienste"],
  ["sonstiges", "Sonstiges"]
];

window.MARKET_ITEMS = {
  erze: ["Diamant", "Smaragd", "Eisenbarren", "Goldbarren", "Netherite-Barren", "Kupferbarren", "Lapislazuli", "Redstone-Staub", "Kohle", "Netherquarz", "Antiker Schutt", "Netherite-Schrott", "Amethyst", "Eisenblock", "Goldblock", "Diamantblock", "Smaragdblock", "Netheriteblock"],
  materialien: ["Holzblock", "Stein", "Ziegel", "Glas", "Wolle", "Obsidian", "Holzbretter", "Bruchstein", "Sand", "Kies", "Lehm", "Netherrack", "Endstein", "Prismarin", "Schleimball", "Honigwabe", "Knochen", "Fäden", "Papier", "Bücher", "Leuchtstein", "Seelaterne"],
  ruestung: ["Netherite-Brustplatte", "Netherite-Helm", "Diamant-Brustplatte", "Eisenrüstung-Set", "Schild", "Elytra", "Netherite-Hose", "Netherite-Stiefel", "Diamant-Helm", "Diamant-Hose", "Diamant-Stiefel", "Lederrüstung-Set", "Schildkrötenpanzer", "Netherite-Set (komplett)"],
  werkzeuge: ["Netherite-Spitzhacke", "Diamant-Spitzhacke", "Diamant-Axt", "Angel", "Schere", "Feuerzeug", "Netherite-Axt", "Netherite-Schaufel", "Netherite-Hacke", "Eimer", "Kompass", "Uhr", "Karte", "Fackeln (64)", "Laterne", "Eisen-Spitzhacke"],
  waffen: ["Netherite-Schwert", "Diamant-Schwert", "Bogen", "Armbrust", "Dreizack", "Streitkolben", "Pfeile (64)", "Spektralpfeile", "TNT", "Eisenschwert", "Netherite-Axt (Kampf)"],
  essen: ["Goldene Äpfel", "Steak", "Brot", "Kuchen", "Goldene Karotte", "Zauberapfel (OP-Goldapfel)", "Schweinefleisch", "Rindfleisch", "Hähnchen", "Lachs", "Kekse", "Kürbiskuchen", "Pilzsuppe", "Kartoffeln (gebacken)", "Melonenscheibe", "Süßbeeren", "Honigflasche", "Äpfel", "Karotten", "Kürbis", "Gebackene Süßkartoffel", "Ofenkartoffeln", "Zuckerkuchen"],
  redstone: ["Kolben", "Beobachter", "Trichter", "Werfer", "Repeater", "Komparator", "Schienen (Set)", "Hebel", "Redstone-Lampe", "Notenblock", "Plattenspieler", "Zielblock", "Schleimblock", "Honigblock"],
  traenke: ["Heiltrank", "Stärketrank", "Feuerresistenz", "Unsichtbarkeit", "Wasseratmung", "Schnelligkeit", "Nachtsicht", "Langsames Fallen", "Regeneration", "Schildkrötenmeister", "Wurf-Heiltrank"],
  verzauberung: ["Schärfe V", "Effizienz V", "Haltbarkeit III", "Reparatur", "Glück III", "Plünderung III", "Schutz IV", "Wasseratmung III", "Fortbewegung auf Seelensand"],
  tiere: ["Pferd (gezähmt)", "Hund (gezähmt)", "Katze (gezähmt)", "Papagei", "Esel", "Lama", "Axolotl", "Fuchs", "Dorfbewohner"],
  farm: ["Weizen", "Samen", "Zuckerrohr", "Kakaobohnen", "Bambus", "Kaktus", "Setzlinge", "Blumen", "Melone"],
  deko: ["Bett", "Gemälde", "Banner", "Bücherregal", "Truhe", "Teppich", "Blumentopf", "Spiegel (Glas)"],
  transport: ["Boot", "Lore", "Sattel", "Schienen-Set (64)", "Angel am Stock"],
  spezial: ["Totem der Unsterblichkeit", "Leuchtfeuer", "Enderperle", "Zauberbuch", "Drachenei", "Netherstern", "Feuerwerksraketen (64)", "Schulkerkiste", "Endertruhe", "Amboss", "Zaubertisch", "Braustand", "Wither-Schädel", "Herz des Meeres", "Beacon-Basis (Eisen)"],
  dienste: ["Haus bauen", "Farm bauen", "Mob-Farm bauen", "XP-Farm bauen", "Begleitschutz", "Abbau-Stunde (Minen)", "Redstone-Schaltung", "Dungeon-Run"]
};
