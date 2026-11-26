"""Study B – 4X / space (Stellaris, EVE Online, Endless Space 2).

The map is always the background; a dock on the left opens windows, an
outliner on the right lists worlds, fleets and queues, alerts sit at the
top. Proposal only.
"""
from kit import (I, RES, ball, desk, g, galaxy_svg, grid, info, info_missing, page, phone, pill,
                 report_card, steps, system_svg, tag)

DOCK = [('planet', 'Welten'), ('research', 'Forschung'), ('fleet', 'Flotten'), ('map', 'Karte'),
        ('reports', 'Lagebuch'), ('people', 'Gilde'), ('book', 'Lexicanum'), ('gear', 'Optionen')]


def top():
    res = ''.join(f'<span style="display: flex; gap: 5px; align-items: center; font-size: 13.5px"><img src="{RES}{i}.svg" alt="" style="width: 16px" />'
                  f'<b class="m-num">{v}</b><span class="{c}" style="font-size: 12px">{d}</span></span>'
                  for i, v, d, c in [('metal', '184 k', '+6,1 k', 'up'), ('crystal', '92 k', '+3,0 k', 'up'), ('deuterium', '41 k', '+3,1 k', 'up'), ('energy', '−120', '', 'down')])
    alerts = ''.join(f'<span style="width: 30px; height: 30px; border: 2px solid var(--{c}); border-radius: {r}; display: grid; place-items: center; color: var(--{c})">{g(gl, 16)}</span>'
                     for gl, c, r in [('sword', 'red', '4px'), ('build', 'orange', '4px'), ('clock', 'orange', '50%'), ('reports', 'gold', '50%')])
    return ('<div class="k-abs" style="left: 0; right: 0; top: 0; height: 44px; display: flex; align-items: center; gap: 18px; padding: 0 14px; '
            'background: linear-gradient(rgb(29 22 17 / 0.95), rgb(18 13 10 / 0.85)); border-bottom: 1px solid var(--line)">'
            '<b style="font: 800 14px var(--head); letter-spacing: 0.12em; color: var(--gold-hi)">NOVA IMPERIUM</b>' + res
            + '<div style="margin-left: auto; display: flex; gap: 8px; align-items: center">' + alerts
            + '<span class="m-dim" style="font-size: 13px; margin-left: 8px">Tag 23 · 13:20</span></div></div>')


def dock(active):
    return ('<div class="k-abs" style="left: 0; top: 44px; bottom: 0; width: 56px; background: rgb(15 11 8 / 0.92); border-right: 1px solid var(--line); '
            'display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 10px">'
            + ''.join(f'<div class="k-iconbtn{" on" if n == active else ""}" title="{n}">{g(gl)}</div>' for gl, n in DOCK) + '</div>')


def outliner():
    def sec(t, body):
        return f'<div style="font: 600 11.5px var(--head); letter-spacing: 0.1em; color: var(--gold); margin: 8px 0 4px">▾ {t}</div>{body}'
    worlds = ''.join(f'<div style="display: grid; grid-template-columns: 24px 1fr auto; gap: 6px; align-items: center; margin: 4px 0; font-size: 13px">{ball(k, n, 22)}'
                     f'<div><b>{nm}</b><div class="m-prog" style="height: 3px"><i style="width: {p}%"></i></div></div><span style="color: var(--{c}); font-size: 12px">{t}</span></div>'
                     for k, n, nm, p, c, t in [('normal', 1, 'Aurelia', 64, 'dim', '22 min'), ('wasser', 0, 'Nox', 0, 'red', 'leer!'), ('dschungel', 2, 'Vesper', 80, 'dim', '1 h')])
    fleets = ''.join(f'<div style="font-size: 13px; margin: 4px 0">{tag(c, t)} {d} <span class="m-dim" style="float: right">{e}</span></div>'
                     for c, t, d, e in [('red', 'FREMD', '→ Nox', '14:32'), ('green', 'TR', 'Aurelia → Vesper', '13:50'), ('gold', 'EXP', 'Pos. 16', '18:00')])
    research = '<div style="font-size: 13px">Warp-Antrieb 5 <span class="m-dim" style="float: right">3 h 12</span></div><div class="m-prog" style="height: 3px"><i style="width: 18%"></i></div>'
    return ('<div class="k-panel k-abs" style="right: 8px; top: 52px; width: 230px; bottom: 8px"><div class="k-ph">Übersicht<span class="k-x">⇤</span></div><div class="k-pb">'
            + sec('WELTEN', worlds) + sec('FLOTTEN', fleets) + sec('FORSCHUNG', research)
            + sec('VORLAGEN', '<div class="m-dim" style="font-size: 13px">Transport Vesper · Expedition · Spionage 3</div>') + '</div></div>')


