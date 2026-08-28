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
