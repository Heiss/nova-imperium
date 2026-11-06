# Nova Imperium – Classic Uni

Ein Weltraum-Browserspiel (mit eigenen Grafiken für alle 32 Gebäude, Forschungen, Schiffe und Verteidigungsanlagen in `public/art.js`) im Stil der alten Version von 2007/2008: Minen, Forschung, Werft, Verteidigung, Flotten, Spionage, Kämpfe und Highscore. Kein Premium, keine Dunkle Materie.

Der Server braucht **nur Node.js (Version 18 oder neuer)**, es gibt keine weiteren Pakete und kein `npm install`. Alle Spielstände liegen in einer einzigen Datei: `data/universe.json`.

## Schnellstart

```bash
node server.js
```

Danach im Browser `http://SERVER-IP:8080` öffnen. Wer sich **zuerst** registriert, wird Admin und kann später neue Runden starten.

## Einstellungen (Umgebungsvariablen)

| Variable      | Standard  | Bedeutung |
|---------------|-----------|-----------|
| `PORT`        | `8080`    | Port des Webservers |
| `HOST`        | `0.0.0.0` | Adresse, auf der gelauscht wird (`127.0.0.1`, wenn ein Reverse-Proxy davor sitzt) |
| `INVITE_CODE` | leer      | Wenn gesetzt, muss man diesen Code bei der Registrierung angeben – empfohlen, damit keine Fremden mitspielen |
| `DATA_DIR`    | `./data`  | Ordner für den Spielstand |

Beispiel:
```bash
PORT=8080 INVITE_CODE=kaffeetasse node server.js
```

Das Tempo und die Größe des Universums stehen oben in `public/game.js` (`SPEED`, `GALAXIES`, `SYSTEMS` …). Danach den Server neu starten.

## Dauerhaft laufen lassen (Linux mit systemd)

```bash
sudo useradd --system --home /opt/nova-imperium nova
sudo mkdir -p /opt/nova-imperium && sudo cp -r . /opt/nova-imperium
sudo chown -R nova:nova /opt/nova-imperium
sudo cp nova-imperium.service /etc/systemd/system/     # vorher INVITE_CODE darin anpassen
sudo systemctl daemon-reload && sudo systemctl enable --now nova-imperium
journalctl -u nova-imperium -f                         # Log ansehen
```

## Alternativ mit Docker

```bash
docker build -t nova-imperium .
docker run -d --name nova -p 8080:8080 -e INVITE_CODE=kaffeetasse -v nova-data:/data --restart unless-stopped nova-imperium
```

## HTTPS (empfohlen, wenn es eine Domain gibt)

Die Passwörter gehen sonst unverschlüsselt durchs Netz. Am einfachsten mit **Caddy** (holt das Zertifikat automatisch). `/etc/caddy/Caddyfile`:

```
spiel.example.de {
    reverse_proxy 127.0.0.1:8080
}
```

Dann den Spielserver mit `HOST=127.0.0.1` starten, damit er nur über Caddy erreichbar ist. Bei nginx muss `proxy_set_header X-Forwarded-Proto $scheme;` und `X-Forwarded-For` gesetzt werden.

## Backup

Einfach `data/universe.json` kopieren. Der Server speichert alle 5 Sekunden und beim Beenden.

## Was der Server macht

- Er rechnet alles selbst: Rohstoffe, Bauaufträge, Flugzeiten und Kämpfe. Das läuft auch, wenn niemand online ist, und man kann nicht schummeln.
- Passwörter werden mit scrypt gehasht gespeichert, Logins bleiben 30 Tage gültig.
- Das Spiel ist für Freundesrunden mit bis zu einigen Dutzend Spielern gedacht.
