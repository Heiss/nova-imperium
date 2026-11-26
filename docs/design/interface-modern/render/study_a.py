"""Study A – browser strategy, modernised (Travian, Forge of Empires, Grepolis).

The planet is the place: a scene with the buildings around it, a quick bar,
a strip of worlds at the bottom, queues on the side. Proposal only.
"""
from kit import (BUILDINGS, EVENTS, I, RES, ball, desk, g, grid, info, info_missing, page, phone,
                 report_card, resline, steps, tag)

SLOTS = [  # (icon, label, x, y, state, bubble, bubble class)
    ('buildings/metal_mine.svg', 'Tiefbohrung 18', 300, 150, '', 'ab 14:30', 'warn'),
    ('buildings/crystal_mine.svg', 'Steinbruch 15', 420, 92, 'run', '22 min', 'run'),
    ('buildings/deuterium_synthesizer.svg', 'Raffinerie 12', 560, 80, 'ok', '▲ baubar', 'ok'),
    ('buildings/solar_plant.svg', 'Sonnenkathedrale 16', 700, 92, 'ok', '▲ Energie!', 'ok'),
    ('buildings/research_lab.svg', 'Scholarium 9', 810, 150, 'run', 'Warp-Antrieb 3 h', 'run'),
    ('buildings/crystal_storage.svg', 'Reliquiar 5', 840, 280, 'warn', 'voll in 1 h 40', 'warn'),
    ('buildings/metal_storage.svg', 'Gewölbe 6', 810, 410, '', '', ''),
    ('buildings/shipyard.svg', 'Schiffsschmiede 8', 700, 470, 'run', '12 Fregatten', 'run'),
    ('buildings/robotics_factory.svg', 'Servitoren 8', 560, 490, '', '', ''),
    ('buildings/missile_silo.svg', 'Raketensilo', 420, 470, '', '', ''),
    ('buildings/trading_post.svg', 'Handelsposten', 300, 410, '', 'ab 16:40', 'warn'),
]

QUICK = [('planet', 'Planet', True, ''), ('research', 'Forschung', False, ''), ('fleet', 'Flotte', False, ''),
         ('map', 'Karte', False, ''), ('reports', 'Berichte', False, '7'), ('people', 'Gilde', False, '3'),
         ('book', 'Lexicanum', False, ''), ('gear', 'Optionen', False, '')]


def chrome(active='Planet', body='', right=''):
    quick = ''.join(f'<div class="k-iconbtn{" on" if n == active else ""}" title="{n}">{g(gl)}{f"<i>{c}</i>" if c else ""}</div>'
                    for gl, n, a, c in QUICK)
    worlds = ''.join(
        f'<div style="display: flex; gap: 8px; align-items: center; padding: 6px 12px; border-right: 1px solid var(--line);{" background: rgb(212 165 55 / 0.14)" if sel else ""}">'
        f'{ball(k, n, 34)}<div style="font-size: 12.5px; line-height: 1.25"><b>{name}</b><br /><span style="color: var(--{c})">{st}</span></div></div>'
        for k, n, name, c, st, sel in [('normal', 1, 'Aurelia', 'orange', 'Lager fast voll', True), ('wasser', 0, 'Nox', 'red', 'Angriff 14:32 · Bau leer', False),
                                       ('dschungel', 2, 'Vesper', 'green', 'Transport 13:50', False), ('eis', 0, 'Selene · Mond', 'dim', '—', False)])
    return (
        '<div class="k-bar"><b style="font: 800 15px var(--head); letter-spacing: 0.12em; color: var(--gold-hi)">NOVA IMPERIUM</b>'
        + resline() + '<span style="margin-left: auto" class="m-mode"><span class="on">Modern</span><span>Classic</span></span></div>'
        '<div class="k-abs" style="left: 10px; top: 64px; display: flex; flex-direction: column; gap: 8px">' + quick + '</div>'
        + body + right
        + '<div class="k-abs" style="left: 0; right: 0; bottom: 0; height: 52px; display: flex; background: #0f0b08; border-top: 1px solid var(--line)">'
        + worlds + '<div style="margin-left: auto; padding: 0 14px; display: flex; align-items: center"><span class="m-btn ghost">Imperium ▸ alle Welten</span></div></div>')


