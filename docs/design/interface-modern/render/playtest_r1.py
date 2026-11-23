"""Playtest round 1 – arriving and building (phone views, proposal only).

Four situations of the game loop, each in three emphases:
A browser strategy, B 4X / space, C mobile strategy. The page shows them
blind as 1/2/3 in a mixed order (ORDER below).
"""
import os

from kit import (I, RES, ball, feed, g, galaxy_svg, info, need, phone, pill, tag)

# situation -> order of emphases shown as variant 1, 2, 3
ORDER = {'s1': 'cab', 's2': 'bca', 's3': 'acb', 's4': 'bac'}


def top_simple(extra=''):
    return ('<div class="k-abs" style="left: 0; right: 0; top: 0; padding: 30px 10px 6px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; '
            'background: rgb(18 13 10 / 0.92); border-bottom: 1px solid var(--line)">'
            + pill('metal', '184 k') + pill('crystal', '<span style="color: var(--orange)">92 k</span>') + pill('deuterium', '41 k') + extra + '</div>')


def stars():
    return '<div class="k-stars" style="position: absolute; inset: 0"></div>'


def gal(left=-440, top=90, w=1280, h=640):
    return f'<div class="k-abs" style="left: {left}px; top: {top}px">{galaxy_svg(w, h)}</div>'


def quickbar(active=0):
    return ('<div class="k-abs" style="left: 0; right: 0; bottom: 0; height: 62px; display: grid; grid-template-columns: repeat(5, 1fr); background: #110c09; border-top: 1px solid var(--line)">'
            + ''.join(f'<span style="display: grid; place-items: center; color: var(--{"gold-hi" if i == active else "dim"})">{g(n, 24)}</span>'
                      for i, n in enumerate(['map', 'planet', 'fleet', 'reports', 'menu'])) + '</div>')


def worlds_strip(bottom=62):
    return (f'<div class="k-abs" style="left: 0; right: 0; bottom: {bottom}px; display: flex; gap: 8px; padding: 6px 10px; background: #0f0b08; border-top: 1px solid var(--line); align-items: center">'
            + ''.join(f'<div style="text-align: center; font-size: 10.5px; line-height: 1.1">{ball(k, n, 30)}<br /><span style="color: var(--{c})">{t}</span></div>'
                      for k, n, c, t in [('normal', 1, 'orange', 'Aurelia'), ('wasser', 0, 'red', 'Nox'), ('dschungel', 2, 'green', 'Vesper'), ('eis', 0, 'dim', 'Selene')])
            + '</div>')


def corners(labels=('FLOTTE', 'LAGE', 'BAUEN'), glyphs=('fleet', 'home', 'build')):
    return (f'<div class="k-corner" style="left: 14px; top: 682px; width: 78px; height: 78px; font-size: 11px">{g(glyphs[0])}{labels[0]}</div>'
            f'<div class="k-corner" style="left: 166px; top: 702px; width: 58px; height: 58px; font-size: 10px">{g(glyphs[1])}{labels[1]}</div>'
            f'<div class="k-corner" style="left: 298px; top: 682px; width: 78px; height: 78px; font-size: 11px">{g(glyphs[2])}{labels[2]}</div>')


