# #Musiklex Online-Buzzer

Dieses Update enthält:

- 4 Fixes

## Host-Passwort

Das vereinbarte Host-Passwort wird serverseitig geprüft. Im Browser/`public/index.html` liegt es nicht im Klartext.

Optional kann auf Render die Umgebungsvariable `HOST_PASSWORD_HASH` gesetzt werden, wenn das Passwort später geändert werden soll. Erwartet wird ein SHA-256-Hash.

## Update auf GitHub

`server.js` und `public/index.html` ersetzen. Die vorhandenen Sounds bleiben unverändert.
