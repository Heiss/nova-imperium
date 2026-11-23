"""Playtest round 1, situation s1m – the galaxy map with systems of many
worlds and routes between players (owner's feedback, 2026-11-23).

Only the map differs between the three variants; the header, the pull-up
dashboard sheet [E] and the tab bar are the same, so the pick is about the
map alone. Example: the player's three worlds are all in system 1:27
(positions 4, 8, 11); guild member Mira in 1:26; Haus Valcor (war) in 1:31;
Tarsis and Varn in 1:44. Proposal only.
"""
import math
import os

from kit import g, phone, pill

W, H = 390, 780
TOP = 96           # below the header
SHEET_TOP = 640    # top of the collapsed dashboard sheet

OWN, GUILD, WAR, OTHER = '#6fb8ff', '#6fe0a8', '#ee7660', '#a8997f'


def header():
    return ('<div class="k-abs" style="left: 0; right: 0; top: 0; padding: 30px 10px 6px; display: flex; gap: 6px; align-items: center; '
            'background: rgb(18 13 10 / 0.92); border-bottom: 1px solid var(--line); z-index: 3">'
            + pill('metal', '184 k') + pill('crystal', '<span style="color: var(--orange)">92 k</span>') + pill('deuterium', '41 k')
            + '<span class="k-pill" style="margin-left: auto">Galaxie 1 ▾</span></div>')


def sheet():
    """The pull-up dashboard [E], collapsed: a handle and one line of the situation."""
    return ('<div class="k-abs" style="left: 0; right: 0; top: 640px; bottom: 62px; background: #17110d; border-top: 1px solid var(--gold); '
            'border-radius: 16px 16px 0 0; box-shadow: 0 -8px 24px rgb(0 0 0 / 0.6); padding: 6px 12px; z-index: 3">'
            '<div style="width: 40px; height: 4px; border-radius: 2px; background: var(--line); margin: 0 auto 6px"></div>'
            '<div style="display: flex; gap: 6px; align-items: center; font-size: 12.5px; white-space: nowrap; overflow: hidden">'
            '<b style="font: 600 12px var(--head); color: var(--gold-hi); letter-spacing: 0.06em">LAGE ▴</b>'
            '<span class="m-tag red">ANGRIFF 14:32</span><span class="m-tag gold">LAGER 1 h 40</span><span class="m-tag blue">3 BERICHTE</span></div></div>')


def tabs():
    return ('<div class="k-abs" style="left: 0; right: 0; bottom: 0; height: 62px; display: grid; grid-template-columns: repeat(5, 1fr); background: #110c09; border-top: 1px solid var(--line); z-index: 3">'
            + ''.join(f'<span style="display: grid; place-items: center; color: var(--{"gold-hi" if i == 0 else "dim"})">{g(n, 24)}</span>'
                      for i, n in enumerate(['map', 'planet', 'fleet', 'reports', 'menu'])) + '</div>')


def frame(svg, extra=''):
    return phone('<div class="k-stars" style="position: absolute; inset: 0"></div>'
                 f'<div class="k-abs" style="left: 0; top: {TOP}px">{svg}</div>' + extra + header() + sheet() + tabs())


def route(x1, y1, x2, y2, col, label='', bend=0.25, dash='6 4', lx=None, ly=None):
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    dx, dy = x2 - x1, y2 - y1
    cx, cy = mx - dy * bend, my + dx * bend
    s = (f'<path d="M {x1:.0f} {y1:.0f} Q {cx:.0f} {cy:.0f} {x2:.0f} {y2:.0f}" stroke="{col}" stroke-width="2.2" fill="none" stroke-dasharray="{dash}" />'
         f'<circle cx="{x2:.0f}" cy="{y2:.0f}" r="3" fill="{col}" />')
    if label:
        tx = lx if lx is not None else cx
        ty = ly if ly is not None else cy
        w = 7 * len(label) + 12
        s += (f'<rect x="{tx - w / 2:.0f}" y="{ty - 10:.0f}" width="{w}" height="18" rx="9" fill="#0f0b08" stroke="{col}" />'
              f'<text x="{tx:.0f}" y="{ty + 3:.0f}" fill="{col}" font-size="11.5" font-family="Georgia" text-anchor="middle">{label}</text>')
    return s