def frame(active, body, bg='galaxy'):
    m = galaxy_svg(1280, 720) if bg == 'galaxy' else system_svg(1280, 720, sun_x=280)
    return desk('<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="inset: 0">' + m + '</div>'
                + top() + dock(active) + body + outliner())


def window(x, y, w, h, title, body, tabs=''):
    t = f'<div class="m-tabs" style="margin: 0 0 8px">{tabs}</div>' if tabs else ''
    return (f'<div class="k-panel k-abs" style="left: {x}px; top: {y}px; width: {w}px; height: {h}px"><div class="k-ph">{title}<span class="k-x">— ▢ ✕</span></div>'
            f'<div class="k-pb">{t}{body}</div></div>')


def b1():
    log = ''.join(f'<div style="margin: 4px 0"><div style="font: 600 12px var(--head); color: var(--gold); letter-spacing: 0.08em">▾ {cat} <span class="m-dim">{n}</span></div>{items}</div>'
                  for cat, n, items in [
                      ('ANGEHEFTET', '1', '<div style="font-size: 13px">📌 Nox: Angriff 14:32 – Abwehr prüfen</div>'),
                      ('KÄMPFE', '1', '<div style="font-size: 13px">Nox verteidigt · Sieg · 03:12</div>'),
                      ('FORSCHUNG', '1', '<div style="font-size: 13px">Waffensegnung 11 fertig · 05:40</div>'),
                      ('BEFUNDE', '5', '<div style="font-size: 13px" class="m-dim">3 Spionageberichte, 2 Flotten zurück (gebündelt)</div>')])
    return frame('Lagebuch', window(80, 80, 380, 330, 'Lagebuch · seit 22:14', log)
                 + '<div class="k-abs" style="left: 600px; top: 60px; font-size: 13px; background: rgb(15 11 8 / 0.85); border: 1px solid var(--red); border-radius: 4px; padding: 4px 10px; color: var(--red)">■ Angriff auf Nox in 1 h 12 – Alarm bleibt bis 14:32</div>')


def b2():
    planet = ('<div style="display: grid; grid-template-columns: 180px 1fr 330px; gap: 12px">'
              '<div><div class="k-bigplanet" style="position: relative; width: 170px; height: 170px; background-image: url(/planets/normal-1-surface.svg)"></div>'
              '<div class="m-kv" style="font-size: 13px"><span>Felder</span><b>102 / 163</b><span>Temperatur</span><b>52–92 °C</b><span>Energie</span><b class="down">−120</b></div></div>'
              '<div>' + grid(6, 58) + '<div class="m-dim" style="font-size: 12.5px; margin-top: 6px">Kompakt [E] · grün leistbar · orange bald · rot fehlt · grau gesperrt</div></div>'
              '<div>' + info(330, True) + '</div></div>')
    return frame('Welten', window(70, 56, 960, 520, 'Aurelia [1:27:8] · Planetenfenster', planet,
                                  '<span>Übersicht</span><span class="on">Bauen <em>8</em></span><span>Werft</span><span>Abwehr</span><span>Rohstoffe</span>'), 'system')


