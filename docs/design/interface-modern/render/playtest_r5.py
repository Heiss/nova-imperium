"""Playtest round 5 – ground combat / siege (#155, idea).

Words from #155 („Game interface (German)“, all [V] there): „Belagerung“,
„Nachschub“, „Schäden an der Infrastruktur“, „Bodenkampf“, „Geplante Züge
(x von 10)“, „Dein Zug · Zeit + Guthaben“, „Züge abschicken“. [E] in #155: up
to 10 moves ahead, at most 1 h between moves, a siege at most 2 days. Field
names (Bunker, Ruine, Krater) are proposals of the brainstorm. The rules are
open; only the interface is tested. Values are examples. Proposal only.
"""
import math
import os

from kit import phone
from playtest_r1m import OWN, WAR, header, sheet, tabs
from playtest_r1x import pulled

SQ3 = math.sqrt(3)


def hexes(w, h, r=24, ox=0, oy=0, path=True):
    """A generated hex field: terrain, own units (blue), enemy units (red), the planned path."""
    terrain = {(3, 2): ('#5a4a36', 'Ruine'), (4, 2): ('#5a4a36', ''), (6, 5): ('#3b2f22', 'Krater'), (2, 6): ('#26384a', 'Landezone'), (7, 2): ('#7a5a2a', 'Bunker')}
    own = {(1, 7): 9, (2, 8): 6, (1, 5): 4}
    foe = {(7, 2): 8, (6, 3): 5, (8, 4): 3}
    s = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}">']
    cols, rows = int(w / (1.5 * r)) + 2, int(h / (SQ3 * r)) + 2
    centre = {}
    for q in range(cols):
        for rr in range(rows):
            x = ox + r + q * 1.5 * r
            y = oy + r + rr * SQ3 * r + (SQ3 * r / 2 if q % 2 else 0)
            centre[(q, rr)] = (x, y)
            pts = ' '.join(f'{x + r * math.cos(math.pi / 3 * i):.1f},{y + r * math.sin(math.pi / 3 * i):.1f}' for i in range(6))
            fill, label = terrain.get((q, rr), ('#1c1510', ''))
            s.append(f'<polygon points="{pts}" fill="{fill}" stroke="#3b2f22" stroke-width="1" />')
            if label:
                s.append(f'<text x="{x:.0f}" y="{y + r * 0.62:.0f}" text-anchor="middle" font-size="8.5" fill="#d9c9a8" font-family="Georgia">{label}</text>')
    if path:
        pts = [centre[p] for p in [(1, 7), (2, 6), (3, 5), (3, 4), (4, 3)]]
        s.append('<polyline points="' + ' '.join(f'{x:.0f},{y:.0f}' for x, y in pts) + '" fill="none" stroke="#f1d27a" stroke-width="3" stroke-dasharray="6 4" />')
        for i, (x, y) in enumerate(pts[1:], 1):
            s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="8" fill="#17110d" stroke="#f1d27a" /><text x="{x:.0f}" y="{y + 3:.0f}" text-anchor="middle" font-size="9" fill="#f1d27a">{i}</text>')
    for units, col in [(own, OWN), (foe, WAR)]:
        for p, hp in units.items():
            x, y = centre[p]
            s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r * 0.55:.0f}" fill="{col}" stroke="#0f0b08" stroke-width="2" />'
                     f'<text x="{x:.0f}" y="{y + 4:.0f}" text-anchor="middle" font-size="11" font-weight="700" fill="#0f0b08">{hp}</text>')
    x, y = centre[(1, 7)]
    s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r * 0.8:.0f}" fill="none" stroke="#f1d27a" stroke-width="2.5" />')
    s.append('</svg>')
    return ''.join(s)


def planner(compact=False):
    q = ''.join(f'<span style="display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--{"gold" if i <= 4 else "line"}); '
                f'font-size: 11px; color: var(--{"gold-hi" if i <= 4 else "dim"})">{i}</span>' for i in range(1, 11))
    out = ('<div style="display: flex; justify-content: space-between; align-items: baseline"><b style="color: var(--gold-hi)">Geplante Züge 4 von 10</b>'
           '<span style="font-size: 12.5px">Dein Zug · <b>0:42</b> + Guthaben <b>2 h</b></span></div>'
           f'<div style="display: flex; gap: 4px; margin: 6px 0">{q}</div>')
    if not compact:
        out += '<div class="m-kv"><span>Ausgewählt</span><b>Sturmtrupp · 9 Leben</b><span>Weg</span><b>4 Felder → Ruine</b></div>'
    return out + '<span class="m-btn big" style="display: block; margin-top: 6px; text-align: center">Züge abschicken</span>'