def bg_stars(n, w, h, seed, avoid=()):
    import random
    rnd = random.Random(seed)
    out = []
    for _ in range(n):
        x, y = rnd.uniform(0, w), rnd.uniform(0, h)
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rnd.choice([0.8, 1, 1.3])}" fill="#d9c9a8" opacity="{rnd.uniform(0.2, 0.6):.2f}" />')
    return ''.join(out)


# ------------------------------------------------------------------ variant a: stars with pips
def pips(x, y, occupied, r=13, big=False):
    """A system as a star; one small dot per occupied position (1-15) on a ring, coloured by owner."""
    s = f'<circle cx="{x}" cy="{y}" r="{6 if big else 4}" fill="#f3d36b" />'
    if big:
        s += f'<circle cx="{x}" cy="{y}" r="{r + 7}" fill="none" stroke="{OWN}" stroke-width="1.5" opacity="0.7" />'
    for pos, col in occupied:
        a = -math.pi / 2 + (pos - 1) * 2 * math.pi / 15
        s += f'<circle cx="{x + r * math.cos(a):.1f}" cy="{y + r * math.sin(a):.1f}" r="{3.4 if big else 2.6}" fill="{col}" stroke="#0f0b08" stroke-width="0.8" />'
    return s


def variant_a():
    w, h = W, SHEET_TOP - TOP
    sys = {  # system: (x, y, occupied positions)
        '1:24': (60, 70, [(5, OTHER), (9, OTHER)]), '1:26': (120, 200, [(7, GUILD), (12, OTHER)]),
        '1:27': (190, 300, [(4, OWN), (8, OWN), (11, OWN), (14, OTHER)]), '1:29': (310, 150, [(6, OTHER)]),
        '1:31': (300, 390, [(3, WAR), (5, WAR), (9, WAR)]), '1:35': (90, 430, [(8, OTHER), (10, OTHER)]),
        '1:44': (330, 500, [(4, WAR), (6, GUILD), (8, OTHER)]), '1:21': (250, 60, [(2, OTHER)])}
    svg = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}">', bg_stars(160, w, h, 4)]
    svg.append(route(300, 390, 196, 306, WAR, 'Angriff 14:32', 0.2, lx=280, ly=345))
    svg.append(route(120, 200, 184, 290, GUILD, 'Mira hält', -0.25, lx=120, ly=262))
    svg.append(route(196, 312, 326, 492, '#f1d27a', 'Spionage 4 min', -0.3, '2 4', lx=220, ly=455))
    for name, (x, y, occ) in sys.items():
        big = name == '1:27'
        svg.append(pips(x, y, occ, 16 if big else 11, big))
        svg.append(f'<text x="{x + (24 if big else 16)}" y="{y + 4}" fill="{"#f1d27a" if big else "#a8997f"}" font-size="{12 if big else 10.5}" font-family="Georgia">{name}{" · deine 3 Welten" if big else ""}</text>')
    svg.append('</svg>')
    legend = ('<div class="k-abs" style="left: 10px; top: 104px; z-index: 2; font-size: 11.5px; background: rgb(15 11 8 / 0.85); border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px">'
              f'<span style="color: {OWN}">●</span> du <span style="color: {GUILD}">●</span> Gilde <span style="color: {WAR}">●</span> Krieg <span style="color: {OTHER}">●</span> andere · Punkt = besetzte Position</div>')
    return frame(''.join(svg), legend)


