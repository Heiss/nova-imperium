"""Playtest round 6 – repeats inside the winners.

s2r: [E] r1 s2m: pulled down, the Lage sheet keeps one line; [E] s6: during
an attack the sheet shows an alert („mission control“). Which line?
sc: [E] s1n / r1b: one colour language for self, friends, guild, enemies and
others; friends get their own colour. Three palettes; the third adds shapes
(red and green are hard to tell apart for many people). Proposal only.
"""
import os

from kit import phone
from playtest_d1 import SYSTEMS, galaxy
from playtest_r1m import bg_stars, header, tabs

W, H = 390, 544


def mapbg():
    return f'<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="left: 0; top: 96px">{galaxy(W, H, tip=False)}</div>'


def line_sheet(inner):
    return ('<div class="k-abs" style="left: 0; right: 0; top: 640px; bottom: 62px; background: #17110d; border-top: 1px solid var(--gold); '
            'border-radius: 16px 16px 0 0; box-shadow: 0 -8px 24px rgb(0 0 0 / 0.6); padding: 6px 12px; z-index: 3">'
            '<div style="width: 40px; height: 4px; border-radius: 2px; background: var(--line); margin: 0 auto 6px"></div>'
            f'<div style="display: flex; gap: 6px; align-items: center; font-size: 13px; white-space: nowrap; overflow: hidden">{inner}</div></div>')


LAGE = '<b style="font: 600 12px var(--head); color: var(--gold-hi); letter-spacing: 0.06em">LAGE ▴</b>'


def s2ra():
    return phone(mapbg() + header() + line_sheet(LAGE + '<span class="m-tag red">ANGRIFF 14:32</span><span class="m-tag gold">LAGER 1 h 40</span><span class="m-tag blue">3 BERICHTE</span>') + tabs())


def s2rb():
    inner = (LAGE + '<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--gold)"></span><b class="m-num">13:42</b>'
             '<span>Psikristall-Steinbruch 16 fertig</span><span class="m-dim" style="margin-left: auto">+4</span>')
    return phone(mapbg() + header() + line_sheet(inner) + tabs())


def s2rc():
    inner = (LAGE + '<span style="color: var(--red)">⚠</span><b style="color: var(--red)">Angriff auf Nox 14:32</b>'
             '<span class="m-dim">noch 1 h 12</span><span class="m-btn" style="margin-left: auto; padding: 2px 8px">Abwehr</span>')
    return phone(mapbg() + header() + line_sheet(inner).replace('border-top: 1px solid var(--gold)', 'border-top: 2px solid var(--red)') + tabs())


# ------------------------------------------------------------------ sc: the colour language
CATS = {  # system: [(position, kind)]
    '1:12': [(3, 'o')], '1:18': [(5, 'o')], '1:21': [(2, 'o')], '1:24': [(5, 'o'), (9, 'f')], '1:26': [(7, 'g'), (12, 'o')],
    '1:27': [(4, 'd'), (8, 'd'), (11, 'd'), (14, 'o')], '1:29': [(6, 'f')], '1:31': [(3, 'e'), (5, 'e'), (9, 'e')],
    '1:35': [(8, 'o'), (10, 'o')], '1:38': [(1, 'o'), (7, 'f')], '1:44': [(4, 'e'), (6, 'g'), (8, 'o')]}
NAMES = {'d': 'du', 'f': 'Freunde', 'g': 'Gilde', 'e': 'Feinde', 'o': 'andere'}
PALETTES = {
    'a': {'d': '#6fb8ff', 'f': '#b48cff', 'g': '#6fe0a8', 'e': '#ee7660', 'o': '#a8997f'},
    'b': {'d': '#f4f0e6', 'f': '#4fd1c5', 'g': '#9be15d', 'e': '#ee7660', 'o': '#8a8a8a'},
    'c': {'d': '#6fb8ff', 'f': '#e070c8', 'g': '#6fe0a8', 'e': '#ee7660', 'o': '#a8997f'},
}
SHAPES = {'d': 'circle', 'f': 'diamond', 'g': 'square', 'e': 'triangle', 'o': 'circle'}