# ------------------------------------------------------------------ a: the board fills the screen, the planner in the sheet
def s16a():
    b = (f'<div class="k-abs" style="left: 0; top: 96px">{hexes(390, 470)}</div>'
         '<div class="k-abs" style="left: 10px; top: 104px; z-index: 2"><span class="k-pill">Bodenkampf · Varn · Runde 7</span></div>')
    return phone('<div style="position: absolute; inset: 0; background: #0b0806"></div>' + b + header() + pulled(250, planner()) + tabs())


# ------------------------------------------------------------------ b: the siege overview first, the board behind a button
def s16b():
    def bar(label, pct, col, txt):
        return (f'<div style="margin: 6px 0; font-size: 13px"><div style="display: flex; justify-content: space-between"><span>{label}</span><b style="color: var(--{col})">{txt}</b></div>'
                f'<div class="m-prog" style="height: 6px"><i style="width: {pct}%; background: var(--{col})"></i></div></div>')
    phases = ''.join(f'<span class="m-chip{" on" if i == 2 else ""}">{p}</span>' for i, p in enumerate(['Orbit', 'Landung', 'Bodenkampf', 'Ende']))
    inner = ('<div style="position: relative; padding: 100px 10px 0"><div style="display: flex; gap: 8px; align-items: baseline">'
             '<b style="font: 800 17px var(--head); color: var(--gold)">Belagerung von Varn</b><span class="m-dim" style="font-size: 12.5px">Tag 1 von 2</span></div>'
             f'<div class="m-chips" style="margin: 6px 0">{phases}</div>'
             + bar('Nachschub', 40, 'orange', 'reicht noch 9 h') + bar('Schäden an der Infrastruktur', 25, 'red', '3 Gebäudestufen')
             + bar('Deine Truppen', 70, 'c', '19 Leben') + bar('Truppen von Varn', 55, 'red', '16 Leben')
             + '<div style="border: 1px solid var(--gold); border-radius: 8px; overflow: hidden; margin-top: 8px; position: relative; height: 150px">'
             f'<div style="position: absolute; left: -40px; top: -60px; opacity: 0.8">{hexes(420, 260, r=18, path=False)}</div>'
             '<span class="m-btn" style="position: absolute; right: 8px; bottom: 8px">Zum Bodenkampf · dein Zug 0:42</span></div>'
             '<span class="m-btn big" style="display: block; margin-top: 8px; text-align: center; background: none; color: var(--gold-hi); border: 1px solid var(--gold)">Nachschub schicken</span></div>')
    return phone('<div class="k-stars" style="position: absolute; inset: 0"></div>' + inner + header() + sheet() + tabs())


# ------------------------------------------------------------------ c: the turn comes as an entry of the Lage; the sheet plans
def s16c():
    b = f'<div class="k-abs" style="left: 0; top: 96px">{hexes(390, 300)}</div>'
    body = ('<div style="display: flex; gap: 8px; align-items: center; font-size: 13px; margin-bottom: 6px">'
            '<span style="width: 9px; height: 9px; border-radius: 50%; background: var(--gold)"></span><b>13:20</b>'
            '<span><b style="color: var(--gold-hi)">Du bist am Zug</b> · Belagerung Varn · Nachschub 9 h</span></div>' + planner(compact=True)
            + '<div class="m-dim" style="font-size: 12px; margin-top: 6px">Weiter in der Zeitleiste: 14:32 Angriff auf Nox …</div>')
    return phone('<div style="position: absolute; inset: 0; background: #0b0806"></div>' + b + header() + pulled(320, body) + tabs())


SITS = {'s16': {'a': s16a, 'b': s16b, 'c': s16c}}


def build_sheet():
    parts = [f'<figure id="r5-{sid}-{e}" style="margin: 0; display: inline-block">{fn()}</figure>' for sid, vs in SITS.items() for e, fn in vs.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest r5</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-wrap: wrap; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'r5-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/r5-sheet.html')
