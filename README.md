# #Musiklex Online-Buzzer – aktueller Stand

Diese Version enthält den separaten Bereich **„Antwort“** im Nachrichtenfenster.

## Nachrichten beim Spieler

Der Nachrichtenbereich hat jetzt drei Tabs:

1. **Privat mit Host** – normaler 1:1-Chat
2. **Teamchat** – Chat innerhalb des eigenen Teams
3. **Antwort** – geheime Antwort einloggen

### Antwort einloggen

„Antwort“ ist ausdrücklich **kein Chat**.

- Ein Spieler gibt eine Antwort ein und klickt auf **„Antwort einloggen“**.
- Gehört der Spieler zu einem Team, gilt die Antwort für das **gesamte Team**.
- Pro Team kann nur **eine** Antwort eingeloggt werden.
- Spieler ohne Team haben einen eigenen Antwortplatz.
- Nach dem Absenden sieht das Team nur noch **„Antwort eingeloggt ✓“**.
- Die Antwort kann danach nicht geändert werden.
- Erst wenn der Host **„Antworten zurücksetzen“** nutzt, kann eine neue Antwort eingegeben werden.
- Sobald der Host Antworten aufgedeckt hat, sind weitere Eingaben bis zum Reset gesperrt.

Damit eignet sich die Funktion für Blindwahlen, geheime Tipps, Entscheidungen und ähnliche Spielmechaniken.

## Host – Chat-Zentrale

Die alte Option **„Antwortmodus / Geheime Antwort“** wurde vollständig aus dem normalen Host-Chat entfernt.

Der normale Host-Chat enthält nur noch:

- Privatchat
- Teamchat

Darunter gibt es einen eigenen Bereich **„Antworten“**.

Vor dem Aufdecken sieht der Host nur:

- welches Team / welcher Spieler einen Antwortplatz hat
- ob bereits eine Antwort eingeloggt wurde
- wer sie eingeloggt hat

Der tatsächliche Inhalt wird noch nicht übertragen bzw. angezeigt.

Mit **„Antworten aufdecken“** werden alle eingeloggen Antworten gleichzeitig sichtbar.

Mit **„Antworten zurücksetzen“** werden alle Antworten gelöscht und eine neue Blindrunde kann beginnen.

## Spieleransicht

Die bestehende Reihenfolge bleibt erhalten:

1. Spiel-/Rundenstatus
2. kreisrunder Gameshow-Buzzer
3. persönliche Punkte und Teampunkte
4. ggf. Buzz-Ergebnis / Reaktionszeit
5. Chat-Benachrichtigung
6. Nachrichtenbereich
7. optionale Team-Tribüne
8. optionale Buzz-Reihenfolge

## Buzzer

Auf dem Buzzer steht ausschließlich der im Host-Panel definierte Zustandstext:

- Aktiv
- Inaktiv
- Gesperrt

## Persistenz

Teams, Teamfarben, Spieler-Team-Zuordnungen, Buzzer-Texte und Host-Layout werden wie bisher gespeichert.

**Antworten selbst werden absichtlich nur für die laufende Server-Session gehalten** und nicht dauerhaft gespeichert.

### Neue Komfortfunktionen
- Spieler können Bugs direkt über **🐞 Bug melden** an den Host schicken.
- Privat- und Teamchat lassen sich jetzt hochscrollen, ohne automatisch wieder nach unten zu springen.
- Antworten werden bei Teamzuordnung als gemeinsame **Team-Antwort** behandelt; unzugeordnete Spieler nutzen eine **Solo-Antwort**.
