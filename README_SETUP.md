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

## Optional: Bug-Reports zusätzlich per E-Mail senden
Bug-Reports werden immer im Host-Dashboard angezeigt und serverseitig in `bug-reports.json` gespeichert.
Wenn sie zusätzlich automatisch per E-Mail verschickt werden sollen, kann der Server per SMTP konfiguriert werden.

Setze dafür diese Umgebungsvariablen beim Hosting:

- `BUG_EMAIL_TO` – Zieladresse für Bug-Reports
- `SMTP_HOST` – SMTP-Server
- `SMTP_PORT` – SMTP-Port (typisch 587 oder 465)
- `SMTP_USER` – SMTP-Benutzername
- `SMTP_PASS` – SMTP-Passwort/App-Passwort
- `SMTP_FROM` – optionale Absenderadresse; ohne Angabe wird `SMTP_USER` verwendet
- `SMTP_SECURE=true` – optional; für Port 465 empfohlen

Ohne diese Variablen funktioniert das Bug-Melden trotzdem vollständig über das Host-Dashboard; es wird lediglich keine E-Mail versendet.
