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