def scene(px=420, py=110, size=330, slots=True):
    s = (f'<div class="k-stars" style="position: absolute; left: 60px; right: 0; top: 52px; bottom: 52px"></div>'
         f'<div class="k-bigplanet" style="left: {px}px; top: {py}px; width: {size}px; height: {size}px; background-image: url(/planets/normal-1-surface.svg)"></div>'
         f'<div class="k-abs" style="left: {px - 150}px; top: {py - 40}px; width: {size + 300}px; height: {size + 80}px; border: 1px dashed #3b2f22; border-radius: 50%"></div>')
    if slots:
        for icon, lab, x, y, st, b, bc in SLOTS:
            s += f'<div class="k-slot {st}" style="left: {x}px; top: {y}px"><img src="{I}{icon}" alt="" /><span>{lab}</span></div>'
            if b:
                s += f'<span class="k-bubble {bc}" style="left: {x + 34}px; top: {y - 10}px">{b}</span>'
    s += '<div class="k-abs" style="left: 72px; top: 64px; font: 800 22px var(--head); color: var(--gold); letter-spacing: 0.06em">Aurelia <span style="font: 400 14px var(--body); color: var(--dim)">[1:27:8] · Felder 102 / 163</span></div>'
    return s


def queues(top=64):
    rows = ''.join(f'<div style="margin: 6px 0"><div style="display: flex; font-size: 13px"><span>{n}</span><span class="m-dim" style="margin-left: auto">{t}</span></div>'
                   f'<div class="m-prog"><i style="width: {p}%"></i></div></div>'
                   for n, t, p in [('Psikristall-Steinbruch 16', '22 min', 64), ('Warp-Antrieb 5', '3 h 12', 18), ('12 Fregatten', '1 h 05', 40)])
    return (f'<div class="k-panel k-abs" style="right: 12px; top: {top}px; width: 250px"><div class="k-ph">Aufträge auf Aurelia</div><div class="k-pb">{rows}'
            '<div class="m-dim" style="font-size: 12.5px">Bauplätze 1 / 1 · Werft 1 / 1</div></div></div>')


def a1():
    toast = ('<div class="k-panel k-abs" style="right: 12px; top: 384px; width: 250px"><div class="k-ph">Seit deinem Besuch · gestern 22:14<span class="k-x">✕</span></div>'
             '<div class="k-pb" style="line-height: 1.7">' + tag('red', 'KAMPF') + ' Nox verteidigt · Sieg · <span class="m-dim">03:12</span><br />'
             + tag('blue', 'FORSCHUNG') + ' Waffensegnung 11 fertig · <span class="m-dim">05:40</span><br />'
             + tag('gold', 'SPIONAGE') + ' 3 Berichte<br /><span class="m-btn ghost">Berichte öffnen</span></div></div>')
    nxt = ('<div class="k-panel k-abs" style="right: 12px; top: 250px; width: 250px"><div class="k-ph">Achtung</div><div class="k-pb" style="line-height: 1.6">'
           + tag('red', 'NOX') + ' Angriff 14:32 · <b>Bauplatz leer</b><br />' + tag('gold', 'LAGER') + ' Psikristall voll in 1 h 40<br />'
           + tag('gold', 'ENERGIE') + ' Minen 94 %</div></div>')
    return desk(chrome('Planet', scene(py=118), queues() + nxt + toast))


def a2():
    drawer = ('<div class="k-panel k-abs" style="left: 64px; right: 380px; bottom: 60px"><div class="k-ph">Alle Gebäude · kompakt<span class="k-x">Gebäude · Forschung · Werft · Abwehr</span></div>'
              '<div class="k-pb">' + grid(16, 42) + '</div></div>')
    return desk(chrome('Planet', scene(py=96, size=280) + drawer,
                       '<div class="k-abs" style="right: 12px; top: 64px">' + info(350) + '</div>'
                       '<div class="k-abs" style="right: 12px; top: 384px">' + info_missing(350) + '</div>'))