# ------------------------------------------------------------------ variant b: spiral by system number
def variant_b():
    w, h = W, SHEET_TOP - TOP
    cx, cy = w / 2, h / 2 + 10
    # systems 18..48 along a spiral arm; neighbouring numbers stay neighbours
    pts = {}
    for i, sn in enumerate(range(18, 49)):
        t = 0.9 + i * 0.235
        r = 38 + i * 4.9
        pts[sn] = (cx + r * math.cos(t), cy + r * math.sin(t) * 1.05)
    svg = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}">', bg_stars(120, w, h, 9)]
    path = ' '.join(f'{"M" if i == 0 else "L"} {x:.1f} {y:.1f}' for i, (x, y) in enumerate(pts.values()))
    svg.append(f'<path d="{path}" stroke="#3b2f22" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.8" />')
    owners = {27: OWN, 26: GUILD, 31: WAR, 44: WAR, 24: OTHER, 29: OTHER, 35: OTHER, 21: OTHER}
    for sn, (x, y) in pts.items():
        col = owners.get(sn)
        if col:
            svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{8 if sn == 27 else 5}" fill="{col}" stroke="#0f0b08" stroke-width="1.5" />')
        else:
            svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2" fill="#6b5a44" />')
        if (sn % 5 == 0 and abs(sn - 27) > 2) or sn in (27, 31, 44):
            svg.append(f'<text x="{x + 9:.1f}" y="{y - 6:.1f}" fill="{"#f1d27a" if sn == 27 else "#a8997f"}" font-size="{12 if sn == 27 else 10.5}" font-family="Georgia">{sn}</text>')
    (x27, y27), (x31, y31), (x26, y26), (x44, y44) = pts[27], pts[31], pts[26], pts[44]
    svg.append(route(x31, y31, x27, y27, WAR, 'Angriff 14:32 · 4 Systeme', 0.35, lx=x27 + 105, ly=y27 - 48))
    svg.append(route(x26, y26, x27, y27, GUILD, '', -0.6))
    svg.append(route(x27, y27, x44, y44, '#f1d27a', 'Spionage · 17 Systeme', -0.15, '2 4', lx=x44 - 30, ly=y44 - 36))
    svg.append('</svg>')
    note = ('<div class="k-abs" style="left: 10px; top: 104px; z-index: 2; font-size: 11.5px; background: rgb(15 11 8 / 0.85); border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; max-width: 250px">'
            'Systeme in ihrer Reihenfolge auf einem Arm: nah auf der Karte = kurzer Flug.<br /><span style="color: #f1d27a">27</span> = dein System, 3 Welten</div>')
    return frame(''.join(svg), note)


# ------------------------------------------------------------------ variant c: player markers
def marker(x, y, col, initials, count, name, own=False):
    r = 17 if own else 13
    s = (f'<circle cx="{x}" cy="{y}" r="{r}" fill="{col}" stroke="#0f0b08" stroke-width="2" />'
         f'<text x="{x}" y="{y + 4}" fill="#120d0a" font-size="{12 if own else 10}" font-weight="700" font-family="Georgia" text-anchor="middle">{initials}</text>')
    if count > 1:
        s += (f'<circle cx="{x + r - 2}" cy="{y - r + 2}" r="8" fill="#0f0b08" stroke="{col}" />'
              f'<text x="{x + r - 2}" y="{y - r + 6}" fill="{col}" font-size="10" font-family="Georgia" text-anchor="middle">{count}</text>')
    s += f'<text x="{x}" y="{y + r + 13}" fill="{"#f1d27a" if own else "#e9dfc8"}" font-size="{11.5 if own else 10.5}" font-family="Georgia" text-anchor="middle">{name}</text>'
    return s


