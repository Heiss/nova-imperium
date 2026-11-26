"""Playtest desktop d2 – windows and drag from a world onto a target.

[E] 2026-11-23 (d1): on the desktop the Lage stays a sheet at the bottom
and the areas sit on top; windows come on top of that: system windows,
several at once, with actions on their worlds; dragging a world from a
system window onto a system opens a second window to pick the target and
the action; infos on click, not on hover. The three variants differ in
where the drag ends and where the choice is made. Mission names from the
catalog (missions/*/texts.de.ts). Proposal only.
"""
import math
import os

from kit import ball
from playtest_d1 import DH, DW, TOPBAR, chat, galaxy, stars_bg, topbar, window
from playtest_r1m import GUILD, OTHER, OWN, WAR

S27 = {4: ('wasser', 0, 'Nox', OWN, 'Angriff 14:32', 'bad'), 8: ('normal', 1, 'Aurelia', OWN, '60 · 20 · 30 Schiffe', 'ok'),
       11: ('dschungel', 2, 'Vesper', OWN, '', ''), 14: ('gas', 0, 'Stiller Hafen', OTHER, 'Leander · aktiv', '')}
S44 = {4: ('trocken', 1, 'Varn', WAR, 'Haus Valcor · Krieg · aktiv', 'bad'), 6: ('wueste', 1, 'Kessra Prime', GUILD, 'Gilde · aktiv', 'ok'),
       8: ('gas', 1, 'Tarsis', OTHER, 'aktiv', '')}


def system_win(w, h, pos, drag=None, drop=None):
    """A system window: worlds on their orbits [E]; labels in a column on the right, joined by thin lines, so they never overlap.
    drag marks the world being dragged, drop the world under the cursor."""
    cx, cy = 14, h / 2
    s = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}">', f'<circle cx="{cx}" cy="{cy}" r="28" fill="#f3d36b" opacity="0.9" />']
    html = ''
    occ = sorted(pos)
    for p in range(1, 16):
        r = 26 + p * 9
        s.append(f'<path d="M {cx + r * math.cos(-1.2):.0f} {cy + r * math.sin(-1.2):.0f} A {r} {r} 0 0 1 {cx + r * math.cos(1.2):.0f} {cy + r * math.sin(1.2):.0f}" stroke="#3b2f22" fill="none" />')
    last = -99
    for i, p in enumerate(occ):
        r = 26 + p * 9
        a = -0.9 + i * (1.8 / max(1, len(occ) - 1))
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        k, n, nm, col, st, bc = pos[p]
        sz = 30 if col == OWN else 26
        ly = max(y, last + 34)
        last = ly
        s.append(f'<path d="M {x + sz / 2 + 2:.0f} {y:.0f} L 176 {ly:.0f} L 184 {ly:.0f}" stroke="#5a4a36" fill="none" />')
        ring = ''
        if p == drag:
            ring = 'box-shadow: 0 0 0 3px #f1d27a; border-radius: 50%; opacity: 0.55;'
        if p == drop:
            ring = f'box-shadow: 0 0 0 3px {WAR}, 0 0 18px {WAR}; border-radius: 50%;'
        html += (f'<div class="k-abs" style="left: {x - sz / 2 + 12:.0f}px; top: {y - sz / 2 + 6:.0f}px; {ring}">{ball(k, n, sz)}</div>'
                 f'<div class="k-abs" style="left: 200px; top: {ly - 4:.0f}px; font-size: 12px; line-height: 1.3">'
                 f'<b style="color: {"#f1d27a" if col == OWN else col}">{p} · {nm}</b><br />'
                 + (f'<span class="k-bubble {bc}" style="position: static">{st}</span>' if bc else f'<span class="m-dim">{st}</span>') + '</div>')
    s.append('</svg>')
    return ''.join(s) + html


def ghost(x, y, label):
    return (f'<div class="k-abs" style="left: {x - 17}px; top: {y - 17}px; z-index: 6; opacity: 0.85">{ball("normal", 1, 34)}</div>'
            f'<div class="k-abs" style="left: {x + 20}px; top: {y - 26}px; z-index: 6; background: #17110d; border: 1px solid var(--gold); border-radius: 12px; '
            f'padding: 2px 8px; font-size: 12px; color: var(--gold-hi); white-space: nowrap">{label}</div>'
            f'<div class="k-abs" style="left: {x + 6}px; top: {y + 8}px; z-index: 7; font-size: 20px">🖱</div>')


def line(x1, y1, x2, y2):
    return (f'<svg class="k-abs" style="left: 0; top: 0; z-index: 2; pointer-events: none" width="{DW}" height="{DH}">'
            f'<path d="M {x1} {y1} Q {(x1 + x2) / 2} {min(y1, y2) - 60} {x2} {y2}" stroke="#f1d27a" stroke-width="2.5" stroke-dasharray="7 5" fill="none" /></svg>')


def sheet_line():
    return ('<div class="k-abs" style="left: 50%; transform: translateX(-50%); bottom: 0; width: 780px; height: 46px; background: #17110d; border: 1px solid var(--gold); '
            'border-bottom: 0; border-radius: 14px 14px 0 0; z-index: 4; padding: 6px 16px; display: flex; gap: 8px; align-items: center; font-size: 12.5px">'
            '<b style="font: 600 12px var(--head); color: var(--gold-hi); letter-spacing: 0.06em">LAGE ▴</b>'
            '<span class="m-tag red">ANGRIFF 14:32</span><span class="m-tag gold">LAGER 1 h 40</span><span class="m-tag blue">3 BERICHTE</span></div>')