def a3():
    lists = ''.join(
        f'<div style="display: grid; grid-template-columns: 22px 1fr 130px 70px 70px; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 13.5px">'
        f'<span>☐</span><div><b>{t}</b><br /><span class="m-dim">{d}</span></div><span>{s}</span><span class="m-num">{e}</span><span class="m-btn{" dis" if dis else ""}">Senden</span></div>'
        for t, d, s, e, dis in [('Vesper [1:44:9]', 'Transport · alles gleichmäßig', '8 Lastbarken', '1 h 12', False),
                                ('Position 16 [1:27:16]', 'Expedition · 2 h halten', '12 Fregatten, 4 LB', '2 h 40', False),
                                ('Tarsis [1:44:8]', 'Spionage', '3 Spähschädel', '4 min', False),
                                ('Varn [1:44:4]', 'Angriff · Bericht 6 h alt', '40 Kathedralschiffe', '1 h 30', True)])
    body = ('<div class="k-abs" style="left: 72px; top: 64px; right: 420px; bottom: 64px"><div style="font: 800 22px var(--head); color: var(--gold); margin-bottom: 8px">Flotte · Einsatzlisten</div>'
            '<div class="m-chips"><span class="m-chip on">Aurelia: Alltag</span><span class="m-chip">Nox: Verteidigung</span><span class="m-chip off">+ neue Liste</span></div>'
            '<div class="k-panel"><div class="k-pb">' + lists + '<div style="margin-top: 8px; display: flex; gap: 8px"><span class="m-btn ghost">Markierte senden (offen, #181)</span>'
            '<span class="m-btn ghost">+ Ziel aus Karte</span></div></div></div>'
            '<div class="k-panel" style="margin-top: 10px"><div class="k-ph">Unterwegs</div><div class="k-pb" style="line-height: 1.7">'
            + tag('red', 'FREMD') + ' Haus Valcor → Nox · 14:32<br />' + tag('green', 'TRANSPORT') + ' Aurelia → Vesper · 13:50 · Rückkehr 15:10</div></div></div>')
    dispatch = ('<div class="k-info k-abs" style="right: 12px; top: 64px; width: 390px"><h2>Transport nach Vesper</h2><div class="m-dim" style="margin-bottom: 6px">aus der Liste „Alltag“ · alles änderbar</div>'
                '<div class="m-kv"><span>Schiffe</span><b>8 Lastbarken (von 20)</b><span>Fracht</span><b>80 k · 60 k · 20 k</b><span>Tempo</span><b>100 %</b>'
                '<span>Flugzeit</span><b>1 h 12 min</b><span>Ankunft</span><b class="up">14:32</b><span>Rückkehr</span><b>15:44</b><span>Treibstoff</span><b>1.240</b></div>'
                '<div class="k-need have"><span></span><span>Treibstoff vorhanden</span><b>✓</b></div>'
                '<div class="k-need miss"><span></span><span>Lager Vesper: Psikristall nur 38 k frei</span><b>!</b></div>'
                '<span class="m-btn big" style="display: block; margin-top: 10px">Senden</span></div>')
    return desk(chrome('Flotte', body, dispatch))


def a4():
    tiles = ''
    import random
    rnd = random.Random(3)
    for r in range(6):
        for c in range(12):
            sysn = 20 + r * 12 + c
            own = sysn in (27, 31, 44)
            sel = sysn == 44
            enemy = sysn in (45, 52)
            col = '#6fb8ff' if own else '#ee7660' if enemy else '#3b2f22'
            dots = ''.join(f'<i style="position: absolute; left: {rnd.randint(8, 70)}px; top: {rnd.randint(8, 44)}px; width: 5px; height: 5px; border-radius: 50%; background: {"#d9c9a8" if rnd.random() < 0.6 else "#6fe0a8"}"></i>' for _ in range(rnd.randint(1, 5)))
            tiles += (f'<div style="position: relative; height: 62px; border: 1px solid {col}; border-radius: 4px; background: rgb(255 255 255 / 0.02);{" outline: 2px solid #f1d27a" if sel else ""}">{dots}'
                      f'<span style="position: absolute; right: 4px; bottom: 2px; font-size: 10.5px; color: var(--dim)">{sysn}</span></div>')
    body = ('<div class="k-stars" style="position: absolute; left: 60px; right: 0; top: 52px; bottom: 52px"></div>'
            '<div class="k-abs" style="left: 72px; top: 64px; font: 800 22px var(--head); color: var(--gold)">Galaxie 1 <span style="font: 400 14px var(--body); color: var(--dim)">Sektoren 20–91 · blau: deine, rot: Krieg</span></div>'
            '<div class="k-abs" style="left: 72px; top: 104px; width: 800px; display: grid; grid-template-columns: repeat(12, 1fr); gap: 5px">' + tiles + '</div>')
    pop = ('<div class="k-panel k-abs" style="right: 12px; top: 64px; width: 360px"><div class="k-ph">System 1:44<span class="k-x">8 Welten</span></div><div class="k-pb">'
           + ''.join(f'<div style="display: grid; grid-template-columns: 22px 28px 1fr auto; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--line)">'
                     f'<b class="m-dim">{p}</b>{ball(k, 1, 26)}<div><b>{n}</b><br /><span class="m-dim" style="font-size: 12px">{o}</span></div><span class="m-btn ghost">{a}</span></div>'
                     for p, k, n, o, a in [(4, 'trocken', 'Varn', 'Haus Valcor · Krieg · 2 h', 'Spionieren'), (6, 'wueste', 'Kessra Prime', 'Orden von Kessra · Gilde', 'Halten'),
                                           (8, 'gas', 'Tarsis', 'Leander · 1 Tag', 'Spionieren'), (9, 'dschungel', 'Vesper', 'du', 'Öffnen')])
           + '</div></div>')
    return desk(chrome('Karte', body, pop))