def b3():
    ctx = ('<div class="k-panel k-abs" style="left: 770px; top: 370px; width: 210px"><div class="k-ph">Befehl für Flotte „Fracht 1“</div><div class="k-pb" style="line-height: 1.9">'
           '<div>▸ <b>Transport</b></div><div>▸ Stationieren</div><div class="m-dim">▸ Angriff – eigenes Ziel</div><div class="m-dim">▸ Spionage – eigenes Ziel</div></div></div>'
           '<div class="k-abs" style="left: 770px; top: 528px; width: 210px; font-size: 12.5px; background: rgb(15 11 8 / 0.9); border: 1px solid var(--gold); border-radius: 4px; padding: 6px 8px">'
           'Ankunft <b class="up">14:32</b> · Rückkehr 15:44<br />Treibstoff 1.240 · Fracht 160 k / 200 k</div>')
    fm = window(70, 380, 420, 230, 'Flottenmanager',
                ''.join(f'<div style="display: grid; grid-template-columns: 1fr auto auto; gap: 8px; padding: 4px 0; border-bottom: 1px solid var(--line); font-size: 13px{"; background: rgb(212 165 55 / 0.1)" if s else ""}">'
                        f'<span><b>{n}</b> <span class="m-dim">{d}</span></span><span>{w}</span><span class="m-btn ghost">{a}</span></div>'
                        for n, d, w, a, s in [('Fracht 1', '8 Lastbarken', 'Aurelia', 'gewählt', True), ('Heimatwacht', '140 Abfangjäger', 'Aurelia', 'Wählen', False),
                                              ('Expedition', '12 Fregatten, 4 LB', 'Pos. 16', 'Rückruf', False)])
                + '<div class="m-dim" style="font-size: 12.5px; margin-top: 6px">Flotte wählen → Ziel auf der Karte rechtsklicken → Befehl.</div>')
    return frame('Flotten', fm + ctx)


def b4():
    insp = window(70, 56, 330, 320, 'Varn [1:44:4]',
                  '<div style="display: flex; gap: 10px; align-items: center">' + ball('trocken', 1, 56) + '<div><b>Haus Valcor</b> ' + tag('red', 'KRIEG')
                  + '<br /><span class="m-dim">aktiv vor 2 h · Mond: ja</span></div></div>'
                  '<div class="m-sect">DEIN BERICHT · VOR 6 H</div><div class="m-kv"><span>Rohstoffe</span><b>≈ 1,2 Mio.</b><span>Flotte</span><b>0</b><span>Abwehr</span><b>310</b></div>'
                  '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px"><span class="m-btn">Spionieren</span><span class="m-btn ghost">Angreifen</span>'
                  '<span class="m-btn ghost">Raketen</span><span class="m-btn ghost">Bericht</span></div>')
    layers = ('<div class="k-abs" style="left: 420px; bottom: 14px; display: flex; gap: 6px">'
              + ''.join(f'<span class="m-chip{" on" if o else ""}">{n}</span>' for n, o in [('Besitz', True), ('Aktivität', False), ('Trümmer', False), ('Alter der Berichte', False), ('Routen', True)])
              + '</div>')
    return frame('Karte', insp + layers, 'system')


def b5():
    log = ''.join(f'<div style="padding: 5px 0; border-bottom: 1px solid var(--line); font-size: 13px{"; background: rgb(212 165 55 / 0.1)" if s else ""}">{tag(c, t)} {h}</div>'
                  for c, t, h, s in [('red', 'KAMPF', 'Nox verteidigt · 03:12', True), ('gold', 'SPIONAGE', 'Tarsis · 08:30', False), ('gold', 'SPIONAGE', 'Varn · Mond · 08:12', False),
                                     ('green', 'FLOTTE', 'Transport zurück · 07:02', False), ('blue', 'NACHRICHT', 'Leander · 06:41', False)])
    return frame('Lagebuch', window(70, 56, 300, 380, 'Lagebuch', '<div class="m-chips"><span class="m-chip on">Alle</span><span class="m-chip">📌</span></div>' + log)
                 + '<div class="k-abs" style="left: 390px; top: 56px">' + report_card(560) + '</div>')


# ------------------------------------------------------------- phone
def ph(body, active=0, bg=True):
    tabs = ''.join(f'<span style="display: grid; place-items: center; color: var(--{"gold-hi" if i == active else "dim"})">{g(n, 24)}</span>'
                   for i, n in enumerate(['map', 'planet', 'fleet', 'reports', 'menu']))
    back = ('<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="left: -300px; top: 40px">' + galaxy_svg(1000, 600) + '</div>') if bg else ''
    return phone(back + '<div class="k-abs" style="left: 0; right: 0; top: 0; padding: 30px 10px 6px; display: flex; gap: 6px; flex-wrap: wrap; background: rgb(18 13 10 / 0.9); border-bottom: 1px solid var(--line)">'
                 + pill('metal', '184 k') + pill('crystal', '92 k') + pill('deuterium', '41 k') + '<span style="color: var(--red); margin-left: auto">■ ■</span></div>'
                 + body + '<div class="k-abs" style="left: 0; right: 0; bottom: 0; height: 64px; display: grid; grid-template-columns: repeat(5, 1fr); background: #110c09; border-top: 1px solid var(--line)">' + tabs + '</div>')


