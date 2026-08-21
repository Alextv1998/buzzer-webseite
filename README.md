# Online Buzzer – Update mit Frühstart & Teams

Dieses Update ergänzt die bestehende Buzzer-Webseite um:

- Frühstart-Erkennung: Buzzern vor Rundenstart wird dem Host angezeigt.
- Einstellbare Frühstart-Sperre von 0 bis 60 Sekunden.
- Teamverwaltung im Host-Bereich.
- Teams anlegen, umbenennen und löschen.
- Spieler per Dropdown einem Team zuordnen.
- Separate Teampunkte mit frei einstellbarem Punktewert (+/-) und direkter Punkteingabe.
- Teamname wird bei Buzz-Reihenfolge und Frühstart angezeigt.
- Spieler sehen ihr Team in ihrer eigenen Ansicht.

## Update auf GitHub

Im bestehenden Repository diese Dateien ersetzen:

- `server.js`
- `public/index.html`

Danach committen. Render sollte den neuen Commit automatisch deployen; andernfalls `Manual Deploy` → `Deploy latest commit`.

Hinweis: Punkte, Teams und Zuordnungen werden aktuell im Arbeitsspeicher des Servers gehalten. Bei einem Neustart/Neu-Deploy von Render werden sie zurückgesetzt.
