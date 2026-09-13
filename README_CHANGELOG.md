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

## Update: Spielinfo, Sound-Lautstärke & Video Killed The Audio Star
- Spielname und Regel-/Hinweistext in der Spieleransicht werden zentriert dargestellt.
- Soundboard hat eine allgemeine Lautstärkeregelung (Standard 70 %).
- Der 5-Sekunden-Countdown hat eine eigene Lautstärkeregelung (Standard 35 %, also 50 % leiser als der allgemeine Standard).
- Die Lautstärken werden lokal im Browser gespeichert.
- Separater Video-Killed-The-Audio-Star-Player unter `public/tools/video-killed-the-audio-star.html`.
- Dort kann der Ton während des laufenden YouTube-Videos ein-/ausgeschaltet werden, ohne das Video neu zu laden oder zum Startpunkt zurückzuspringen.

## Sound-Lautstärken-Panel
- Das Soundboard selbst enthält keine allgemeinen Lautstärkeregler mehr.
- Neues eigenes, verschiebbares Panel **🎚️ Sound-Lautstärken**.
- Jeder Soundboard-Sound hat eine eigene Lautstärke: Richtige Antwort, Falsche Antwort, Nächste Fragerunde, Nächste Hauptrunde, Countdown 5 Sek., Zeit! und Buzzer.
- Lautstärken werden lokal gespeichert.
- Bei „Auch bei Spielern abspielen“ wird die gewählte Lautstärke des jeweiligen Sounds an die Spieler übertragen.
- Countdown startet standardmäßig bei 35 %, alle übrigen Sounds bei 70 %.
- Button zum Zurücksetzen auf Standard-Lautstärken hinzugefügt.
