"""Pages: fleet, map, reports (UX study „Modern“, proposal only)."""
from shell import RES, ball, before, desk, page, phone

I = '/icons/'


def h1(title, crumb, right=''):
    return (f'<div class="m-title"><h1>{title}</h1><span class="m-crumb">{crumb}</span>'
            f'<div class="m-right">{right}</div></div>')


def ptitle(t):
    return f'<div style="font: 800 18px var(--head); color: var(--gold); margin-bottom: 6px">{t}</div>'


# ------------------------------------------------------------------ fleet
def ship(icon, name, have, n, speed):
    return (f'<div class="m-pit" style="grid-template-columns: 34px 1fr auto auto; padding: 5px 0">'
            f'<img src="{I}ships/{icon}" alt="" style="width: 34px; height: 34px" />'
            f'<div><div class="m-nm" style="font-size: 13.5px">{name}</div><div class="m-sm">{have} da · {speed}</div></div>'
            f'<span class="m-stepper"><span>−</span><b>{n}</b><span>+</span></span><span class="m-dim" style="font-size: 12.5px">max</span></div>')


def cargo(icon, amount, pct):
    return (f'<div class="m-cost" style="grid-template-columns: 15px 64px 1fr 40px"><img src="{RES}{icon}.svg" alt="" />'
            f'<span>{amount}</span><div class="m-bar"><i style="width: {pct}%; background: var(--gold)"></i></div>'
            '<span class="m-dim">alles</span></div>')


