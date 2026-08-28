# Einrichtung und Start

1. Node.js installieren.
2. ZIP entpacken.
3. Im Projektordner `npm install` ausführen.
4. Danach mit `npm start` starten.

Standardmäßig läuft der Server auf Port 3000.

## Update eines bestehenden Hostings

Die Dateien aus diesem Paket übernehmen, insbesondere:

- `server.js`
- `public/index.html`
- `public/sounds/`

## Neuer Antwortbereich testen

1. Host und mindestens einen Spieler öffnen.
2. Spieler öffnet Nachrichten → **Antwort**.
3. Antwort eingeben und **Antwort einloggen**.
4. Beim Host muss zunächst nur **„Antwort eingeloggt ✓“** erscheinen.
5. Host klickt **„Antworten aufdecken“**.
6. Erst jetzt wird der Inhalt sichtbar.
7. Host klickt **„Antworten zurücksetzen“**.
8. Danach kann erneut eine Antwort eingeloggt werden.
