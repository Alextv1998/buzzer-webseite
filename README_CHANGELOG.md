# Änderungsprotokoll

## Neuer separater Antwortbereich

- dritter Spieler-Tab **„Antwort“** hinzugefügt
- Antworten sind vom normalen Chat getrennt
- pro Team genau eine eingeloggte Antwort
- Spieler ohne Team haben einen eigenen Antwortplatz
- nach Absenden: **„Antwort eingeloggt ✓“**
- Antworten können bis zum Host-Reset nicht geändert werden
- nach dem Aufdecken keine verspäteten Antworten mehr möglich
- Host sieht vor dem Aufdecken nur den Abgabestatus
- **„Antworten aufdecken“** zeigt alle Inhalte gleichzeitig
- **„Antworten zurücksetzen“** startet eine neue Antwortrunde

## Host-Chat bereinigt

- alte Option **„Antwortmodus / Geheime Antwort“** entfernt
- normale Chatnachrichten werden nicht mehr als Antwort markiert
- Privatchat und Teamchat bleiben unverändert

## Bestehende Funktionen

- kreisrunder Buzzer bleibt erhalten
- Punkte und Teampunkte bleiben direkt unter dem Buzzer
- Spieler- und Team-Buzzersperren bleiben erhalten
- Chat-Benachrichtigungen bleiben erhalten
- Team-Persistenz und Layout-Persistenz bleiben erhalten

## Prüfungen

- `server.js` mit `node --check` geprüft
- eingebettetes Browser-JavaScript mit `node --check` geprüft
- neue DOM-IDs auf Eindeutigkeit geprüft
- alle alten `answerModeEnabled`-/`answerModeBox`-Referenzen entfernt

## Update: Bug-Reports, Chat-Scrollen & Team-Antworten
- Spieler können direkt in ihrer Ansicht über **🐞 Bug melden** Fehler melden.
- Bug-Reports erscheinen live in einem neuen Host-Panel, werden in `bug-reports.json` gespeichert und können als erledigt markiert oder gelöscht werden.
- Optionaler E-Mail-Versand von Bug-Reports über SMTP (Konfiguration siehe `README_SETUP.md`).
- Bugfix: Privat- und Teamchat springen nicht mehr bei jedem State-Update automatisch ans Ende. Spieler können jetzt zuverlässig hochscrollen.
- Team-Antworten sind in der Spieleransicht nun ausdrücklich als **Team-Antwort** gekennzeichnet. Eine eingeloggt Antwort gilt für das ganze Team und sperrt das Feld für alle Teammitglieder bis zum Host-Reset.
- Spieler ohne Team sehen stattdessen **Solo-Antwort**.