def flotte():
    presets = ('<div class="m-chips"><span class="m-dim" style="font-size: 13px">Vorlagen:</span>'
               '<span class="m-chip">▶ Transport Aurelia → Vesper</span><span class="m-chip">▶ Expedition Standard</span>'
               '<span class="m-chip">▶ Spionage 3 Schädel</span><span class="m-chip off">+ aktuelle Auswahl speichern</span></div>')
    ships = ('<div class="m-card"><div class="m-ch">1 · Schiffe<span class="m-right">alle · keine</span></div><div class="m-cb">'
             '<div class="m-group" style="margin-top: 0">FRACHT</div>'
             + ship('large_cargo.svg', 'Lastbarke', 20, 8, '13.500')
             + ship('small_cargo.svg', 'Frachtläufer', 12, 0, '9.000')
             + '<div class="m-group">KAMPF</div>'
             + ship('light_fighter.svg', 'Abfangjäger', 140, 0, '22.500')
             + ship('cruiser.svg', 'Fregatte', 25, 0, '33.000')
             + ship('battleship.svg', 'Kathedralschiff', 12, 0, '22.000')
             + '<div class="m-group">SPEZIAL</div>'
             + ship('espionage_probe.svg', 'Spähschädel', 15, 0, '180.000')
             + '</div></div>')
    target = ('<div class="m-card"><div class="m-ch">2 · Ziel und Auftrag</div><div class="m-cb" style="font-size: 14px">'
              '<div style="display: flex; gap: 6px; align-items: center"><span class="m-input focus">1</span>:<span class="m-input focus">44</span>:'
              '<span class="m-input focus">9</span><span class="m-chip on">Planet</span><span class="m-chip">Mond</span><span class="m-chip">Trümmer</span></div>'
              '<div class="m-dim" style="margin: 6px 0">→ <b style="color: var(--txt)">Vesper</b> (deine Kolonie) · Entfernung 17 Systeme</div>'
              '<div class="m-chips"><span class="m-chip">Nox</span><span class="m-chip on">Vesper</span><span class="m-chip">Selene (Mond)</span>'
              '<span class="m-chip">zuletzt: Varn</span><span class="m-chip">aus der Karte …</span></div>'
              '<div class="m-group">AUFTRAG</div><div class="m-chips"><span class="m-chip on">Transport</span><span class="m-chip">Stationieren</span>'
              '<span class="m-chip off" title="nur fremde Ziele">Angriff</span><span class="m-chip off">Spionage</span><span class="m-chip off">Expedition · nur Position 16</span></div>'
              '<div class="m-group">GESCHWINDIGKEIT</div><div style="display: flex; gap: 10px; align-items: center">'
              '<div class="m-prog" style="flex: 1; height: 8px"><i style="width: 100%"></i></div><b>100 %</b></div>'
              '<div class="m-group">FRACHT <span>200.000 Platz · 160.000 belegt</span></div>'
              + cargo('metal', '80.000', 40) + cargo('crystal', '60.000', 30) + cargo('deuterium', '20.000', 10)
              + '<div class="m-dim" style="font-size: 13px; margin-top: 4px">alles gleichmäßig · alles (#240)</div></div></div>')
    moves = ('<div class="m-card" style="margin-top: 12px"><div class="m-ch">Bewegungen<span class="m-right">jetzt 13:20 · Zeitleiste 6 h</span></div><div class="m-cb" style="font-size: 13.5px">'
             + ''.join(f'<div style="display: grid; grid-template-columns: 200px 1fr 70px; gap: 10px; align-items: center; margin: 5px 0">'
                       f'<span><span class="m-tag {c}">{t}</span> {d}</span><div class="m-prog" style="height: 8px; margin-left: {o}%"><i style="width: {w}%; background: var(--{col})"></i></div><b class="m-num">{a}</b></div>'
                       for c, t, d, o, w, col, a in [('red', 'FREMD', 'Angriff auf Nox', 0, 20, 'red', '14:32'),
                                                     ('green', 'TRANSPORT', 'Aurelia → Vesper', 0, 9, 'green', '13:50'),
                                                     ('gold', 'EXPEDITION', 'Position 16', 0, 78, 'gold', '18:00')])
             + '</div></div>')
    main = (h1('Flotte', 'Versenden · von Aurelia [1:27:8] · Slots 3 / 10',
               '<span class="m-chip on">Versenden</span><span class="m-chip">Bewegungen 3</span><span class="m-chip">Vorlagen 3</span>')
            + presets + '<div style="display: grid; grid-template-columns: 1fr 1.15fr; gap: 12px">' + ships + target + '</div>' + moves)
    insp = ('<div class="m-sect" style="margin-top: 0">VORSCHAU · LIVE</div>'
            '<div style="font: 600 16px var(--head); color: var(--gold-hi)">Transport nach Vesper</div><div class="m-dim" style="font-size: 13px">[1:44:9] · deine Kolonie</div>'
            '<div class="m-kv"><span>Schiffe</span><b>8 Lastbarken</b><span>langsamstes</span><b>Lastbarke · 13.500</b>'
            '<span>Flugzeit</span><b>1 h 12 min</b><span>Ankunft</span><b class="up">14:32</b><span>Rückkehr</span><b>15:44</b>'
            '<span>Treibstoff</span><b>1.240 Promethium</b></div>'
            '<div class="m-sect">LADERAUM</div><div class="m-prog" style="height: 10px"><i style="width: 80%"></i></div>'
            '<div class="m-dim" style="font-size: 13px; margin-top: 3px">160.000 von 200.000 · noch 40.000 frei</div>'
            '<div class="m-sect">PRÜFUNG</div><div style="font-size: 13.5px; line-height: 1.6">'
            '<div class="up">✓ Ziel erreichbar, Auftrag erlaubt</div><div class="up">✓ genug Promethium (1.240 von 41.000)</div>'
            '<div style="color: var(--orange)">! Lager auf Vesper: Psikristall nur noch 38.000 frei</div></div>'
            '<span class="m-btn big" style="display: block; margin-top: 14px">Flotte senden</span>'
            '<span class="m-btn ghost" style="display: block; margin-top: 8px">Als Vorlage speichern</span>'
            '<p class="m-dim" style="font-size: 12.5px">Senden fragt nicht nach; Rückruf bleibt jederzeit möglich (wie heute).</p>')
    ph = (ptitle('Flotte')
          + '<div class="m-chips"><span class="m-chip on">Versenden</span><span class="m-chip">Bewegungen 3</span><span class="m-chip">Vorlagen</span></div>'
          + '<div class="m-card" style="margin-bottom: 8px"><div class="m-ch">1 · Schiffe<span class="m-right">8 gewählt ▾</span></div><div class="m-cb">'
          + ship('large_cargo.svg', 'Lastbarke', 20, 8, '13.500') + ship('small_cargo.svg', 'Frachtläufer', 12, 0, '9.000') + '</div></div>'
          + '<div class="m-card" style="margin-bottom: 8px"><div class="m-ch">2 · Ziel<span class="m-right">Vesper [1:44:9] ▾</span></div></div>'
          + '<div class="m-card" style="margin-bottom: 8px"><div class="m-ch">3 · Auftrag<span class="m-right">Transport ▾</span></div></div>'
          + '<div class="m-card"><div class="m-ch">4 · Fracht<span class="m-right">160 k / 200 k ▾</span></div></div>'
          + '<div class="m-sheet" style="border-radius: 0; padding: 10px 14px"><div style="display: flex; align-items: center; gap: 10px; font-size: 13.5px">'
          '<div><b>Ankunft 14:32</b><br /><span class="m-dim">Rückkehr 15:44 · 1.240 Prom.</span></div>'
          '<span class="m-btn big" style="margin-left: auto">Senden</span></div></div>')
    ph2 = (ptitle('Vorlagen')
           + ''.join(f'<div class="m-pit"><img src="{I}ships/{ic}" alt="" /><div><div class="m-nm">{n}</div><div class="m-sm">{s}</div></div><span class="m-btn">▶ Start</span></div>'
                     for ic, n, s in [('large_cargo.svg', 'Transport Aurelia → Vesper', '8 Lastbarken · alles gleichmäßig'),
                                      ('cruiser.svg', 'Expedition Standard', '12 Fregatten, 4 Lastbarken · Pos. 16'),
                                      ('espionage_probe.svg', 'Spionage 3 Schädel', 'Ziel aus Karte oder Bericht')])
           + '<p class="m-dim" style="font-size: 13px">Eine Vorlage füllt das Formular; gesendet wird erst mit „Senden“ in der Vorschau.</p>')
    content = (
        '<h2 class="m-h">Heute</h2>'
        + before('desktop-fleet.png', 'phone-fleet.png', 'eine lange Seite: erst Schiffe, dann Ziel und Auftrag, die Folgen (Ankunft, Treibstoff) erst weiter unten.')
        + '<h2 class="m-h">Desktop: Versenden auf einem Bildschirm mit Live-Vorschau</h2>'
        + desk('Flotte', 'Versenden', main, insp, queue=False)
        + '''<div class="m-two" style="margin-top: 12px"><div class="m-ann"><ol>
<li><b>Alles auf einem Bildschirm</b>: Schiffe, Ziel, Auftrag, Tempo, Fracht nebeneinander; die Vorschau rechts rechnet sofort (OGame-Spieler wünschen sich das seit 2010; das Mehrseiten-Formular ist der Schmerzpunkt).</li>
<li><b>Aufträge als Chips</b>, nicht passende sind ausgegraut mit Grund.</li>
<li><b>Prüfung vor dem Senden</b>: Treibstoff, Lager am Ziel, Slots – als Liste mit ✓ und !.</li></ol></div>
<div class="m-ann"><ol start="4"><li><b>Vorlagen</b> (neu): Schiffsmix + Auftrag (+ Ziel) speichern und mit einem Klick laden (Travian Farmlisten, Clash of Clans „Army Recipes“, Stellaris Flottenvorlagen). Eine Vorlage sendet nie von selbst.</li>
<li><b>Bewegungen als Zeitleiste</b> statt Tabelle; fremde Flotten zuerst.</li>
<li>Offen: Ob „Alle Vorlagen starten“ (wie Travian) erlaubt sein soll – das berührt die Regel „Fair spielen“ (#181).</li></ol></div></div>'''
        + '<h2 class="m-h">Handy: eine Seite mit Abschnitten, Vorschau unten fest</h2><div class="m-row">'
        + phone('Flotte', ph) + phone('Flotte', ph2)
        + '<div class="m-ann"><ul><li>Abschnitte klappen auf; die Leiste unten zeigt immer Ankunft, Rückkehr, Treibstoff und „Senden“.</li><li>Vorlagen als eigene Liste.</li></ul></div></div>')
    return page('Studie – Modern: Flotte', 'Studie [V] · Flotte versenden, Bewegungen, Vorlagen · Werte sind Beispiele · Styling bleibt [E]', content)