def mark(x, y, col, shape, r=3.4):
    if shape == 'diamond':
        return f'<path d="M {x} {y - r - 1} L {x + r + 1} {y} L {x} {y + r + 1} L {x - r - 1} {y} Z" fill="{col}" stroke="#0f0b08" stroke-width="0.8" />'
    if shape == 'square':
        return f'<rect x="{x - r:.1f}" y="{y - r:.1f}" width="{2 * r:.1f}" height="{2 * r:.1f}" fill="{col}" stroke="#0f0b08" stroke-width="0.8" />'
    if shape == 'triangle':
        return f'<path d="M {x} {y - r - 1.5} L {x + r + 1} {y + r} L {x - r - 1} {y + r} Z" fill="{col}" stroke="#0f0b08" stroke-width="0.8" />'
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{col}" stroke="#0f0b08" stroke-width="0.8" />'


def colour_map(e):
    import math
    pal = PALETTES[e]
    shapes = e == 'c'
    s = [f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}">', bg_stars(160, W, H, 4)]
    for n, (fx, fy, _) in SYSTEMS.items():
        x, y = fx * W, fy * H
        big = n == '1:27'
        s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{6 if big else 4}" fill="#f3d36b" />')
        if big:
            s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="27" fill="none" stroke="{pal["d"]}" stroke-width="1.5" opacity="0.7" />')
        rr = 20 if big else 13
        for pos, k in CATS.get(n, []):
            a = -math.pi / 2 + (pos - 1) * 2 * math.pi / 15
            s.append(mark(round(x + rr * math.cos(a), 1), round(y + rr * math.sin(a), 1), pal[k], SHAPES[k] if shapes else 'circle', 3.6 if big else 3.0))
        s.append(f'<text x="{x + (30 if big else 18):.0f}" y="{y + 4:.0f}" fill="#a8997f" font-size="10.5" font-family="Georgia">{n}</text>')
    s.append('</svg>')
    legend = ''.join(f'<span style="display: inline-flex; gap: 4px; align-items: center"><svg width="12" height="12" viewBox="-6 -6 12 12">{mark(0, 0, pal[k], SHAPES[k] if shapes else "circle", 4)}</svg>{NAMES[k]}</span>'
                     for k in 'dfgeo')
    leg = (f'<div class="k-abs" style="left: 10px; right: 10px; top: 104px; z-index: 2; display: flex; gap: 10px; flex-wrap: wrap; font-size: 12.5px; '
           f'background: rgb(15 11 8 / 0.88); border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px">{legend}</div>')
    from playtest_r1m import sheet
    return phone('<div class="k-stars" style="position: absolute; inset: 0"></div>' + f'<div class="k-abs" style="left: 0; top: 96px">{"".join(s)}</div>' + leg + header() + sheet() + tabs())


SITS = {'s2r': {'a': s2ra, 'b': s2rb, 'c': s2rc}, 'sc': {e: (lambda e=e: colour_map(e)) for e in 'abc'}}


# ------------------------------------------------------------------ sg: several galaxies (owner, s15)
# The admin sets the number of galaxies (Universe.galaxies, src/core/types.ts;
# admin.md: the size of the universe applies live); fleets can fly to another
# galaxy (fleet-actions.ts clamps the target galaxy). Three galaxies here are
# an example; the player lives in galaxy 1, Mira's second world in galaxy 2.
GAL = [('Galaxie 1', 'deine 3 Welten · Gilde · Krieg', True), ('Galaxie 2', 'Mira (Gilde) · Transport unterwegs', False), ('Galaxie 3', 'niemand, den du kennst', False)]


def sga():
    rows = ''.join(f'<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--line);{" background: rgb(212 165 55 / 0.1)" if on else ""}">'
                   f'<div><b style="color: var(--{"gold-hi" if on else "txt"})">{n}</b><br /><span class="m-dim" style="font-size: 12px">{d}</span></div><span>{"✓" if on else "›"}</span></div>'
                   for n, d, on in GAL)
    drop = (f'<div class="k-abs" style="right: 10px; top: 88px; width: 270px; z-index: 5; background: #17110d; border: 1px solid var(--gold); border-radius: 10px; '
            f'box-shadow: 0 10px 30px rgb(0 0 0 / 0.7); overflow: hidden">{rows}</div>')
    return phone(mapbg() + drop + header() + line_sheet(LAGE + '<span class="m-tag red">ANGRIFF 14:32</span><span class="m-tag gold">LAGER 1 h 40</span>') + tabs())