def sheet(h, body):
    return f'<div class="m-sheet" style="bottom: 64px; height: {h}px">{body}</div>'


def phones():
    p1 = ph(sheet(260, '<b style="color: var(--gold-hi)">Lagebuch</b><div style="font-size: 13.5px; line-height: 1.9">📌 Nox: Angriff 14:32<br />Kampf: Nox verteidigt<br />Forschung: Waffensegnung 11<br /><span class="m-dim">Befunde: 5 gebündelt</span></div>'))
    p2 = ph(sheet(560, '<b style="color: var(--gold-hi)">Aurelia · Bauen</b><div style="margin-top: 8px">' + grid(5, 62) + '</div>'), 1)
    p3 = ph(sheet(250, '<b style="color: var(--gold-hi)">Befehl: Fracht 1 → Vesper</b><div class="m-chips" style="margin-top: 8px"><span class="m-chip on">Transport</span><span class="m-chip">Stationieren</span></div>'
                  '<div class="m-kv"><span>Ankunft</span><b class="up">14:32</b><span>Treibstoff</span><b>1.240</b></div><span class="m-btn big" style="display: block">Befehl geben</span>'), 2)
    p4 = ph('<div class="k-abs" style="left: 0; top: 60px">' + system_svg(390, 420, sun_x=30, label=False) + '</div>' + sheet(230, '<b style="color: var(--gold-hi)">Varn [1:44:4]</b> ' + tag('red', 'KRIEG')
            + '<div class="m-kv"><span>Bericht</span><b>vor 6 h</b><span>Flotte</span><b>0</b></div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px"><span class="m-btn">Spionieren</span><span class="m-btn ghost">Angreifen</span></div>'), 0, False)
    p5 = ph('<div class="k-abs" style="left: 10px; top: 100px">' + report_card(368) + '</div>', 3, False)
    return [(p1, 'Einstieg: Karte im Hintergrund, Lagebuch als Blatt; Alarme oben.'), (p2, 'Planetenfenster als Blatt, kompakt [E].'),
            (p3, 'Flotte: Ziel antippen, Befehl wählen.'), (p4, 'Karte mit Ziel-Blatt.'), (p5, 'Bericht.')]


def build():
    intro = ('<div class="k-intro"><div><b>Schwerpunkt: Moderne 4X / Weltraum.</b> Vorbild Stellaris, EVE Online, Endless Space 2. '
             'Die Karte ist immer da; alles andere sind Fenster darüber. Links ein Dock (EVE „Neocom“), rechts eine Übersicht aller Welten, Flotten und Aufträge (Stellaris „Outliner“), oben Alarme (eckig = bleibt, rund = verschwindet).</div>'
             '<div><ul><li>Bauen: Planetenfenster mit Reitern, kompakt [E].</li><li>Flotte: Flotte wählen, Ziel rechtsklicken, Befehl wählen; Vorschau am Mauszeiger.</li>'
             '<li>Karte: Ebenen unten, Inspektor als Fenster.</li><li>Berichte: Lagebuch mit Gruppen und Anheften.</li></ul></div></div>')
    desks = [('b1', '1 · Einstieg – Karte und Lagebuch', b1(), 'Die Galaxie mit eigenen Routen; das Lagebuch fasst zusammen (Stellaris Situation Log 2026); Alarm „Angriff“ bleibt sichtbar.'),
             ('b2', '2 · Bauen – Planetenfenster', b2(), 'Fenster über der Systemkarte; kompakt [E] mit Infoseite im Fenster.'),
             ('b3', '3 · Flotte – Befehl auf der Karte', b3(), 'Flotte im Manager wählen, Ziel auf der Karte rechtsklicken, Befehl wählen; Ankunft und Treibstoff am Ziel.'),
             ('b4', '4 · Karte – System mit Inspektor', b4(), 'Ebenen als Chips; das Ziel als Fenster mit eigenem Bericht und Aktionen.'),
             ('b5', '5 · Berichte – Lagebuch', b5(), 'Gruppiert, anheftbar; der Bericht als Karte daneben.')]
    return page('Studie B – 4X / Weltraum', 'Studie B [V] · Schwerpunkt 4X / Weltraum · Styling bleibt [E] · Werte sind Beispiele',
                '<h2 class="m-h">Studie B · Die Karte als Arbeitsfläche</h2>' + intro + steps(desks, phones()))