# ------------------------------------------------------------------ S1 login: galaxy map + a few dashboard infos
def s1(e):
    if e == 'a':
        tiles = ''.join(f'<div style="height: 50px; border: 1px solid {"#6fb8ff" if i in (7, 11, 24) else "#ee7660" if i in (25, 32) else "#3b2f22"}; border-radius: 3px; position: relative">'
                        + (f'<span class="k-bubble {b}" style="left: 2px; top: 2px; font-size: 9.5px; padding: 0 4px">{t}</span>' if t else '') + '</div>'
                        for i, (b, t) in enumerate([('', '')] * 7 + [('warn', 'voll')] + [('', '')] * 3 + [('bad', '14:32')] + [('', '')] * 12 + [('ok', '13:50')] + [('', '')] * 11))
        body = (stars() + top_simple() + '<div style="position: relative; padding: 100px 10px 0">'
                '<div style="font: 800 17px var(--head); color: var(--gold); margin-bottom: 6px">Galaxie 1 · Sektoren</div>'
                '<div class="k-panel" style="margin-bottom: 8px"><div class="k-pb" style="font-size: 12.5px; line-height: 1.6">'
                + tag('red', 'NOX') + ' Angriff 14:32 · ' + tag('gold', 'LAGER') + ' voll 1 h 40 · ' + tag('blue', 'BERICHTE') + ' 3 neu</div></div>'
                '<div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px">' + tiles + '</div></div>'
                + worlds_strip() + quickbar(0))
    elif e == 'b':
        alerts = ''.join(f'<span style="width: 26px; height: 26px; border: 2px solid var(--{c}); border-radius: {r}; display: grid; place-items: center; color: var(--{c})">{g(gl, 14)}</span>'
                         for gl, c, r in [('sword', 'red', '4px'), ('build', 'orange', '4px'), ('reports', 'gold', '50%')])
        body = (stars() + gal() + top_simple('<span style="margin-left: auto; display: flex; gap: 4px">' + alerts + '</span>')
                + '<div class="k-panel k-abs" style="right: 0; top: 140px; width: 150px; border-radius: 6px 0 0 6px"><div class="k-ph">Übersicht ⇤</div><div class="k-pb" style="font-size: 12px; line-height: 1.6">'
                'Aurelia · 22 min<br /><span class="down">Nox · leer!</span><br />Vesper · 1 h<br />' + tag('red', 'FREMD') + ' 14:32</div></div>'
                '<div class="k-abs" style="left: 10px; bottom: 76px"><span class="k-pill">Lagebuch · 1 Kampf · 3 Befunde ▸</span></div>' + quickbar(0))
    else:
        bub = ''.join(f'<div class="k-abs" style="left: {x - 21}px; top: {y - 21}px">{ball(k, n, 42)}</div>'
                      f'<span class="k-bubble {c}" style="left: {bx}px; top: {by}px">{t}</span>'
                      for k, n, x, y, bx, by, c, t in [('normal', 1, 95, 470, 10, 410, 'warn', 'Aurelia · voll 1 h 40'),
                                                      ('wasser', 0, 141, 500, 170, 520, 'bad', 'Nox · Angriff 14:32'),
                                                      ('dschungel', 2, 290, 410, 200, 450, 'ok', 'Vesper · 13:50')])
        timers = ''.join(f'<span class="k-pill" style="font-size: 12px">{g(gl, 14)} {t}</span>' for gl, t in [('build', '22m'), ('research', '3h'), ('fleet', '1h')])
        body = (stars() + gal(-440, 110) + top_simple() + f'<div class="k-abs" style="left: 10px; top: 92px; display: flex; gap: 6px">{timers}</div>'
                + '<div class="k-abs" style="left: 10px; right: 10px; top: 128px; background: rgb(21 16 12 / 0.95); border: 1px solid var(--gold); border-radius: 10px; padding: 8px 10px; font-size: 13px">'
                '<b style="color: var(--gold-hi)">Während du weg warst:</b> Sieg auf Nox · 3 Spionageberichte ▸</div>' + bub + corners())
    return phone(body)