def actions(rows):
    return ''.join(f'<div style="display: flex; justify-content: space-between; align-items: center; padding: 7px 10px; margin: 4px 0; border: 1px solid var(--{"gold" if on else "line"}); '
                   f'border-radius: 6px; font-size: 13px;{" background: rgb(212 165 55 / 0.1)" if on else ""}"><b style="color: var(--{"gold-hi" if on else "txt"})">{a}</b>'
                   f'<span class="m-dim" style="font-size: 12px">{d}</span></div>' for a, d, on in rows)


VARN_ACTIONS = [('Sturmangriff', 'Vorlage „Raubzug“ · an 14:05', True), ('Auspex-Erkundung', '3 Spähschädel · 4 min', False),
                ('Versorgungsflug', 'Rohstoffe bringen', False)]


def base(map_routes=False):
    return stars_bg() + f'<div class="k-abs" style="left: 0; top: {TOPBAR}px">{galaxy(DW, DH - TOPBAR, tip=False, routes=map_routes)}</div>'


# ------------------------------------------------------------------ a: drop on a system, a target window opens
def va():
    w27 = window(40, TOPBAR + 70, 420, 330, 'System 1:27 · deine Welten', system_win(400, 280, S27, drag=8), 3)
    tgt = ('<div class="m-dim" style="font-size: 12px; margin-bottom: 4px">Von Aurelia · Ziel wählen</div>'
           '<div style="display: grid; grid-template-columns: 30px 1fr; gap: 6px; align-items: center; font-size: 13px">'
           + ''.join(f'{ball(k, n, 26)}<div style="padding: 4px 6px; border-radius: 6px;{" background: rgb(238 118 96 / 0.12); border: 1px solid " + WAR if p == 4 else ""}"><b style="color: {col}">{p} · {nm}</b> <span class="m-dim" style="font-size: 12px">{st}</span></div>'
                     for p, (k, n, nm, col, st, bc) in S44.items())
           + '</div><div class="m-dim" style="font-size: 12px; margin: 8px 0 2px">Aktion für Varn</div>' + actions(VARN_ACTIONS))
    w44 = window(760, TOPBAR + 60, 400, 380, 'Ziel in System 1:44', tgt, 4)
    return base() + w27 + w44 + line(290, 250, 1101, 600) + ghost(1060, 560, 'Aurelia → 1:44') + topbar(0, tabs=True) + sheet_line() + chat()


# ------------------------------------------------------------------ b: two system windows, drop directly on the world
def vb():
    w27 = window(40, TOPBAR + 70, 420, 330, 'System 1:27 · deine Welten', system_win(400, 280, S27, drag=8), 3)
    w44 = window(520, TOPBAR + 110, 420, 330, 'System 1:44', system_win(400, 280, S44, drop=4), 4)
    pop = ('<div class="k-abs" style="left: 960px; top: 200px; z-index: 6; width: 260px; background: #17110d; border: 1px solid var(--gold); border-radius: 8px; '
           'padding: 8px; box-shadow: 0 10px 30px rgb(0 0 0 / 0.7)"><b style="color: var(--gold-hi); font-size: 13px">Aurelia → Varn</b>' + actions(VARN_ACTIONS) + '</div>')
    return base() + w27 + w44 + line(290, 250, 595, 300) + ghost(599, 298, 'Aurelia') + pop + topbar(0, tabs=True) + sheet_line() + chat()


# ------------------------------------------------------------------ c: drop on a system, the choice opens in the Lage sheet
def vc():
    w27 = window(40, TOPBAR + 70, 420, 330, 'System 1:27 · deine Welten', system_win(400, 280, S27, drag=8), 3)
    cols = ''.join(f'<div style="border: 1px solid var(--{"red" if p == 4 else "line"}); border-radius: 8px; padding: 6px 8px; display: flex; gap: 8px; align-items: center;'
                   f'{" background: rgb(238 118 96 / 0.1)" if p == 4 else ""}">{ball(k, n, 26)}<div style="font-size: 12.5px"><b style="color: {col}">{nm}</b><br /><span class="m-dim">{st}</span></div></div>'
                   for p, (k, n, nm, col, st, bc) in S44.items())
    sh = ('<div class="k-abs" style="left: 40px; bottom: 0; width: 900px; height: 250px; background: #17110d; border: 1px solid var(--gold); '
          'border-bottom: 0; border-radius: 16px 16px 0 0; box-shadow: 0 -10px 30px rgb(0 0 0 / 0.7); z-index: 4; padding: 6px 16px">'
          '<div style="width: 46px; height: 4px; border-radius: 2px; background: var(--line); margin: 0 auto 6px"></div>'
          '<b style="color: var(--gold-hi)">Von Aurelia nach System 1:44</b> <span class="m-dim" style="font-size: 12px">· Ziel und Aktion</span>'
          f'<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 8px 0">{cols}</div>'
          '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px">' + actions(VARN_ACTIONS).replace('margin: 4px 0', 'margin: 0') + '</div></div>')
    return base() + w27 + line(290, 250, 1101, 600) + ghost(1060, 560, 'Aurelia → 1:44') + topbar(0, tabs=True) + sh + chat()


SITS = {'d2': {'a': va, 'b': vb, 'c': vc}}


def build_sheet():
    parts = [f'<figure id="d2-{sid}-{e}" style="margin: 0"><div class="k-desk">{fn()}</div></figure>' for sid, vs in SITS.items() for e, fn in vs.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest d2</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-direction: column; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'd2-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/d2-sheet.html')