def variant_c():
    w, h = W, SHEET_TOP - TOP
    svg = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}">', bg_stars(160, w, h, 12)]
    svg.append(route(300, 380, 200, 300, WAR, 'Angriff 14:32', 0.2, lx=290, ly=320))
    svg.append(route(110, 200, 190, 288, GUILD, 'hält Nox', -0.25, lx=110, ly=258))
    svg.append(route(196, 316, 316, 476, '#f1d27a', 'Spionage', 0.45, '2 4', lx=200, ly=430))
    svg.append(marker(200, 300, OWN, 'DU', 3, 'Du · 1:27', True))
    svg.append(marker(110, 200, GUILD, 'MI', 1, 'Mira · 1:26'))
    svg.append(marker(300, 380, WAR, 'HV', 3, 'Haus Valcor · 1:31'))
    svg.append(marker(320, 486, WAR, 'VA', 1, 'Varn · 1:44'))
    svg.append(marker(270, 120, OTHER, 'LE', 2, 'Leander · 1:29'))
    svg.append(marker(70, 420, OTHER, 'TA', 1, 'Tarsis · 1:35'))
    svg.append('</svg>')
    pop = ('<div class="k-panel k-abs" style="left: 10px; top: 104px; width: 210px; z-index: 2"><div class="k-ph">System 1:27 · deins</div><div class="k-pb" style="font-size: 12px; line-height: 1.55">'
           f'<span style="color: {OWN}">4</span> Nox · <span style="color: {OWN}">8</span> Aurelia · <span style="color: {OWN}">11</span> Vesper<br />'
           f'<span style="color: {OTHER}">14</span> Stiller Hafen (Leander)<br /><span class="m-dim">11 Positionen frei · Tippen öffnet das System</span></div></div>')
    return frame(''.join(svg), pop)


VARIANTS = {'a': variant_a, 'b': variant_b, 'c': variant_c}


def build_sheet():
    parts = [f'<figure id="r1-s1m-{e}" style="margin: 0; display: inline-block">{fn()}</figure>' for e, fn in VARIANTS.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest s1m</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-wrap: wrap; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'r1m-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/r1m-sheet.html')


# ------------------------------------------------------------------ s1n: stars with pips plus names (owner's note on s1m)
SYS_N = {  # system: (x, y, [(pos, colour, player)])
    '1:24': (60, 70, [(5, OTHER, 'Orlan'), (9, OTHER, 'Orlan')]), '1:26': (120, 200, [(7, GUILD, 'Mira'), (12, OTHER, 'Sev')]),
    '1:27': (190, 300, [(4, OWN, 'du'), (8, OWN, 'du'), (11, OWN, 'du'), (14, OTHER, 'Leander')]), '1:29': (310, 150, [(6, OTHER, 'Leander')]),
    '1:31': (300, 390, [(3, WAR, 'Haus Valcor'), (5, WAR, 'Haus Valcor'), (9, WAR, 'Haus Valcor')]), '1:35': (90, 430, [(8, OTHER, 'Tarsis'), (10, OTHER, 'Ilka')]),
    '1:44': (330, 500, [(4, WAR, 'Varn'), (6, GUILD, 'Kessra'), (8, OTHER, 'Tarsis')]), '1:21': (250, 60, [(2, OTHER, 'Quill')])}


def owners(occ):
    seen = {}
    for _, col, who in occ:
        seen.setdefault(who, [col, 0])[1] += 1
    return seen