# ------------------------------------------------------------------ S2 dashboard
def s2(e):
    if e == 'a':
        cards = ''.join(f'<div class="k-panel" style="margin-bottom: 8px"><div class="k-ph">{t}</div><div class="k-pb" style="font-size: 13px; line-height: 1.6">{b}</div></div>'
                        for t, b in [('Achtung', tag('red', 'NOX') + ' Angriff 14:32 · Bauplatz leer<br />' + tag('gold', 'LAGER') + ' Psikristall voll in 1 h 40'),
                                     ('Läuft', 'Steinbruch 16 · 22 min<div class="m-prog"><i style="width: 64%"></i></div>Warp-Antrieb 5 · 3 h 12<div class="m-prog"><i style="width: 18%"></i></div>'),
                                     ('Seit deinem Besuch', '1 Kampf · 1 Forschung · 2 Flotten · 3 Spionage'),
                                     ('Nachbarn', 'Leander gründet Kolonie in 1:44 · Haus Valcor ▲ Platz 1')])
        body = stars() + top_simple() + '<div style="position: relative; padding: 100px 10px 0"><div style="font: 800 18px var(--head); color: var(--gold); margin-bottom: 6px">Übersicht</div>' + cards + '</div>' + worlds_strip() + quickbar(0)
    elif e == 'b':
        cats = ''.join(f'<div style="margin: 6px 0"><div style="font: 600 12px var(--head); color: var(--gold); letter-spacing: 0.08em">▾ {c} <span class="m-dim">{n}</span></div><div style="font-size: 13px">{b}</div></div>'
                       for c, n, b in [('ANGEHEFTET', '1', '📌 Nox: Angriff 14:32 – Abwehr prüfen'), ('KÄMPFE', '1', 'Nox verteidigt · Sieg · 03:12'),
                                       ('FORSCHUNG', '1', 'Waffensegnung 11 fertig'), ('NACHBARN', '2', 'Leander kolonisiert 1:44 · Valcor greift an'),
                                       ('BEFUNDE', '5', '<span class="m-dim">3 Spionage, 2 Flotten zurück (gebündelt)</span>')])
        worlds = ''.join(f'<div style="display: grid; grid-template-columns: 24px 1fr auto; gap: 6px; align-items: center; margin: 4px 0; font-size: 13px">{ball(k, n, 22)}<div><b>{nm}</b><div class="m-prog" style="height: 3px"><i style="width: {p}%"></i></div></div><span style="color: var(--{c})">{t}</span></div>'
                         for k, n, nm, p, c, t in [('normal', 1, 'Aurelia', 64, 'dim', '22 min'), ('wasser', 0, 'Nox', 0, 'red', 'leer'), ('dschungel', 2, 'Vesper', 80, 'dim', '1 h')])
        body = (stars() + gal() + top_simple() + '<div class="m-sheet" style="bottom: 62px; height: 560px"><b style="color: var(--gold-hi)">Lagebuch · seit 22:14</b>' + cats
                + '<div style="font: 600 12px var(--head); color: var(--gold); margin-top: 8px">WELTEN</div>' + worlds + '</div>' + quickbar(3))
    else:
        hero = ('<div class="k-info" style="text-align: center; margin-bottom: 8px"><div style="font: 800 18px var(--head); color: var(--gold-hi)">Während du weg warst</div>'
                '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 8px 0">'
                + ''.join(f'<div style="border: 1px solid var(--{c}); border-radius: 6px; padding: 4px"><b style="font: 800 17px var(--head); color: var(--{c})">{n}</b><div style="font-size: 11.5px">{t}</div></div>'
                          for n, t, c in [('Sieg', 'Nox gehalten', 'green'), ('+11', 'Waffen', 'c'), ('3', 'Spionage', 'gold')]) + '</div></div>')
        body = (stars() + top_simple() + '<div style="position: relative; padding: 96px 10px 0">' + hero
                + '<div style="font: 600 12px var(--head); color: var(--gold); letter-spacing: 0.08em; margin-bottom: 2px">WAS DIE ANDEREN TUN</div>' + feed(n=4) + '</div>'
                + corners(('FLOTTE', 'KARTE', 'BAUEN'), ('fleet', 'map', 'build')))
    return phone(body)


# ------------------------------------------------------------------ S3 building on fields (#158)
FIELDS = {  # kind: (colour, label)
    'ore': ('#7a4a2c', 'Erzader'), 'cry': ('#2f5f7a', 'Kristallhöhle'), 'hyd': ('#2f7a63', 'Hydrothermal'),
    'sun': ('#9a7a2c', 'Sonnenhang'), 'mtn': ('#3a3530', 'Gebirge'), 'neu': ('#2a211a', 'Ödland'), 'sea': ('#1c3556', 'Ozean')}
MAP = ['ore ore neu sun sun mtn',
       'ore neu neu sun neu mtn',
       'neu cry cry neu hyd sea',
       'neu cry neu neu hyd sea',
       'mtn neu neu ore neu sea',
       'mtn mtn neu neu neu neu']
BLD = {(0, 0): 'metal_mine', (0, 3): 'solar_plant', (2, 1): 'crystal_mine', (2, 4): 'deuterium_synthesizer',
       (1, 1): 'robotics_factory', (3, 2): 'research_lab', (4, 3): 'metal_storage', (3, 1): 'crystal_storage', (5, 3): 'shipyard'}


def field_grid(size, hexagon=False, sel=(1, 4), show_eff=False):
    out = []
    for r, row in enumerate(MAP):
        for c, kind in enumerate(row.split()):
            col, lab = FIELDS[kind]
            x = c * (size + 4) + (size / 2 if hexagon and r % 2 else 0)
            y = r * (size * (0.82 if hexagon else 1) + 4)
            shape = 'clip-path: polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%);' if hexagon else 'border-radius: 6px;'
            hatch = 'background-image: repeating-linear-gradient(45deg, transparent 0 6px, rgb(255 255 255 / 0.07) 6px 8px);' if kind == 'mtn' else ''
            border = '2px solid #f1d27a' if (r, c) == sel else '1px solid rgb(0 0 0 / 0.5)'
            inner = ''
            if (r, c) in BLD:
                inner = f'<img src="{I}buildings/{BLD[(r, c)]}.svg" alt="" style="width: 70%; height: 70%; margin: 15%; border-radius: 4px" />'
            elif show_eff and kind in ('sun', 'neu', 'hyd'):
                eff = {'sun': '120 %', 'neu': '100 %', 'hyd': '90 %'}[kind]
                inner = f'<span style="position: absolute; inset: 0; display: grid; place-items: center; font: 700 11px var(--body); color: #fff">{eff}</span>'
            out.append(f'<div class="k-abs" style="left: {x:.0f}px; top: {y:.0f}px; width: {size}px; height: {size}px; background: {col}; {hatch} {shape} border: {border}">{inner}</div>')
    return ''.join(out)