# ------------------------------------------------------------------ map
def karte():
    pos = [(1, 'none'), (2, 'none'), (3, 'unk'), (4, 'enemy'), (5, 'none'), (6, 'guild'), (7, 'none'), (8, 'neutral'),
           (9, 'own'), (10, 'none'), (11, 'neutral'), (12, 'unk'), (13, 'none'), (14, 'none'), (15, 'enemy')]
    import math
    cx, cy = 120, 230
    sv = ['<svg viewBox="0 0 680 460" style="width: 100%; display: block; background: radial-gradient(ellipse at 18% 50%, #2a1a0c, #0b0806 60%)">']
    sv.append(f'<circle cx="{cx}" cy="{cy}" r="34" fill="#f3d36b" opacity="0.9" /><circle cx="{cx}" cy="{cy}" r="60" fill="#f0a050" opacity="0.12" />')
    for i, kind in pos:
        r = 70 + i * 34
        ang = -0.95 + (i * 0.137)
        sv.append(f'<path d="M {cx + r * math.cos(-1.1):.1f} {cy + r * math.sin(-1.1):.1f} A {r} {r} 0 0 1 {cx + r * math.cos(1.1):.1f} {cy + r * math.sin(1.1):.1f}" fill="none" stroke="#3b2f22" stroke-width="1" />')
        x, y = cx + r * math.cos(ang), cy + r * math.sin(ang)
        if kind == 'own':
            sv.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="9" fill="#6fb8ff" stroke="#cfefff" />')
        elif kind == 'guild':
            sv.append(f'<rect x="{x - 7:.1f}" y="{y - 7:.1f}" width="14" height="14" fill="#6fe0a8" transform="rotate(45 {x:.1f} {y:.1f})" />')
        elif kind == 'enemy':
            sv.append(f'<rect x="{x - 7:.1f}" y="{y - 7:.1f}" width="14" height="14" fill="#ee7660" transform="rotate(45 {x:.1f} {y:.1f})" />')
        elif kind == 'neutral':
            sv.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" fill="#a8997f" />')
        elif kind == 'unk':
            sv.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" fill="none" stroke="#a8997f" stroke-dasharray="3 2" /><text x="{x - 3:.1f}" y="{y + 4:.1f}" fill="#a8997f" font-size="11">?</text>')
        else:
            sv.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2" fill="#3b2f22" />')
        sv.append(f'<text x="{x + 12:.1f}" y="{y + 4:.1f}" fill="#a8997f" font-size="11" font-family="Georgia">{i}</text>')
        if i == 4:
            sv.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="15" fill="none" stroke="#f1d27a" stroke-width="2" />'
                      f'<text x="{x + 22:.1f}" y="{y - 10:.1f}" fill="#f1d27a" font-size="13" font-family="Georgia">Varn</text>')
    sv.append('</svg>')
    legend = ('<div class="m-chips" style="margin-top: 8px; font-size: 13px"><span class="m-dim">Legende:</span>'
              '<span><span style="color: #6fb8ff">●</span> eigen</span><span><span style="color: #6fe0a8">◆</span> Gilde</span>'
              '<span><span style="color: #ee7660">◆</span> feindlich (Krieg)</span><span><span style="color: #a8997f">●</span> neutral</span>'
              '<span>◌? unbekannt / Bericht ≥ 24 h</span></div>')
    main = (h1('Sternenkarte', 'Universum › Galaxie 1 › System 44',
               '<span class="m-chip on">Karte</span><span class="m-chip">Liste</span><span class="m-input">Suche Spieler / [g:s:p]</span>')
            + '<div class="m-chips"><span class="m-chip on">Besitz</span><span class="m-chip">Aktivität</span><span class="m-chip">Trümmer</span><span class="m-chip">Alter der Berichte</span>'
            '<span class="m-dim" style="margin-left: auto; font-size: 13px">Mausrad zoomt stufenlos · Galaxie ⇄ System ⇄ Planet (#160)</span></div>'
            + '<div class="m-card" style="overflow: hidden">' + ''.join(sv) + '</div>' + legend)
    insp = ('<div class="m-ihead">' + ball('wueste', 1, 'b64') + '<div><h2>Varn</h2><small>[1:44:4] · Planet · Mond: ja</small></div></div>'
            '<div class="m-kv"><span>Besitzer</span><b>Haus Valcor <span class="m-tag red">KRIEG</span></b><span>Aktivität</span><b>vor ca. 2 h</b>'
            '<span>Trümmerfeld</span><b>—</b></div>'
            '<div class="m-sect">DEIN LETZTER BERICHT · VOR 6 H</div><div class="m-kv">'
            '<span>Rohstoffe</span><b>≈ 1,2 Mio.</b><span>Flotte</span><b>0 Schiffe</b><span>Abwehr</span><b>310 Anlagen</b></div>'
            '<div class="m-dim" style="font-size: 12.5px">Nur eigene Berichte unter 24 h; danach „unbekannt“ statt 0 (#160 [E]).</div>'
            '<div class="m-sect">AKTIONEN</div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px">'
            '<span class="m-btn">Spionieren</span><span class="m-btn ghost">Angreifen</span><span class="m-btn ghost">Raketen</span>'
            '<span class="m-btn ghost">Bericht öffnen</span><span class="m-btn ghost">Vorlage …</span><span class="m-btn ghost">Nachricht</span></div>'
            '<p class="m-dim" style="font-size: 12.5px">Eine Aktion öffnet das Flottenformular mit Ziel; die Herkunft bleibt die aktive Welt (#236).</p>')
    rows = [(4, 'Varn', 'Haus Valcor', 'red', 'KRIEG', 'vor 2 h'), (6, 'Kessra Prime', 'Orden von Kessra', 'green', 'GILDE', '15 min'),
            (8, 'Tarsis', 'Leander', '', '', '1 Tag'), (9, 'Vesper', 'du', 'gold', 'EIGEN', 'jetzt'), (12, '?', 'unbekannt', '', '', '—')]
    ph = (ptitle('Karte')
          + '<div class="m-chips"><span class="m-chip">Karte</span><span class="m-chip on">Liste</span><span class="m-chip">[1:44] ▾</span></div>'
          + ''.join(f'<div class="m-pit" style="grid-template-columns: 26px 1fr auto"><b class="m-dim">{p}</b><div><div class="m-nm">{n}</div>'
                    f'<div class="m-sm">{o} {"<span class=" + chr(34) + "m-tag " + c + chr(34) + ">" + t + "</span>" if t else ""} · {a}</div></div><span class="m-dim">⋯</span></div>'
                    for p, n, o, c, t, a in rows))
    sheet = ('<div class="m-ihead">' + ball('wueste', 1, 'b40') + '<div><h2 style="font-size: 16px">Varn</h2><small>[1:44:4] · Haus Valcor · vor 2 h</small></div></div>'
             '<div class="m-kv"><span>Bericht</span><b>vor 6 h</b><span>Flotte</span><b>0 Schiffe</b></div>'
             '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px"><span class="m-btn">Spionieren</span><span class="m-btn ghost">Angreifen</span>'
             '<span class="m-btn ghost">Bericht</span><span class="m-btn ghost">Vorlage …</span></div>')
    content = (
        '<h2 class="m-h">Heute</h2>'
        + before('desktop-galaxy.png', 'phone-galaxy.png', 'eine Tabelle mit 16 Zeilen pro System, Blättern mit Pfeilen; Wissen über fremde Welten steht nicht neben dem Ziel.')
        + '<h2 class="m-h">Desktop: Karte mit Inspektor, Liste als gleichwertige Ansicht</h2>'
        + desk('Sternenkarte', None, main, insp, queue=False)
        + '''<div class="m-two" style="margin-top: 12px"><div class="m-ann"><ol>
<li>Die Karte folgt den Beschlüssen von #160 [E]: stufenloser Zoom, Planetenbilder, neue Spieler starten mit der Karte, Classic-Liste pro Spieler.</li>
<li><b>Inspektor</b> zum gewählten Ziel: Besitzer, Aktivität, eigener Bericht mit Alter, Aktionen (Recherche: Stellaris-Outliner, Homeworld-Sensorenkarte).</li>
<li><b>Ebenen</b> als Chips: Besitz, Aktivität, Trümmer, Alter der Berichte; immer mit Legende (EVE-Sternkarte: Spieler verlangten eine Farblegende).</li></ol></div>
<div class="m-ann"><ol start="4"><li><b>Liste</b> bleibt vollwertig (Tastatur, Handy, Classic).</li>
<li>Formen und Farben aus der Formensprache von #236: eigen Kreis blau, Gilde Raute grün, Feind Raute koralle, unbekannt gestrichelt.</li>
<li>Die Lage der Planeten auf der Karte ist nur Darstellung; Flugzeiten rechnen weiter mit Positionen (#236).</li></ol></div></div>'''
        + '<h2 class="m-h">Handy: Liste mit „⋯“-Blatt</h2><div class="m-row">'
        + phone('Karte', ph) + phone('Karte', ph, sheet, scrim=True)
        + '<div class="m-ann"><ul><li>Zeilen mit „⋯“-Blatt wie in #189 vorgeschlagen; das Blatt trägt dieselben Aktionen wie der Inspektor.</li><li>Die Karte selbst ist auf dem Handy ein Umschalter, keine Pflicht.</li></ul></div></div>')
    return page('Studie – Modern: Sternenkarte', 'Studie [V] · Sternenkarte mit Inspektor und Liste · baut auf #160 auf · Werte sind Beispiele', content)


