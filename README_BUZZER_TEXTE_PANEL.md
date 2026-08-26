# Buzzer-Texte Panel

Neu im Host-Dashboard:
- eigenes verschiebbares Panel „Buzzer-Texte“
- Text für AKTIV frei editierbar
- Text für INAKTIV frei editierbar
- Text für LOCKED/GESPERRT frei editierbar
- „Standard“-Button setzt AKTIV / INAKTIV / LOCKED zurück
- Enter in einem Textfeld speichert ebenfalls

Persistenz:
- serverseitig in buzzer-text-state.json
- zusätzlich Backup im Browser des Hosts

Spielerseite:
- der jeweilige frei definierte Text erscheint automatisch direkt auf dem Buzzer
- LOCKED wird verwendet, wenn Spieler oder Team manuell gesperrt wurde
- INAKTIV bei sonst deaktiviertem Buzzer
- AKTIV bei freigegebenem Buzzer