def legend():
    return ('<div style="display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 11.5px; margin-top: 6px">'
            + ''.join(f'<span><i style="display: inline-block; width: 10px; height: 10px; background: {c}; border-radius: 2px; margin-right: 3px"></i>{lab}</span>' for c, lab in FIELDS.values())
            + '</div>')


def s3(e):
    if e == 'a':
        grid = f'<div style="position: relative; height: 376px">{field_grid(56)}</div>'
        panel = ('<div class="k-panel" style="margin-top: 6px"><div class="k-ph">Feld E2 · Sonnenhang · frei</div><div class="k-pb" style="font-size: 13px; line-height: 1.6">'
                 'Sonnenkathedrale <b class="up">120 %</b> · Fusionssanktum 100 % · Minen 80 %'
                 '<div style="margin-top: 6px"><span class="m-btn">Hier bauen …</span></div></div></div>')
        body = (stars() + top_simple() + '<div style="position: relative; padding: 96px 10px 0"><div style="font: 800 17px var(--head); color: var(--gold); margin-bottom: 4px">Aurelia · Oberfläche <span style="font: 400 12px var(--body); color: var(--dim)">102 / 163 Felder</span></div>'
                + grid + legend() + panel + '</div>' + quickbar(1))
    elif e == 'b':
        grid = f'<div style="position: relative; height: 330px; margin-left: 4px">{field_grid(56, hexagon=True)}</div>'
        body = (stars() + top_simple() + '<div style="position: relative; padding: 96px 10px 0"><div class="m-chips"><span class="m-chip on">Oberfläche</span><span class="m-chip">Ertrag</span><span class="m-chip">Nachbarn</span></div>'
                + grid + legend() + '</div>'
                + '<div class="m-sheet" style="bottom: 62px"><b style="color: var(--gold-hi)">E2 · Sonnenhang</b> <span class="m-dim">frei</span>'
                '<table class="m-mini" style="margin-top: 6px"><tr><th>Gebäude</th><th class="n">Ertrag</th><th class="n">Nachbarn</th></tr>'
                '<tr><td>Sonnenkathedrale</td><td class="n up">120 %</td><td class="n">+0</td></tr><tr><td>Fusionssanktum</td><td class="n">100 %</td><td class="n up">+5 % Ozean</td></tr>'
                '<tr><td>Adamant-Tiefbohrung</td><td class="n down">80 %</td><td class="n">—</td></tr></table></div>' + quickbar(1))
    else:
        grid = f'<div style="position: relative; height: 410px">{field_grid(60, show_eff=True)}</div>'
        bar = ('<div class="m-sheet" style="bottom: 0; padding-bottom: 18px"><b style="color: var(--gold-hi)">Ziehe ein Gebäude auf ein Feld</b>'
               '<div style="display: flex; gap: 8px; margin-top: 8px">'
               + ''.join(f'<div class="k-tile {s}" style="width: 58px; height: 58px; flex: none{"; outline: 3px solid var(--gold-hi); outline-offset: 2px" if i == 0 else ""}"><img src="{I}buildings/{b}.svg" alt="" /></div>'
                         for i, (b, s) in enumerate([('solar_plant', 'ok'), ('fusion_reactor', 'ok'), ('metal_mine', 'soon'), ('crystal_storage', 'ok'), ('missile_silo', 'ok')]))
               + '</div><div class="m-dim" style="font-size: 12px; margin-top: 6px">Beim Ziehen zeigt jedes Feld den Ertrag; gebaut wird erst nach „Bestätigen“.</div></div>')
        body = stars() + top_simple() + '<div style="position: relative; padding: 96px 6px 0">' + grid + '</div>' + bar
    return phone(body)