def a5():
    lst = ''.join(f'<div style="display: grid; grid-template-columns: 90px 1fr 60px; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 13.5px{"; background: rgb(212 165 55 / 0.1)" if s else ""}">'
                  f'{tag(c, t)}<div><b>{h}</b><br /><span class="m-dim">{d}</span></div><span class="m-dim">{tm}</span></div>'
                  for c, t, h, d, tm, s in [('red', 'KAMPF', 'Nox verteidigt', 'Sieg · Trümmer 200 k', '03:12', True), ('gold', 'SPIONAGE', 'Tarsis [1:44:8] · Planet', '310 k · 42 Schiffe', '08:30', False),
                                            ('gold', 'SPIONAGE', 'Varn [1:44:4] · Mond', '1,2 Mio. · 0 Schiffe', '08:12', False), ('green', 'FLOTTE', 'Transport zurück', 'aus Vesper', '07:02', False),
                                            ('blue', 'NACHRICHT', 'Leander', '„Hilfst du mir bei Varn?“', '06:41', False)])
    body = ('<div class="k-abs" style="left: 72px; top: 64px; width: 520px"><div style="font: 800 22px var(--head); color: var(--gold); margin-bottom: 8px">Berichte</div>'
            '<div class="m-tabs"><span class="on">Alle <em>7</em></span><span>Kämpfe</span><span>Spionage</span><span>Flotten</span><span>Nachrichten</span><span>Archiv</span></div>'
            '<div class="m-chips"><span class="m-chip">Spieler: alle ▾</span><span class="m-chip">Welt: alle ▾</span><span class="m-chip off">Gefilterte löschen</span></div>'
            + lst + '</div>')
    return desk(chrome('Berichte', body, '<div class="k-abs" style="right: 12px; top: 64px">' + report_card(560) + '</div>'))


# ------------------------------------------------------------- phone
def ph_chrome(body, active=0):
    tabs = ''.join(f'<span style="display: grid; place-items: center; color: var(--{"gold-hi" if i == active else "dim"})">{g(n, 24)}</span>'
                   for i, n in enumerate(['planet', 'fleet', 'map', 'reports', 'menu']))
    return phone('<div style="padding: 30px 10px 6px; background: linear-gradient(#1d1611, #120d0a); border-bottom: 1px solid var(--line)">'
                 '<div style="display: flex; gap: 6px; flex-wrap: wrap">' + resline(True) + '</div></div>' + body
                 + '<div class="k-abs" style="left: 0; right: 0; bottom: 64px; display: flex; gap: 6px; padding: 6px 10px; background: #0f0b08; border-top: 1px solid var(--line)">'
                 + ''.join(ball(k, n, 30) for k, n in [('normal', 1), ('wasser', 0), ('dschungel', 2), ('eis', 0)])
                 + '<span class="m-dim" style="font-size: 12px; margin-left: 4px">Aurelia · Lager fast voll</span></div>'
                 '<div class="k-abs" style="left: 0; right: 0; bottom: 0; height: 64px; display: grid; grid-template-columns: repeat(5, 1fr); background: #110c09; border-top: 1px solid var(--line)">' + tabs + '</div>')