def map_n(mode):
    w, h = W, SHEET_TOP - TOP
    svg = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}">', bg_stars(160, w, h, 4)]
    svg.append(route(300, 390, 196, 306, WAR, 'Angriff 14:32', 0.2, lx=280, ly=345))
    svg.append(route(120, 200, 184, 290, GUILD, 'Mira hält', -0.25, lx=120, ly=262))
    svg.append(route(196, 312, 326, 492, '#f1d27a', 'Spionage', -0.3, '2 4', lx=225, ly=455))
    extra = ''
    for name, (x, y, occ) in SYS_N.items():
        big = name == '1:27'
        svg.append(pips(x, y, [(p, c) for p, c, _ in occ], 16 if big else 11, big))
        if mode == 'a':
            who = ', '.join(f'{k}{" ×" + str(v[1]) if v[1] > 1 else ""}' for k, v in owners(occ).items())
            right = x > 280
            tx = x - 16 if right else x + (24 if big else 16)
            anc = 'end' if right else 'start'
            svg.append(f'<text x="{tx}" y="{y - 2}" text-anchor="{anc}" fill="{"#f1d27a" if big else "#a8997f"}" font-size="10.5" font-family="Georgia">{name}</text>'
                       f'<text x="{tx}" y="{y + 11}" text-anchor="{anc}" fill="#e9dfc8" font-size="11" font-family="Georgia">{who}</text>')
        elif mode == 'b':
            svg.append(f'<text x="{x + (24 if big else 16)}" y="{y + 4}" fill="{"#f1d27a" if big else "#a8997f"}" font-size="10.5" font-family="Georgia">{name}</text>')
        else:
            svg.append(f'<text x="{x + (24 if big else 16)}" y="{y + 4}" fill="{"#f1d27a" if big else "#a8997f"}" font-size="10.5" font-family="Georgia">{name}</text>')
    svg.append('</svg>')
    if mode == 'b':
        # zoomed one step: the area around 1:27 larger, a name at every pip
        z = ['<svg width="390" height="544" viewBox="0 0 390 544">', bg_stars(90, 390, 544, 7)]
        z.append(route(235, 465, 205, 300, WAR, 'Angriff 14:32', 0.3, lx=300, ly=380))
        z.append(route(90, 150, 180, 270, GUILD, 'Mira hält', -0.2, lx=85, ly=240))
        for name, (x, y, r, occ) in {'1:27': (200, 290, 52, SYS_N['1:27'][2]), '1:26': (110, 140, 34, SYS_N['1:26'][2]), '1:31': (225, 470, 38, SYS_N['1:31'][2])}.items():
            z.append(f'<circle cx="{x}" cy="{y}" r="9" fill="#f3d36b" /><circle cx="{x}" cy="{y}" r="{r}" fill="none" stroke="#3b2f22" />')
            z.append(f'<text x="{x}" y="{y - r - 8}" text-anchor="middle" fill="{"#f1d27a" if name == "1:27" else "#a8997f"}" font-size="12" font-family="Georgia">{name}</text>')
            for p, col, who in occ:
                a = -math.pi / 2 + (p - 1) * 2 * math.pi / 15
                px, py = x + r * math.cos(a), y + r * math.sin(a)
                anchor = 'start' if math.cos(a) >= 0 else 'end'
                dx = 9 if anchor == 'start' else -9
                z.append(f'<circle cx="{px:.0f}" cy="{py:.0f}" r="5" fill="{col}" stroke="#0f0b08" />'
                         f'<text x="{px + dx:.0f}" y="{py + 4:.0f}" text-anchor="{anchor}" fill="#e9dfc8" font-size="11" font-family="Georgia">{p} · {who}</text>')
        z.append('</svg>')
        hint = ('<div class="k-abs" style="left: 10px; top: 104px; z-index: 2"><span class="k-pill">Zoom: Namen erscheinen ab der zweiten Stufe</span></div>')
        return frame(''.join(z), hint)
    if mode == 'c':
        extra = ('<div class="k-panel k-abs" style="left: 150px; top: 230px; width: 225px; z-index: 2"><div class="k-ph">1:31 · 3 Welten</div><div class="k-pb" style="font-size: 12.5px; line-height: 1.6">'
                 f'<span style="color: {WAR}">3</span> Haus Valcor · Krieg<br /><span style="color: {WAR}">5</span> Haus Valcor<br /><span style="color: {WAR}">9</span> Haus Valcor<br />'
                 '<span class="m-dim">12 Positionen frei · Tippen auf eine Welt öffnet sie</span></div></div>'
                 '<div class="k-abs" style="left: 284px; top: 470px; width: 34px; height: 34px; border-radius: 50%; border: 2px solid #f1d27a; z-index: 1"></div>')
    return frame(''.join(svg), extra)


VARIANTS_N = {'a': lambda: map_n('a'), 'b': lambda: map_n('b'), 'c': lambda: map_n('c')}


def build_sheet_n():
    parts = [f'<figure id="r1-s1n-{e}" style="margin: 0; display: inline-block">{fn()}</figure>' for e, fn in VARIANTS_N.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest s1n</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-wrap: wrap; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'r1n-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet_n())
    print('wrote playtest/r1n-sheet.html')