# ------------------------------------------------------------------ S4 info page of a building (compact mode)
def s4(e):
    if e == 'a':
        body = (stars() + top_simple() + '<div style="position: relative; padding: 96px 10px 0">'
                '<div style="display: flex; gap: 10px; align-items: center"><img src="' + I + 'buildings/robotics_factory.svg" alt="" style="width: 84px; height: 84px; border: 1px solid var(--gold); border-radius: 6px" />'
                '<div><div style="font: 800 18px var(--head); color: var(--gold-hi)">Servitorenschmiede</div><span class="m-dim">Stufe 8 → 9</span></div></div>'
                '<div class="m-tabs" style="margin-top: 8px"><span class="on">Wirkung</span><span>Stufen</span><span>Voraussetzungen</span></div>'
                '<div style="font-size: 13.5px; margin-bottom: 6px">Bauzeit aller Gebäude <b class="up">−10 %</b> (2 h 05 → 1 h 52 für die Tiefbohrung 19).</div>'
                + need('metal', '102.400') + need('crystal', '30.720') + need('deuterium', '51.200', False, '10.200')
                + '<div class="m-kv"><span>Bauzeit</span><b>1 h 52</b><span>leistbar</span><b style="color: var(--orange)">18:39</b></div>'
                '<span class="m-btn dis big" style="display: block">Ausbauen ab 18:39</span>'
                '<span class="m-btn ghost big" style="display: block; margin-top: 6px">Erinnern, wenn leistbar</span></div>' + quickbar(1))
    elif e == 'b':
        body = (stars() + gal() + top_simple() + '<div class="k-abs" style="inset: 0; background: rgb(0 0 0 / 0.55)"></div>'
                '<div class="k-panel k-abs" style="left: 10px; right: 10px; top: 110px"><div class="k-ph">Servitorenschmiede · Stufe 8<span class="k-x">✕</span></div><div class="k-pb">'
                '<table class="m-mini"><tr><th>Stufe</th><th class="n">Bauzeit-Faktor</th><th class="n">Kosten</th></tr><tr style="background: rgb(212 165 55 / 0.1)"><td>9</td><td class="n">−10 %</td><td class="n">184 k</td></tr>'
                '<tr><td>10</td><td class="n">−9 %</td><td class="n">369 k</td></tr><tr><td>11</td><td class="n">−8 %</td><td class="n">737 k</td></tr></table>'
                '<div class="m-sect">KOSTEN STUFE 9</div>' + need('metal', '102.400') + need('crystal', '30.720') + need('deuterium', '51.200', False, '10.200')
                + '<div class="m-sect">ABHÄNGIG</div><div style="font-size: 12.5px">Schaltet frei: Machina-Schwarmhalle (ab 10) · Bauzeit aller Gebäude</div>'
                '<div style="display: flex; gap: 6px; margin-top: 8px"><span class="m-btn dis" style="flex: 1">ab 18:39</span><span class="m-btn ghost">In Warteschlange</span></div></div></div>' + quickbar(1))
    else:
        body = (stars() + top_simple() + '<div class="k-abs" style="inset: 0; background: rgb(0 0 0 / 0.5)"></div>'
                '<div class="m-sheet" style="height: 560px; text-align: center">'
                '<img src="' + I + 'buildings/robotics_factory.svg" alt="" style="width: 120px; height: 120px; border: 2px solid var(--gold); border-radius: 14px" />'
                '<div style="font: 800 20px var(--head); color: var(--gold-hi); margin-top: 6px">Servitorenschmiede 9</div>'
                '<div style="font-size: 14px; margin: 4px 0 10px">Alle Gebäude bauen <b class="up">10 % schneller</b></div>'
                '<div style="display: flex; gap: 6px; justify-content: center; margin-bottom: 10px">'
                + ''.join(f'<span style="border-radius: 14px; padding: 6px 10px; font-size: 13.5px; background: {"rgb(156 203 118 / 0.15)" if ok else "rgb(238 118 96 / 0.18)"}; color: var(--{"green" if ok else "red"}); border: 1px solid var(--{"green" if ok else "red"})">'
                          f'<img src="{RES}{i}.svg" alt="" style="width: 15px; vertical-align: -3px" /> {v}</span>'
                          for i, v, ok in [('metal', '102 k', True), ('crystal', '31 k', True), ('deuterium', '51 k · fehlt 10 k', False)])
                + '</div><div class="k-corner" style="position: relative; display: inline-grid; width: 120px; height: 120px; font-size: 13px; filter: grayscale(0.6)">AB<br />18:39</div>'
                '<div class="m-dim" style="font-size: 12.5px; margin-top: 8px">← wischen: nächstes Gebäude →</div></div>')
    return phone(body)


SITUATIONS = {'s1': s1, 's2': s2, 's3': s3, 's4': s4}


def build_sheet():
    """One HTML page with every phone, each in a figure with an id for the screenshots."""
    parts = []
    for sid, fn in SITUATIONS.items():
        for e in 'abc':
            parts.append(f'<figure id="r1-{sid}-{e}" style="margin: 0; display: inline-block">{fn(e)}</figure>')
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest Runde 1</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-wrap: wrap; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, 'r1-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/r1-sheet.html')
