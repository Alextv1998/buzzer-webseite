# Buzzer-Update

Änderungen:
- Spieler-Chat steht wieder UNTER dem Buzzer.
- Antwortmodus zeigt nur noch „ANTWORT:“ statt „GEHEIME ANTWORT“.
- Eingabefeld im Antwortmodus zeigt „Antwort:“.
- „Buzzer sperren“ setzt jetzt IMMER einen echten globalen LOCKED-Zustand.
  Das funktioniert auch, wenn noch keine Runde gestartet wurde.
- Runde starten hebt den globalen Lock wieder auf.
- Zurücksetzen setzt den Buzzer auf INAKTIV.
- Die frei editierbaren Buzzer-Texte werden jetzt über einen eindeutigen Zustandsautomaten benutzt:
  * Aktiv-Text: Spieler kann aktuell tatsächlich buzzern.
  * Inaktiv-Text: Buzzer ist nicht freigegeben / Spieler hat bereits gebuzzert / wartet.
  * Gesperrt-Text: Host hat „Buzzer sperren“ gedrückt oder Spieler/Team ist manuell gesperrt.
- Die Buzzer-Texte bleiben serverseitig und im Host-Browser gespeichert.
