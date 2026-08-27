# #Musiklex Online-Buzzer – aktueller Stand

Diese Version enthält eine vollständig bereinigte Spieleransicht.

## Spieleransicht

Die Reihenfolge ist jetzt:

1. Spiel-/Rundenstatus
2. ein einzelner, kreisrunder Gameshow-Buzzer
3. persönliche Punkte und Teampunkte direkt unter dem Buzzer
4. ggf. Buzz-Platzierung / Reaktionszeit
5. Chat-Benachrichtigung
6. Chat
7. optionale Team-Tribüne
8. optionale Buzz-Reihenfolge

Auf dem Buzzer steht ausschließlich der vom Host definierte Zustandstext.

Die Punkteanzeige bleibt dauerhaft sichtbar und zeigt:
- `Punkte: <Spielerpunkte>`
- zusätzlich `<Teamname>: <Teampunkte> Teampunkte`, wenn der Spieler einem Team angehört

## Chat

Es gibt:
- Privat-Chat Spieler ↔ Host
- Teamchat
- Spieler-Benachrichtigungen
- Antwortmodus

Im Antwortmodus werden Nachrichten beim Host mit `ANTWORT:` markiert.

## Buzzer-Zustände

Die drei Zustandstexte können im Host-Panel „Buzzer-Texte“ frei bearbeitet werden:
- Aktiv
- Inaktiv
- Gesperrt

„Buzzer sperren“ ist ein globaler Sperrzustand. Einzelne Spieler und Teams können zusätzlich separat gesperrt werden.

## Persistenz

Gespeichert werden unter anderem Teams, Teamfarben, Teamreihenfolge, Spieler-Team-Zuordnungen, Buzzer-Sperren, Layout/Tabs/Panelgrößen und die frei definierten Buzzer-Texte.

## Reparatur in dieser Version

Der beschädigte sichtbare HTML-Text `h>Zeit … Abstand zu #1` wurde vollständig entfernt. Die dafür nötigen Bereiche „Buzz-Reihenfolge“ und „Team-Tribüne“ wurden korrekt wiederhergestellt.