def spiral(cx, cy, r, seed, col='#f3d36b'):
    import math
    import random
    rnd = random.Random(seed)
    out = [f'<circle cx="{cx}" cy="{cy}" r="{r * 0.35:.0f}" fill="#f0a050" opacity="0.18" />']
    for arm in range(2):
        for i in range(40):
            t = i / 40 * 3.2
            a = t + arm * math.pi
            rr = r * t / 3.2
            x, y = cx + rr * math.cos(a) + rnd.uniform(-4, 4), cy + rr * math.sin(a) * 0.7 + rnd.uniform(-4, 4)
            out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rnd.choice([1, 1.3, 1.7])}" fill="{col}" opacity="{rnd.uniform(0.35, 0.9):.2f}" />')
    return ''.join(out)


def sgb():
    svg = [f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}">', bg_stars(120, W, H, 9),
           spiral(120, 150, 80, 1), spiral(285, 300, 70, 2), spiral(130, 440, 60, 3),
           '<path d="M 140 170 Q 240 200 275 290" stroke="#6fe0a8" stroke-width="2.2" stroke-dasharray="6 4" fill="none" />',
           '<circle cx="140" cy="170" r="12" fill="none" stroke="#6fb8ff" stroke-width="2" />']
    labels = [(30, 236, 'Galaxie 1', 'deine 3 Welten', True), (210, 380, 'Galaxie 2', 'Mira · Transport unterwegs', False), (30, 512, 'Galaxie 3', '', False)]
    for x, y, n, d, on in labels:
        svg.append(f'<text x="{x}" y="{y}" fill="{"#f1d27a" if on else "#e9dfc8"}" font-size="13" font-family="Georgia" font-weight="700">{n}</text>')
        if d:
            svg.append(f'<text x="{x}" y="{y + 15}" fill="#a8997f" font-size="11" font-family="Georgia">{d}</text>')
    svg.append('</svg>')
    hint = '<div class="k-abs" style="left: 10px; top: 104px; z-index: 2"><span class="k-pill">Universum › Galaxie › System</span></div>'
    return phone('<div class="k-stars" style="position: absolute; inset: 0"></div>' + f'<div class="k-abs" style="left: 0; top: 96px">{"".join(svg)}</div>' + hint
                 + header() + line_sheet(LAGE + '<span class="m-tag red">ANGRIFF 14:32</span><span class="m-tag gold">LAGER 1 h 40</span>') + tabs())


def sgc():
    pager = ('<div class="k-abs" style="left: 0; right: 0; top: 104px; z-index: 2; display: flex; justify-content: space-between; align-items: center; padding: 0 10px; font-size: 12.5px">'
             '<span class="m-dim">‹ Galaxie 3</span><span style="display: flex; gap: 5px"><b style="color: var(--gold-hi)">Galaxie 1</b> ● ○ ○</span>'
             '<span style="color: #6fe0a8">Galaxie 2 › <span class="m-dim">1 Flotte</span></span></div>')
    edge = ('<div class="k-abs" style="right: 0; top: 300px; width: 8px; height: 120px; z-index: 2; background: linear-gradient(90deg, transparent, rgb(111 224 168 / 0.5)); border-radius: 4px 0 0 4px"></div>')
    return phone(mapbg() + pager + edge + header() + line_sheet(LAGE + '<span class="m-tag red">ANGRIFF 14:32</span><span class="m-tag gold">LAGER 1 h 40</span>') + tabs())


SITS['sg'] = {'a': sga, 'b': sgb, 'c': sgc}


def build_sheet():
    parts = [f'<figure id="r6-{sid}-{e}" style="margin: 0; display: inline-block">{fn()}</figure>' for sid, vs in SITS.items() for e, fn in vs.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest r6</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-wrap: wrap; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'r6-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/r6-sheet.html')
