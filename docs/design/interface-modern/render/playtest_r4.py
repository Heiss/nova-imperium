"""Playtest round 4 – a new colony (Landnahme), then guild, chat, Herold, Börse.

s11: the player owns 3 worlds; the planet limit of a new round is 6 (+2 per
level of Kolonialverwaltung; src/core/colony-limit.ts). The Kolonistenarche
founds a colony on a free position (src/features/colony). Most players
settle their own system [E] (r1). Flight times are examples. Proposal only.
"""
import math
import os

from kit import ball, phone
from playtest_r1m import GUILD, OTHER, OWN, WAR, header, sheet, tabs
from playtest_r1x import pulled

TAKEN27 = {4: ('wasser', 0, 'Nox', OWN), 8: ('normal', 1, 'Aurelia', OWN), 11: ('dschungel', 2, 'Vesper', OWN), 14: ('gas', 0, 'Stiller Hafen', OTHER)}
LIMIT = '<span class="k-pill">Welten 3 von 6</span>'


def orbit_view(sel=None, top=96, h=544):
    """System 1:27 on orbits; free positions as dashed rings, the selected one gold."""
    W = 390
    cx, cy = 18, h / 2
    s = [f'<svg width="{W}" height="{h}" viewBox="0 0 {W} {h}">', f'<circle cx="{cx}" cy="{cy}" r="40" fill="#f3d36b" opacity="0.9" />']
    html = ''
    for p in range(1, 16):
        r = 48 + p * 19
        a = -0.95 + (p - 1) * 0.135
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        s.append(f'<path d="M {cx + r * math.cos(-1.05):.0f} {cy + r * math.sin(-1.05):.0f} A {r} {r} 0 0 1 {cx + r * math.cos(1.05):.0f} {cy + r * math.sin(1.05):.0f}" stroke="#3b2f22" fill="none" />')
        if p in TAKEN27:
            k, n, nm, col = TAKEN27[p]
            sz = 30 if col == OWN else 24
            html += (f'<div class="k-abs" style="left: {x - sz / 2:.0f}px; top: {top + y - sz / 2:.0f}px">{ball(k, n, sz)}</div>'
                     f'<div class="k-abs" style="left: {x + sz / 2 + 3:.0f}px; top: {top + y - 8:.0f}px; font-size: 11px; color: {"#f1d27a" if col == OWN else "#a8997f"}">{p} · {nm}</div>')
        else:
            on = p == sel
            s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{11 if on else 8}" fill="{"rgb(241 210 122 / 0.15)" if on else "none"}" stroke="{"#f1d27a" if on else "#6b5a44"}" '
                     f'stroke-width="{2 if on else 1.2}" stroke-dasharray="3 3" />'
                     f'<text x="{x:.0f}" y="{y + 3:.0f}" text-anchor="middle" font-size="8.5" fill="{"#f1d27a" if on else "#8a7a5c"}" font-family="Georgia">{p}</text>')
    s.append('</svg>')
    return f'<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="left: 0; top: {top}px">{"".join(s)}</div>' + html


def found_btn(where):
    return (f'<div class="m-kv"><span>Kolonistenarche</span><b>1 auf Aurelia</b><span>Flug</span><b>12 min · an 13:32</b><span>danach</span><b>Welten 4 von 6</b></div>'
            f'<span class="m-btn big" style="display: block; margin-top: 8px; text-align: center">Landnahme {where}</span>')


def s11a():
    body = ('<b style="color: var(--gold-hi)">Position 1:27:2 · frei</b> <span class="m-dim" style="font-size: 12px">in deinem System</span>' + found_btn('auf 1:27:2'))
    hint = f'<div class="k-abs" style="left: 10px; top: 104px; z-index: 2; display: flex; gap: 6px"><span class="k-pill">System 1:27 · 11 frei</span>{LIMIT}</div>'
    return phone(orbit_view(sel=2) + hint + header() + pulled(230, body) + tabs())


def s11b():
    # free counts follow the example world (playtest_d1.SYSTEMS): 15 positions minus the occupied ones
    rows = [('1:27', '11 (1, 2, 3, 5, 6, 7, 9, 10, 12, 13, 15)', 'dein System', '12 min', True), ('1:26', '13', 'Mira (Gilde)', '38 min', False),
            ('1:29', '14', '–', '1 h 05', False), ('1:24', '13', '–', '1 h 20', False)]
    out = ''.join(f'<div style="display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; padding: 8px 6px; border-bottom: 1px solid var(--line);{" background: rgb(212 165 55 / 0.08)" if on else ""}">'
                  f'<b style="color: var(--{"gold-hi" if on else "txt"})">System {s}</b><span class="m-dim" style="font-size: 12.5px">{t}</span>'
                  f'<span style="font-size: 12.5px">frei: {f}</span><span class="m-dim" style="font-size: 12px">{who}</span></div>'
                  for s, f, who, t, on in rows)
    inner = ('<div style="position: relative; padding: 100px 10px 0"><div style="display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px">'
             '<b style="font: 800 17px var(--head); color: var(--gold)">Freie Plätze</b><span class="m-dim" style="font-size: 12.5px">nach Flugzeit von Aurelia</span></div>'
             + f'<div style="margin-bottom: 6px">{LIMIT}</div>' + out
             + '<span class="m-btn big" style="display: block; margin-top: 10px; text-align: center">1:27 öffnen und Platz wählen</span></div>')
    return phone('<div class="k-stars" style="position: absolute; inset: 0"></div>' + inner + header() + sheet() + tabs())


def s11c():
    from playtest_d1 import SYSTEMS
    w, h = 390, 544
    s = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}">']
    html = ''
    for n, (fx, fy, occ) in SYSTEMS.items():
        x, y = fx * w, fy * h
        own = n == '1:27'
        s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{5 if own else 3.5}" fill="#f3d36b" />')
        c = 15 - len(occ)
        html += (f'<div class="k-abs" style="left: {x + 6:.0f}px; top: {96 + y - 22:.0f}px; min-width: 22px; padding: 0 5px; height: 18px; border-radius: 9px; text-align: center; '
                 f'font: 700 11px var(--body); line-height: 18px; background: {"#f1d27a" if own else "#2a211a"}; color: {"#120d0a" if own else "#e9dfc8"}; '
                 f'border: 1px solid {"#f1d27a" if own else "#5a4a36"}">{c}</div>'
                 f'<div class="k-abs" style="left: {x + 6:.0f}px; top: {96 + y - 2:.0f}px; font-size: 10.5px; color: #a8997f">{n}</div>')
    s.append('</svg>')
    m = f'<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="left: 0; top: 96px">{"".join(s)}</div>' + html
    chips = (f'<div class="k-abs" style="left: 10px; top: 104px; z-index: 2; display: flex; gap: 6px"><span class="m-chip">Besitz</span><span class="m-chip on">Freie Plätze</span>{LIMIT}</div>')
    return phone(m + chips + header() + sheet() + tabs())


SITS = {'s11': {'a': s11a, 'b': s11b, 'c': s11c}}


def build_sheet():
    parts = [f'<figure id="r4-{sid}-{e}" style="margin: 0; display: inline-block">{fn()}</figure>' for sid, vs in SITS.items() for e, fn in vs.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest r4</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-wrap: wrap; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'r4-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/r4-sheet.html')
