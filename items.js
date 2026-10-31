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

// Weitere Items, die man als Bezahlung angeben kann (zusaetzlich zu allen Items der Liste unten).
// Diamanten und Diamantbloecke stehen im eigenen Diamanten-Feld.
window.PRICE_ITEM_IDS = {
  "Redstoneblock": "redstone_block", "Lapislazuliblock": "lapis_block", "Kohleblock": "coal_block", "Kupferblock": "copper_block",
  "Quarzblock": "quartz_block", "Roheisen": "raw_iron", "Rohgold": "raw_gold", "Rohkupfer": "raw_copper",
  "Eisennugget": "iron_nugget", "Goldnugget": "gold_nugget", "Erfahrungsfläschchen": "experience_bottle",
  "Lohenrute": "blaze_rod", "Lohenstaub": "blaze_powder", "Schwarzpulver": "gunpowder", "Leder": "leather", "Pfeil": "arrow",
  "Shulkerschale": "shulker_shell", "Knochenmehl": "bone_meal", "Ghastträne": "ghast_tear", "Enderauge": "ender_eye",
  "Phantomhaut": "phantom_membrane", "Echoscherbe": "echo_shard", "Prismarinscherbe": "prismarine_shard", "Tintenbeutel": "ink_sac",
  "Feder": "feather", "Zucker": "sugar", "Netherwarze": "nether_wart", "Weizen": "wheat", "Kürbis": "pumpkin"
};

// Minecraft-Item zu einem Namen aus der Liste: Die Handelstruhe im Spiel (/handel) zaehlt diese Ware selbst.
// Was fehlt (Sets, Traenke, Verzauberungen, Tiere, Dienste, Holz- und Farbsorten), prueft der Kaeufer mit eigenen Augen.
window.MARKET_ITEM_IDS = {
  "Diamant": "diamond", "Smaragd": "emerald", "Eisenbarren": "iron_ingot", "Goldbarren": "gold_ingot",
  "Netherite-Barren": "netherite_ingot", "Kupferbarren": "copper_ingot", "Lapislazuli": "lapis_lazuli",
  "Redstone-Staub": "redstone", "Kohle": "coal", "Netherquarz": "quartz", "Antiker Schutt": "ancient_debris",
  "Netherite-Schrott": "netherite_scrap", "Amethyst": "amethyst_shard", "Eisenblock": "iron_block", "Goldblock": "gold_block",
  "Diamantblock": "diamond_block", "Smaragdblock": "emerald_block", "Netheriteblock": "netherite_block",
  "Stein": "stone", "Glas": "glass", "Obsidian": "obsidian", "Bruchstein": "cobblestone", "Sand": "sand", "Kies": "gravel",
  "Netherrack": "netherrack", "Endstein": "end_stone", "Prismarin": "prismarine", "Schleimball": "slime_ball",
  "Honigwabe": "honeycomb", "Knochen": "bone", "Fäden": "string", "Papier": "paper", "Bücher": "book",
  "Leuchtstein": "glowstone", "Seelaterne": "soul_lantern",
  "Netherite-Brustplatte": "netherite_chestplate", "Netherite-Helm": "netherite_helmet", "Diamant-Brustplatte": "diamond_chestplate",
  "Schild": "shield", "Elytra": "elytra", "Netherite-Hose": "netherite_leggings", "Netherite-Stiefel": "netherite_boots",
  "Diamant-Helm": "diamond_helmet", "Diamant-Hose": "diamond_leggings", "Diamant-Stiefel": "diamond_boots",
  "Schildkrötenpanzer": "turtle_helmet",
  "Netherite-Spitzhacke": "netherite_pickaxe", "Diamant-Spitzhacke": "diamond_pickaxe", "Diamant-Axt": "diamond_axe",
  "Angel": "fishing_rod", "Schere": "shears", "Feuerzeug": "flint_and_steel", "Netherite-Axt": "netherite_axe",
  "Netherite-Schaufel": "netherite_shovel", "Netherite-Hacke": "netherite_hoe", "Eimer": "bucket", "Kompass": "compass",
  "Uhr": "clock", "Laterne": "lantern", "Eisen-Spitzhacke": "iron_pickaxe",
  "Netherite-Schwert": "netherite_sword", "Diamant-Schwert": "diamond_sword", "Bogen": "bow", "Armbrust": "crossbow",
  "Dreizack": "trident", "Streitkolben": "mace", "Spektralpfeile": "spectral_arrow", "TNT": "tnt", "Eisenschwert": "iron_sword",
  "Netherite-Axt (Kampf)": "netherite_axe",
  "Goldene Äpfel": "golden_apple", "Steak": "cooked_beef", "Brot": "bread", "Kuchen": "cake", "Goldene Karotte": "golden_carrot",
  "Zauberapfel (OP-Goldapfel)": "enchanted_golden_apple", "Kekse": "cookie", "Kürbiskuchen": "pumpkin_pie",
  "Pilzsuppe": "mushroom_stew", "Kartoffeln (gebacken)": "baked_potato", "Melonenscheibe": "melon_slice",
  "Süßbeeren": "sweet_berries", "Honigflasche": "honey_bottle", "Äpfel": "apple", "Karotten": "carrot", "Kürbis": "pumpkin",
  "Ofenkartoffeln": "baked_potato",
  "Kolben": "piston", "Beobachter": "observer", "Trichter": "hopper", "Werfer": "dispenser", "Repeater": "repeater",
  "Komparator": "comparator", "Hebel": "lever", "Redstone-Lampe": "redstone_lamp", "Notenblock": "note_block",
  "Plattenspieler": "jukebox", "Zielblock": "target", "Schleimblock": "slime_block", "Honigblock": "honey_block",
  "Weizen": "wheat", "Samen": "wheat_seeds", "Zuckerrohr": "sugar_cane", "Kakaobohnen": "cocoa_beans", "Bambus": "bamboo",
  "Kaktus": "cactus", "Melone": "melon",
  "Gemälde": "painting", "Bücherregal": "bookshelf", "Truhe": "chest", "Blumentopf": "flower_pot",
  "Lore": "minecart", "Sattel": "saddle", "Angel am Stock": "carrot_on_a_stick",
  "Totem der Unsterblichkeit": "totem_of_undying", "Leuchtfeuer": "beacon", "Enderperle": "ender_pearl", "Drachenei": "dragon_egg",
  "Netherstern": "nether_star", "Endertruhe": "ender_chest", "Amboss": "anvil", "Zaubertisch": "enchanting_table",
  "Braustand": "brewing_stand", "Wither-Schädel": "wither_skeleton_skull", "Herz des Meeres": "heart_of_the_sea"
};
