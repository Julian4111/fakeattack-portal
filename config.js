// Einstellungen der Website. Supabase-URL und oeffentlicher Schluessel sind absichtlich oeffentlich:
// die Datenbank laesst nur die geprueften Portal-Funktionen zu.
window.PORTAL_CONFIG = {
  serverName: 'Fake Attack 3',

  // Supabase -> Project Settings -> API
  supabaseUrl: 'https://papgusumycsjeafaqqtv.supabase.co',
  supabaseKey: 'sb_publishable_Yjqwmm2TrQ0g3gvzZ6iI_g_WRzx6dm1',

  // Adresse des Servers im Heimnetz (der Router kann die oeffentliche IP von drinnen nicht erreichen)
  lanHost: '10.10.70.151',

  // gleicher Wortlaut wie im Regel-Bildschirm beim Beitreten (codeofconduct/de_de.txt auf dem Server)
  rules: [
    { title: 'Kämpfen und Griefen', text: 'Töten und Griefen sind erlaubt, aber nur mit triftigem Grund. Wer ohne triftigen Grund tötet oder Bauwerke zerstört, muss verlorene Items selbst ersetzen und Zerstörtes selbst wieder aufbauen.' },
    { title: 'Keine Cheats', text: 'Hack-Clients, X-Ray, Bots und Exploits, die den Server abstürzen lassen oder lahmlegen, sind verboten.' },
    { title: 'Keine Erstattung verlorener Items', text: 'Bei Neustarts, Abschaltungen oder Abstürzen können Items verloren gehen. Der Admin haftet dafür nicht, verlorene Items werden grundsätzlich nicht erstattet.' }
  ],

  info: [
    'Beim ersten Beitreten zeigt dir Minecraft diese Regeln – nur wer sie akzeptiert, kommt auf den Server.',
    'Sprachchat: Mod „Simple Voice Chat“ installieren, dann funktioniert er automatisch.',
    'Nether und End können zeitweise gesperrt sein.',
    'Backups laufen alle 30 Minuten. Neustarts um 0, 6, 12 und 18 Uhr, vorher Countdown im Spiel.',
    'Rucksäcke: /rucksack zeigt die Rezepte. Klein (9 Plätze), mit Eisen 27, mit Diamanten 54 – der Inhalt bleibt beim Aufwerten drin.',
    'Pfeilmacher kaufen ab Stufe Lehrling 17 Knochenmehl für 1 Smaragd statt Feuerstein.',
    'Börse im Spiel: Neue Angebote und Post zu deinen Handeln kommen als Chat-Nachricht mit Ton. Für die Töne beim Beitreten das Server-Ressourcenpaket annehmen.'
  ]
};
