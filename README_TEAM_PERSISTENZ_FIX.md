# Team-Persistenz-Fix

Neu in dieser Version:

- Teams werden serverseitig in `team-state.json` gespeichert.
- Teamname, Farbe, Reihenfolge und Buzzer-Sperre bleiben erhalten.
- Spieler-Zuordnungen werden zusätzlich nach Spielernamen gesichert.
- Der Host-Browser hält parallel ein lokales Backup (`buzzer-team-state-v2`).
- Nach einem Server-Neustart kann der Host beim Login die Teams automatisch wieder auf den Server übertragen.
- Das bestehende Chat-System bleibt enthalten.

Damit gibt es zwei Sicherungsebenen statt nur flüchtigem Server-Arbeitsspeicher.
