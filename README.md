# #Musiklex Online-Buzzer

Dieses Update enthält:

- robustere, automatische Speicherung des kompletten Host-Layouts (Tabs, Panel-Kopien, Positionen, Größen, minimiert/ausgeblendet und Layout-Sperre) im Browser, inklusive Backup und Migration der bisherigen Layout-Daten;
- Host-Passwortschutz;
- Spieler-kicken-Funktion in der Spielerverwaltung.

## Host-Passwort

Das vereinbarte Host-Passwort wird serverseitig geprüft. Im Browser/`public/index.html` liegt es nicht im Klartext.

Optional kann auf Render die Umgebungsvariable `HOST_PASSWORD_HASH` gesetzt werden, wenn das Passwort später geändert werden soll. Erwartet wird ein SHA-256-Hash.

## Update auf GitHub

`server.js` und `public/index.html` ersetzen. Die vorhandenen Sounds bleiben unverändert.