def phones():
    sc = ('<div class="k-stars" style="position: absolute; left: 0; right: 0; top: 96px; bottom: 112px"></div>'
          '<div class="k-bigplanet" style="left: 95px; top: 250px; width: 200px; height: 200px; background-image: url(/planets/normal-1-surface.svg)"></div>')
    sl = ''.join(f'<div class="k-slot {st}" style="left: {x}px; top: {y}px; width: 56px"><img src="{I}{ic}" alt="" style="width: 44px; height: 44px" /><span>{lb}</span></div>'
                 for ic, lb, x, y, st in [('buildings/crystal_mine.svg', '22 min', 50, 150, 'run'), ('buildings/solar_plant.svg', '▲', 166, 120, 'ok'),
                                          ('buildings/crystal_storage.svg', 'voll 1 h 40', 282, 150, 'warn'), ('buildings/research_lab.svg', '3 h', 300, 330, 'run'),
                                          ('buildings/shipyard.svg', '1 h', 270, 480, 'run'), ('buildings/metal_mine.svg', '14:30', 40, 470, ''), ('buildings/deuterium_synthesizer.svg', '▲', 20, 330, 'ok')])
    p1 = ph_chrome(sc + sl + '<div class="k-abs" style="left: 10px; top: 104px; font: 800 18px var(--head); color: var(--gold)">Aurelia</div>'
                   '<span class="k-bubble bad" style="left: 210px; top: 108px">Nox: Angriff 14:32</span>')
    p2 = ph_chrome('<div style="padding: 10px"><div style="font: 800 18px var(--head); color: var(--gold); margin-bottom: 6px">Bauen · kompakt</div>'
                   + grid(5, 64) + '</div><div class="k-scrim" style="position: absolute; inset: 0; background: rgb(0 0 0 / 0.5)"></div>'
                   '<div class="k-abs" style="left: 10px; right: 10px; top: 180px">' + info(368) + '</div>')
    p3 = ph_chrome('<div style="padding: 10px"><div style="font: 800 18px var(--head); color: var(--gold); margin-bottom: 6px">Einsatzlisten</div>'
                   + ''.join(f'<div class="m-pit" style="grid-template-columns: 1fr auto"><div><div class="m-nm">{t}</div><div class="m-sm">{d}</div></div><span class="m-btn">Senden</span></div>'
                             for t, d in [('Vesper · Transport', '8 Lastbarken · 1 h 12'), ('Position 16 · Expedition', '12 Fregatten · 2 h 40'), ('Tarsis · Spionage', '3 Spähschädel · 4 min')])
                   + '</div>', 1)
    p4 = ph_chrome('<div style="padding: 10px"><div style="font: 800 18px var(--head); color: var(--gold); margin-bottom: 6px">Galaxie 1</div>'
                   '<div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px">'
                   + ''.join(f'<div style="height: 46px; border: 1px solid {"#6fb8ff" if i in (7, 11, 24) else "#ee7660" if i in (25, 32) else "#3b2f22"}; border-radius: 3px;{" outline: 2px solid #f1d27a" if i == 24 else ""}"></div>' for i in range(36))
                   + '</div></div>', 2)
    p5 = ph_chrome('<div style="padding: 10px">' + report_card(368) + '</div>', 3)
    return [(p1, 'Einstieg: die Welt mit ihren Gebäuden, Blasen zeigen Zustand; unten die Welten.'),
            (p2, 'Bauen kompakt [E]: nur Bilder, grün = leistbar, orange = bald, rot = fehlt; Tippen öffnet die Infoseite.'),
            (p3, 'Flotte: Einsatzlisten mit „Senden“ je Zeile.'), (p4, 'Karte: Sektoren als Kacheln.'), (p5, 'Bericht als Karte.')]


def build():
    intro = ('<div class="k-intro"><div><b>Schwerpunkt: Browser-Strategie, modernisiert.</b> Vorbild Travian, Forge of Empires, Grepolis. '
             'Der Planet ist der Ort, an dem man spielt: Gebäude liegen um die Welt, Zustände stehen als Blasen daran. '
             'Navigation über eine Schnellleiste links und eine Leiste der Welten unten (Grepolis-Stadtliste, Travian-Dorfliste).</div>'
             '<div><ul><li>Bauen: Gebäude anklicken oder „Alle Gebäude“ kompakt [E].</li><li>Flotte: Einsatzlisten wie Travians Farmlisten.</li>'
             '<li>Karte: Sektoren als Kacheln, System als Liste.</li><li>Berichte: Reiter, Filter, Bericht als Karte.</li></ul></div></div>')
    desks = [('a1', '1 · Einstieg – die Welt', a1(), 'Nach dem Einloggen: die aktive Welt, „Seit deinem Besuch“ als Hinweis, Aufträge und „Achtung“ rechts.'),
             ('a2', '2 · Bauen – Gebäude anklicken oder kompakt', a2(), 'Kompakt [E]: nur Bilder, Rahmen grün/orange/rot; Klick öffnet die Infoseite mit Baubefehl, Kosten grün (da) oder rot (fehlt).'),
             ('a3', '3 · Flotte – Einsatzlisten', a3(), 'Wiederkehrende Flüge als Listen; ein Klick füllt das Formular rechts, gesendet wird erst mit „Senden“.'),
             ('a4', '4 · Karte – Sektoren', a4(), 'Galaxie als Kacheln (Grepolis-Inseln), System rechts als Liste mit Aktionen.'),
             ('a5', '5 · Berichte', a5(), 'Reiter und Filter wie Travian; „Gefilterte löschen“.')]
    return page('Studie A – Browser-Strategie', 'Studie A [V] · Schwerpunkt Browser-Strategie · Styling bleibt [E] · Werte sind Beispiele',
                '<h2 class="m-h">Studie A · Die Welt als Ort</h2>' + intro + steps(desks, phones()))
