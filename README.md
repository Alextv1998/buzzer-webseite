# #Musiklex Buzzer – Show-Control Update

Neu in dieser Version:

- Antworttimer: optional aktivierbar, Dauer frei einstellbar, startet automatisch beim ersten gültigen Buzz.
- Soundboard: Richtig, Falsch, Ding, Applaus, Trommelwirbel, Zeit und Buzzer; optional auch bei allen Spielern abspielbar.
- Team-Tribüne: Teams und sichtbare Spieler werden als farbige Tribüne dargestellt.
- Tribüne kann optional auch in der Spieleransicht eingeblendet werden.
- Einzelne Spieler können auf der Tribüne sichtbar/unsichtbar geschaltet werden.
- Eigene Avatare können pro Spieler hochgeladen werden; Bilder werden im Browser verkleinert.

Für das bestehende GitHub/Render-Projekt `server.js` und `public/index.html` ersetzen und committen.

Hinweis: Wie die übrigen Live-Daten werden hochgeladene Avatare aktuell nur im Arbeitsspeicher des Render-Servers gehalten. Nach einem Server-Neustart oder neuen Deploy müssen sie erneut hochgeladen werden.