# ------------------------------------------------------------------ reports
def losses(name, before_, after, pct, color):
    return (f'<div style="display: grid; grid-template-columns: 120px 1fr 90px; gap: 8px; align-items: center; font-size: 13.5px; margin: 3px 0">'
            f'<span>{name}</span><div class="m-prog" style="height: 8px"><i style="width: {pct}%; background: var(--{color})"></i></div>'
            f'<span class="m-num" style="text-align: right">{before_} → <b>{after}</b></span></div>')


def berichte():
    inbox = ('<div class="m-card" style="margin-bottom: 10px"><div class="m-ch">Seit deinem Besuch<span class="m-right">gestern 22:14</span></div>'
             '<div class="m-cb"><div class="m-chips" style="margin: 0"><span class="m-chip">⚔ 1 Kampf</span><span class="m-chip">👁 3 Spionage</span>'
             '<span class="m-chip">↩ 2 Flotten</span><span class="m-chip">✉ 1 Nachricht</span><span class="m-chip">⚑ 1 Gilde</span></div></div></div>'
             '<div class="m-chips"><span class="m-chip on">Alle</span><span class="m-chip">Kämpfe</span><span class="m-chip">Spionage</span>'
             '<span class="m-chip">Flotten</span><span class="m-chip">Nachrichten</span><span class="m-chip">📌 Angeheftet</span></div><div class="m-list">'
             + ''.join(f'<div class="m-it{" sel" if s else ""}" style="grid-template-columns: 84px 1fr 50px; font-size: 13.5px">'
                       f'<span class="m-tag {c}">{t}</span><div><b>{h}</b><div class="m-dim" style="font-size: 12.5px">{d}</div></div><span class="m-dim m-num">{tm}</span></div>'
                       for c, t, h, d, tm, s in [('red', 'KAMPF', 'Nox verteidigt', 'Sieg · Verluste 2 % · Trümmer 200 k', '03:12', True),
                                                 ('gold', 'SPIONAGE', 'Tarsis [1:44:8]', 'Planet · 310 k Rohstoffe · 42 Schiffe', '08:30', False),
                                                 ('gold', 'SPIONAGE', 'Varn [1:44:4] · Mond', '1,2 Mio. · 0 Schiffe', '08:12', False),
                                                 ('green', 'FLOTTE', 'Transport zurück', 'aus Vesper · 8 Lastbarken', '07:02', False),
                                                 ('blue', 'NACHRICHT', 'Leander', '„Hilfst du mir bei Varn?“', '06:41', False)])
             + '</div>')
    detail = ('<div class="m-card"><div class="m-ch">Kampfbericht · Nox [1:31:4] · Planet<span class="m-right">heute 03:12 · 3 Runden</span></div><div class="m-cb">'
              '<div style="display: flex; gap: 12px; align-items: center; margin-bottom: 8px"><span class="m-tag green" style="font-size: 13px">SIEG DER VERTEIDIGUNG</span>'
              '<span class="m-dim" style="font-size: 13.5px">Angreifer: Haus Valcor · Verteidiger: du</span></div>'
              '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px"><div><div class="m-sect" style="margin-top: 0">ANGREIFER · VERLOREN 100 %</div>'
              + losses('Abfangjäger', '120', '0', 100, 'red') + losses('Fregatte', '18', '0', 100, 'red') + losses('Lastbarke', '10', '0', 100, 'red')
              + '<div class="m-dim" style="font-size: 13px">Wert verloren ≈ 1,1 Mio.</div></div><div><div class="m-sect" style="margin-top: 0">VERTEIDIGER · VERLOREN 2 %</div>'
              + losses('Raketenbatterie', '120', '112', 7, 'red') + losses('Lichtlanze', '80', '80', 0, 'red') + losses('Massebeschleuniger', '6', '6', 0, 'red')
              + '<div class="m-dim" style="font-size: 13px">8 Raketenbatterien zerstört · 6 werden wieder aufgebaut</div></div></div>'
              '<div class="m-kv" style="grid-template-columns: repeat(4, auto auto); margin-top: 10px"><span>Beute</span><b>0</b><span>Trümmer</span><b>200 k</b>'
              '<span>Mond-Chance</span><b>2 %</b><span>Mond</span><b>nein</b></div>'
              '<div style="display: flex; gap: 8px; margin-top: 8px"><span class="m-btn ghost">Runden zeigen ▾</span><span class="m-btn ghost">Trümmer bergen</span>'
              '<span class="m-btn ghost">📌 Anheften</span><span class="m-btn ghost">Replay im Herold (#382)</span></div></div></div>'
              '<div class="m-card" style="margin-top: 10px"><div class="m-ch">Spionage · Tarsis [1:44:8] · Planet<span class="m-right">08:30 · vor 4 h</span></div>'
              '<div class="m-cb" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 13.5px">'
              '<div><div class="m-sect" style="margin-top: 0">ROHSTOFFE</div>≈ 310 k<br /><span class="m-dim">Beute bei Angriff ≈ 155 k</span></div>'
              '<div><div class="m-sect" style="margin-top: 0">FLOTTE</div>42 Schiffe<br /><span class="m-dim">30 Abfangjäger, 12 Fregatten</span></div>'
              '<div><div class="m-sect" style="margin-top: 0">ABWEHR</div>180 Anlagen<br /><span class="m-dim">Kleiner Schutzdom</span></div>'
              '<div><div class="m-sect" style="margin-top: 0">NÄCHSTES</div><span class="m-btn">Angreifen …</span></div></div></div>')
    main = (h1('Berichte', 'Kämpfe, Spionage, Flotten, Nachrichten an einem Ort', '<span class="m-chip">Ausführlich als Vorgabe ☐</span>')
            + '<div style="display: grid; grid-template-columns: 330px 1fr; gap: 12px">' + '<div>' + inbox + '</div><div>' + detail + '</div></div>')
    ph = (ptitle('Berichte')
          + '<div class="m-card" style="margin-bottom: 8px"><div class="m-ch">Seit deinem Besuch</div><div class="m-cb" style="font-size: 13.5px">1 Kampf · 3 Spionage · 2 Flotten · 1 Nachricht</div></div>'
          + '<div class="m-chips"><span class="m-chip on">Alle</span><span class="m-chip">Kämpfe</span><span class="m-chip">Spionage</span><span class="m-chip">Nachrichten</span></div>'
          + ''.join(f'<div class="m-pit" style="grid-template-columns: 74px 1fr auto"><span class="m-tag {c}">{t}</span><div><div class="m-nm" style="font-size: 13.5px">{h}</div><div class="m-sm">{d}</div></div><span class="m-sm">{tm}</span></div>'
                    for c, t, h, d, tm in [('red', 'KAMPF', 'Nox verteidigt', 'Sieg · 2 % Verlust', '03:12'), ('gold', 'SPIONAGE', 'Tarsis', 'Planet · 310 k', '08:30'),
                                           ('gold', 'SPIONAGE', 'Varn · Mond', '1,2 Mio.', '08:12'), ('green', 'FLOTTE', 'Transport zurück', 'aus Vesper', '07:02')]))
    sheet = ('<div style="font: 600 15px var(--head); color: var(--gold-hi)">Nox verteidigt · Sieg</div><div class="m-dim" style="font-size: 13px; margin-bottom: 6px">[1:31:4] Planet · 03:12 · 3 Runden</div>'
             + losses('Angreifer', '148', '0', 100, 'red') + losses('Du', '206', '198', 4, 'red')
             + '<div class="m-kv"><span>Trümmer</span><b>200 k</b><span>Mond-Chance</span><b>2 %</b><span>Wiederaufbau</span><b>6 von 8</b></div>'
             '<span class="m-btn big" style="display: block">Runden zeigen</span>')
    content = (
        '<h2 class="m-h">Heute</h2>'
        + before('desktop-messages.png', 'phone-messages.png', 'Reiter Berichte, Posteingang, Gesendet; ein Bericht ist ein Textblock (hier leer: Testdaten ohne Kampf).')
        + '<h2 class="m-h">Desktop: Posteingang mit Zusammenfassung, Bericht als Karte</h2>'
        + desk('Berichte', 'Kämpfe', main, None, queue=False)
        + '''<div class="m-two" style="margin-top: 12px"><div class="m-ann"><ol>
<li><b>„Seit deinem Besuch“</b> oben mit Zählern je Art (Stellaris Situation Log 2026, Forge of Empires Ereignis-Historie).</li>
<li><b>Bericht als Karte</b>: Ausgang, Verluste als Balken, Beute, Trümmer, Mond-Chance, Wiederaufbau; Runden erst auf Klick (Rise of Kingdoms „Battle Evaluation“).</li>
<li><b>Spionage kompakt</b>, aber Planet/Mond und Koordinaten bleiben immer sichtbar – OGame 11.15 hat genau das versteckt und Ärger bekommen.</li></ol></div>
<div class="m-ann"><ol start="4"><li><b>„Ausführlich als Vorgabe“</b> als Option: wer die langen Berichte will, behält sie.</li>
<li><b>Aktionen am Bericht</b>: Trümmer bergen, Angreifen mit Ziel, Anheften; Replay nur wenn der Herold (#382) eine Aufzeichnung hat.</li>
<li>Wenige Push-Arten, einzeln abschaltbar (gibt es: #192).</li></ol></div></div>'''
        + '<h2 class="m-h">Handy: hinter der Glocke</h2><div class="m-row">'
        + phone('Übersicht', ph) + phone('Übersicht', ph, sheet, scrim=True)
        + '<div class="m-ann"><ul><li>Die Glocke öffnet die Berichte (#189 D1 [E]); dieselben Filter wie am Desktop.</li><li>Ein Bericht öffnet als Blatt mit der Zusammenfassung.</li></ul></div></div>')
    return page('Studie – Modern: Berichte', 'Studie [V] · Berichte und Nachrichten · Werte sind Beispiele · Styling bleibt [E]', content)


import pages_c  # noqa: E402

PAGES = {
    '03-flotte.html': flotte,
    '04-karte.html': karte,
    '05-berichte.html': berichte,
    **pages_c.PAGES,
}
