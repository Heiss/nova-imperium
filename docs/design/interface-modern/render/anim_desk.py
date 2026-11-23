"""Animations of the interface „Modern“ on the desktop (owner, 2026-11-23).

The owner asked for four animations on the desktop:
* three race interfaces (Imperium, Brut, Ewige), the same flow of about 20 s
  each: the alert in the Lage line → the Lage sheet → the system window →
  a fleet sent; only the frames and the terms change [E] (gv: race frames the
  same on the desktop);
* one run of about 90 s through the whole loop in the Imperium: „Willkommen
  zurück“, galaxy › system, building, espionage, a Raubzug with a preset,
  the battle in the timeline and as a table, the Herold tab with only a
  preview of the Kriegsbericht, the full Kriegsbericht in a big window with
  full screen [E] (d6), the siege overview and the ground combat (#155).
Every frame is a pure function of the time t; the server below renders a
frame on request, a Playwright script takes the screenshots, ffmpeg makes
MP4 and GIF. Decisions are marked in okf/features/ux-playtest.md; the
ground units are only called „Bataillon“ (the owner's word), all values are
examples, the Kriegsbericht is a sketch (the real one comes from Godot,
#382). Proposal only.

Run: python3 anim_desk.py serve <web root> <port>; then the renderer asks
/host?anim=<name> and /frame?anim=<name>&t=<seconds>.
"""
import math
import random
import re
import sys

from kit import I, ball, g, pill
from playtest_d1 import DH, DW, SYSTEMS, TOPBAR, now_line, row as tl_row
from playtest_d2 import S27, S44, system_win
from playtest_d3 import info_tabs, palette
from playtest_r1 import field_grid
from playtest_r1m import OWN, WAR, bg_stars
from playtest_r3 import kv, loot_debris, report_body, result_head, sides_table, ship_rows
from playtest_r4 import NEWS
from playtest_r5 import hexes
from playtest_r6 import CATS, PALETTES, SHAPES, mark
import playtest_race6 as r6
import playtest_race7 as r7
import playtest_race8 as r8

PAL = PALETTES['c']
LEFT, LEXW = 104, 28                      # world strip on the left, Lexikon tab on the right
MX0, MY0, MX1, MY1 = LEFT, TOPBAR, DW - LEXW, DH
MW, MH = MX1 - MX0, MY1 - MY0
SW, SX = 440, (DW - 440) // 2           # the Lage sheet: fixed width, centred [E] d7
SH_LO, SH_HI = 46, 440                  # its two fixed heights [E] d7
TB = 30                                  # title bar of a window
CAP = 46                                 # caption band under the picture (not part of the interface)


# ------------------------------------------------------------------ time helpers
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(u):
    u = clamp(u)
    return u * u * (3 - 2 * u)


def seg(t, a, b):
    return clamp((t - a) / (b - a)) if b > a else float(t >= a)


def lerp(a, b, u):
    return a + (b - a) * u


def between(t, a, b):
    return a <= t < b


class Path:
    """The mouse: waypoints (arrival time, x, y, click); it rests until it has to leave for the next one."""

    def __init__(self, x, y):
        self.keys = [(0.0, x, y, False)]

    def go(self, t, x, y, click=False, dur=0.7):
        lt, lx, ly, _ = self.keys[-1]
        self.keys.append((max(lt, t - dur), lx, ly, False))
        self.keys.append((t, x, y, click))
        return self

    def at(self, t):
        ks = self.keys
        if t <= ks[0][0]:
            return ks[0][1], ks[0][2]
        for (t0, x0, y0, _), (t1, x1, y1, _) in zip(ks, ks[1:]):
            if t0 <= t <= t1:
                u = ease(seg(t, t0, t1))
                return lerp(x0, x1, u), lerp(y0, y1, u)
        return ks[-1][1], ks[-1][2]

    def html(self, t, wheel=False, hidden=False, drag=''):
        if hidden:
            return ''
        x, y = self.at(t)
        out = ''
        for tc, xc, yc, click in self.keys:
            if click and 0 <= t - tc < 0.45:
                u = (t - tc) / 0.45
                r = 6 + 16 * u
                out += (f'<div class="k-abs" style="left: {xc - r:.1f}px; top: {yc - r:.1f}px; width: {2 * r:.1f}px; height: {2 * r:.1f}px; border-radius: 50%; '
                        f'border: 2px solid rgb(255 244 214 / {0.9 * (1 - u):.2f}); z-index: 40"></div>')
        if drag:
            out += f'<div class="k-abs" style="left: {x - 22:.0f}px; top: {y - 22:.0f}px; z-index: 39; opacity: 0.85">{drag}</div>'
        if wheel:
            out += (f'<svg class="k-abs" style="left: {x + 16:.0f}px; top: {y + 10:.0f}px; z-index: 41" width="22" height="30" viewBox="0 0 22 30">'
                    '<rect x="5" y="6" width="12" height="18" rx="6" fill="#0f0b08" stroke="#fff4d6" stroke-width="1.4" />'
                    '<rect x="10" y="9" width="2" height="5" rx="1" fill="#fff4d6" /><path d="M 11 0 l 4 4 h -8 Z M 11 30 l 4 -4 h -8 Z" fill="#fff4d6" /></svg>')
        out += (f'<svg class="k-abs" style="left: {x - 2:.1f}px; top: {y - 2:.1f}px; z-index: 42" width="22" height="26" viewBox="0 0 22 26">'
                '<path d="M 2 2 L 2 20 L 7 15.5 L 10.5 23 L 13.5 21.6 L 10 14.4 L 16.5 14.4 Z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round" /></svg>')
        return out


# ------------------------------------------------------------------ races: palette and terms
RACES = {
    'imperium': dict(panel='#17110d', panel2='#211812', txt='#e9dfc8', dim='#a8997f', acc='#f1d27a', gold='#d4a537', line='#3b2f22',
                     head='Cinzel, Georgia, serif', body="'EB Garamond', Georgia, serif",
                     areas=['Karte', 'Welten', 'Flotten', 'Berichte', 'Menü ▾'], lage='LAGE', galaxy='Galaxie 1', reports='Berichte',
                     btn='linear-gradient(#e2b54a, #b8862a)', radius='8px', sheet_radius='14px 14px 0 0'),
    'brut': dict(panel='#141012', panel2='#1e161a', txt='#e6dce0', dim='#9a8a90', acc='#b8a8c8', gold='#8a7a98', line='#3a2a30',
                 head="'EB Garamond', Georgia, serif", body="'EB Garamond', Georgia, serif",
                 areas=['Brutstätten', 'Nest', 'Schwärme', 'Spuren', 'Mehr ▾'], lage='WITTERUNG', galaxy='Jagdgrund 1', reports='Spuren',
                 btn='linear-gradient(#a898b8, #77678a)', radius='12px 9px 13px 8px', sheet_radius='16px 11px 0 0'),
    'ewige': dict(panel='#0d141c', panel2='#141e2a', txt='#e6e0d0', dim='#9a927e', acc='#7fe0f0', gold='#b89a5a', line='#2c3a48',
                  head="Cinzel, 'EB Garamond', Georgia, serif", body="'EB Garamond', Georgia, serif",
                  areas=['Sternkarte', 'Welten', 'Flotten', 'Chronik', 'Mehr ▾'], lage='ZEITLAUF', galaxy='Kreis 1', reports='Chronik',
                  btn='linear-gradient(#c8aa6a, #8a6a3a)', radius='0', sheet_radius='0'),
}


def recolour(html, R):
    """The reused bodies were drawn for the Imperium; their fixed colours follow the race."""
    if R is RACES['imperium']:
        return html
    return html.replace('#17110d', R['panel']).replace('#211812', R['panel2']).replace('#f1d27a', R['acc']).replace('#0f0b08', R['panel'])


def css_vars(R):
    return (f'--gold: {R["gold"]}; --gold-hi: {R["acc"]}; --txt: {R["txt"]}; --dim: {R["dim"]}; --line: {R["line"]}; '
            f'--head: {R["head"]}; --body: {R["body"]}; font-family: {R["body"]}; color: {R["txt"]};')


def cut65(c):
    run = c / math.tan(math.radians(65))
    return (f'clip-path: polygon({run:.1f}px 0, calc(100% - {run:.1f}px) 0, 100% {c}px, 100% calc(100% - {c}px), calc(100% - {run:.1f}px) 100%, '
            f'{run:.1f}px 100%, 0 calc(100% - {c}px), 0 {c}px);')


# ------------------------------------------------------------------ races: frames (prerendered relief, see playtest_race6–8)
_ids = [0]


def uniq(svg):
    _ids[0] += 1
    p = f'u{_ids[0]}'
    for i in set(re.findall(r'id="([^"]+)"', svg)):
        svg = svg.replace(f'id="{i}"', f'id="{p}{i}"').replace(f'url(#{i})', f'url(#{p}{i})')
    return svg


def gleam(t, w, phase=0.0):
    """[E] gv: a small gleam runs over the gold now and then (every 4 s, 1.4 s long)."""
    u = (t / 4.0 + phase) % 1.0
    if u > 0.35:
        return None
    return -160 + (u / 0.35) * (w + 320)


def gleam_fill(pos):
    return (f'<linearGradient id="gl" gradientUnits="userSpaceOnUse" x1="{pos - 80:.0f}" y1="0" x2="{pos + 80:.0f}" y2="0">'
            '<stop offset="0" stop-color="#fff6d8" stop-opacity="0" /><stop offset="0.5" stop-color="#fff6d8" stop-opacity="0.85" />'
            '<stop offset="1" stop-color="#fff6d8" stop-opacity="0" /></linearGradient>')


def svg_at(x, y, w, h, inner, z=6):
    return (f'<svg class="k-abs" style="left: {x:.0f}px; top: {y:.0f}px; z-index: {z}; pointer-events: none; overflow: visible" width="{w:.0f}" height="{h:.0f}" '
            f'viewBox="0 0 {w:.0f} {h:.0f}">{inner}</svg>')


def deco_imperium(kind, w, h, t, phase=0.0):
    gold, orn = '#b08a3a', '#d8a840'  # [E] imperium8: plastic gold strips, ornaments more golden
    shapes = []
    if kind == 'bar':      # lower edge of the top bar, drawn over y = 0 (the edge)
        shapes.append(f'<path d="M 0 -5 H {w} V 1 H 0 Z" />')
        box = (0, -8, w, 12)
    elif kind == 'vbar':   # right edge of the world strip
        shapes.append(f'<path d="M -3 0 H 2 V {h} H -3 Z" />')
        box = (-6, 0, 10, h)
    elif kind == 'sheet':  # upper edge of the Lage sheet
        shapes.append(f'<rect x="4" y="-3" width="{w - 8}" height="6" rx="3" />')
        box = (-10, -34, w + 20, 44)
    else:                  # window: a strip under the title bar
        shapes.append(f'<rect x="0" y="{TB - 3}" width="{w}" height="5" rx="2" />')
        box = (-8, -26, w + 16, TB + 34)
    x0, y0, bw, bh = box
    s = [r8.metal_defs(t, '#fff4d8', 0.8, 0.08)]
    s.append(f'<g filter="url(#shade)" fill="{gold}">' + ''.join(p.replace(' />', ' filter="url(#metal)" />') for p in shapes) + '</g>')
    if kind in ('sheet', 'window'):  # pointed arches at the corners and in the middle
        y = 3 if kind == 'sheet' else TB - 1
        hh = 1.0 if kind == 'sheet' else 0.75
        for x, f in [(10, 1), (w - 10, -1)]:
            s.append(f'<g filter="url(#shade)"><path d="M {x} {y} q {f * 2} {-22 * hh:.1f} {f * 18 * hh:.1f} {-28 * hh:.1f} q {-f * 6} {10 * hh:.1f} {-f * 4} {26 * hh:.1f} Z" fill="{orn}" filter="url(#metal)" />'
                     f'<circle cx="{x + f * 14 * hh:.1f}" cy="{y - 16 * hh:.1f}" r="{3 * hh:.1f}" fill="#d4a537" /></g>')
        if kind == 'sheet':
            s.append(f'<g filter="url(#shade)"><path d="M {w / 2 - 22} {y - 2} q 22 -20 44 0 Z" fill="{orn}" filter="url(#metal)" /><circle cx="{w / 2}" cy="{y - 10}" r="3.5" fill="#f1d27a" /></g>')
    pos = gleam(t, w if kind != 'vbar' else h, phase)
    if pos is not None:
        tr = f' transform="rotate(90) translate(0 {-2})"' if kind == 'vbar' else ''
        if kind == 'vbar':
            s.append(f'<defs>{gleam_fill(pos)}</defs><path d="M 0 -2 H {h} V 3 H 0 Z" fill="url(#gl)" style="mix-blend-mode: screen"{tr} />')
        else:
            s.append(f'<defs>{gleam_fill(pos)}</defs><g fill="url(#gl)" style="mix-blend-mode: screen">' + ''.join(shapes) + '</g>')
    return box, uniq(''.join(s))


def deco_brut(kind, w, h, t, seed=1):
    shell = '#3a2232'
    s = [r6.defs(t, 'schleim'), r7.bone_defs()]
    goo = ''
    if kind in ('bar', 'window'):
        y0 = 0 if kind == 'bar' else 2
        s.append(f'<path d="{r6.edge(y0 - 2, True, 0, w, seed=seed)} L {w} {y0 - 8} L 0 {y0 - 8} Z" fill="{shell}" filter="url(#shell)" />')
        s.append(r6.thorn_row(4, w - 4, y0 - 1, True, seed + 3, 9 if kind == 'bar' else 6))
        if kind == 'bar':  # [E] brut7: ribs hang from the top bar
            ribs = [(250, 26, 4), (290, 34, 5), (330, 28, 4), (700, 30, -4), (740, 36, -5), (1010, 28, 4), (1050, 34, 5), (1090, 26, 4)]
            s.append('<g filter="url(#shade)">' + ''.join(r7.rib(x, y0 - 4, hh, lean) for x, hh, lean in ribs) + '</g>')
            goo = (r6.drop(310, y0 + 2, t, 0.1, 30) + r6.drop(720, y0 + 2, t, 0.6, 26) + r6.drop(1070, y0 + 2, t, 0.35, 32)
                   + r6.strand(290, 330, y0 + 22, t, 0.3) + r6.strand(700, 740, y0 + 22, t, 0.7) + r6.strand(1010, 1050, y0 + 22, t, 0.5))
        else:
            goo = r6.drop(w * 0.3, y0 + TB - 2, t, 0.2 + seed * 0.13, 18) + r6.strand(w * 0.62, w * 0.62 + 34, y0 + TB, t, 0.4)
        box = (0, -12, w, 90) if kind == 'bar' else (0, -12, w, TB + 60)
    elif kind == 'vbar':
        band = (f'<path d="{r6.edge(0, True, 0, h, seed=seed + 7)} L {h} -6 L 0 -6 Z" fill="{shell}" filter="url(#shell)" />'
                + r6.thorn_row(10, h - 10, 0, True, seed + 9, 7))
        s.append(f'<g transform="translate(4 0) rotate(90)">{band}</g>')
        box = (-14, 0, 24, h)
    else:  # sheet: [E] brut7 small bone spurs on its upper edge
        s.append(f'<path d="{r6.edge(1, False, 6, w - 6, seed=2)} L {w - 6} 7 L 6 7 Z" fill="{shell}" filter="url(#shell)" />')
        s.append(r6.thorn_row(10, w - 10, 1, False, 5, 11))
        s.append('<g filter="url(#shade)">' + ''.join(r7.spur(x, 1, 12, x > w / 2, True) for x in (30, 120, 220, 320, 410)) + '</g>')
        goo = r6.strand(120, 220, -6, t, 0.5)
        box = (0, -30, w, 60)
    if goo:
        s.append(f'<g filter="url(#goo)" opacity="0.88">{goo}</g>')
    return box, uniq(''.join(s))


def deco_ewige(kind, w, h, t, alert=False):
    bronze = '#5a4a36'  # [E] ewige8: dark bronze, engraved 65° notches, a glowing gem
    gemcol = '#ff6a4a' if alert else '#7fe0f0'  # [E] ewige8: the gem changes colour on events
    T65 = r8.T65
    s = [r8.metal_defs(t, '#fff0d0', 0.7)]
    if kind == 'bar':
        s.append(f'<g filter="url(#shade)"><path d="M 0 -6 H {w / 2 - 46} l {8 * T65:.1f} 8 H {w / 2 + 46 - 8 * T65:.1f} l {8 * T65:.1f} -8 H {w} V -1 H 0 Z" fill="{bronze}" filter="url(#metal)" /></g>')
        for x in range(30, int(w) - 20, 40):
            if abs(x - w / 2) > 60:
                s.append(f'<path d="M {x} -4 l {4 * T65:.1f} 4 h 10 l {4 * T65:.1f} -4" stroke="#2a2218" stroke-width="1" fill="none" />')
        s.append(r8.gem(w / 2, 1, 6, gemcol, t))
        box = (0, -10, w, 22)
    elif kind == 'vbar':
        s.append(f'<path d="M -3 0 H 2 V {h} H -3 Z" fill="{bronze}" filter="url(#metal)" />')
        s.append(r8.gem(0, h / 2, 5, gemcol, t))
        box = (-8, 0, 16, h)
    else:  # sheet and window: the double frame with 65° corners and the gem at the top
        s.append(f'<g filter="url(#shade)" stroke="{bronze}">' + r8.frame65(0, 0, w, h + (40 if kind == 'sheet' else 0), 14, 4.5).replace('fill="none"', 'fill="none" filter="url(#metal)"') + '</g>')
        s.append(f'<g stroke="{bronze}" opacity="0.8">' + r8.frame65(6, 6, w - 12, h - 12 + (40 if kind == 'sheet' else 0), 10, 1.6).replace('fill="none"', 'fill="none" filter="url(#metal)"') + '</g>')
        s.append(r8.gem(w / 2, 0, 5.5, gemcol, t))
        box = (-6, -10, w + 12, h + 20)
    return box, uniq(''.join(s))


def deco(race, kind, x, y, w, h, t, alert=False, z=6, seed=1):
    """A frame drawn over the edge of a surface at (x, y) with size w × h; coordinates relative to that surface."""
    if race == 'imperium':
        (bx, by, bw, bh), inner = deco_imperium(kind, w, h, t, phase=seed * 0.17)
    elif race == 'brut':
        (bx, by, bw, bh), inner = deco_brut(kind, w, h, t, seed)
    else:
        (bx, by, bw, bh), inner = deco_ewige(kind, w, h, t, alert)
    return (f'<svg class="k-abs" style="left: {x + bx:.0f}px; top: {y + by:.0f}px; z-index: {z}; pointer-events: none; overflow: visible" '
            f'width="{bw:.0f}" height="{bh:.0f}" viewBox="{bx:.0f} {by:.0f} {bw:.0f} {bh:.0f}">{inner}</svg>')


# ------------------------------------------------------------------ small icons (drawn, no emoji)
def icon(name, size=14, col='currentColor'):
    p = {'min': '<path d="M 3 11 H 11" />', 'close': '<path d="M 3 3 L 11 11 M 11 3 L 3 11" />',
         'pin': '<path d="M 5 2 H 9 L 8.5 6 L 10.5 8 H 3.5 L 5.5 6 Z M 7 8 V 12.5" />',
         'full': '<path d="M 2 5 V 2 H 5 M 9 2 H 12 V 5 M 12 9 V 12 H 9 M 5 12 H 2 V 9" />',
         'play': '<path d="M 4 2 L 12 7 L 4 12 Z" fill="currentColor" />', 'pause': '<path d="M 4 2 V 12 M 10 2 V 12" stroke-width="2.6" />',
         'warn': '<path d="M 7 1.5 L 13 12.5 H 1 Z M 7 5.5 V 9 M 7 10.5 V 11" />', 'ok': '<path d="M 2.5 7.5 L 5.5 10.5 L 11.5 3.5" />',
         'swords': '<path d="M 2 2 L 12 12 M 12 2 L 2 12 M 2 9 L 5 12 M 12 9 L 9 12" />', 'flag': '<path d="M 3 13 V 1.5 M 3 2 H 11 L 9 5 L 11 8 H 3" />'}[name]
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 14 14" style="vertical-align: -2px; color: {col}" fill="none" stroke="currentColor" '
            f'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{p}</svg>')


# ------------------------------------------------------------------ the map: colours and shapes per group [E] sc
def P(n):
    fx, fy, _ = SYSTEMS[n]
    return MX0 + fx * MW, MY0 + fy * MH


def galaxy_svg(extra='', sel=None):
    s = [f'<svg width="{MW}" height="{MH}" viewBox="0 0 {MW} {MH}">', bg_stars(int(MW * MH / 2600), MW, MH, 7)]
    for n, (fx, fy, _) in SYSTEMS.items():
        x, y = fx * MW, fy * MH
        big = n == '1:27'
        s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{6 if big else 4}" fill="#f3d36b" />')
        if big:
            s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="27" fill="none" stroke="{PAL["d"]}" stroke-width="1.5" opacity="0.7" />')
        if n == sel:
            s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="30" fill="none" stroke="#f1d27a" stroke-width="2" />')
        rr = 20 if big else 13
        for pos, k in CATS.get(n, []):
            a = -math.pi / 2 + (pos - 1) * 2 * math.pi / 15
            s.append(mark(round(x + rr * math.cos(a), 1), round(y + rr * math.sin(a), 1), PAL[k], SHAPES[k], 3.8 if big else 3.2))
        s.append(f'<text x="{x + (32 if big else 20):.0f}" y="{y + 4:.0f}" fill="{"#f1d27a" if big else "#a8997f"}" font-size="{12.5 if big else 11}" font-family="Georgia">'
                 f'{n}{" · deine 3 Welten" if big else ""}</text>')
    s.append(extra + '</svg>')
    return ''.join(s)


def qpoint(p0, p2, bend, u):
    (x1, y1), (x2, y2) = p0, p2
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    cx, cy = mx - (y2 - y1) * bend, my + (x2 - x1) * bend
    return ((1 - u) ** 2 * x1 + 2 * (1 - u) * u * cx + u * u * x2, (1 - u) ** 2 * y1 + 2 * (1 - u) * u * cy + u * u * y2)


def flight(p0, p2, col, u_draw=1.0, label='', bend=0.2, dash='7 5', ship=None, ox=MX0, oy=MY0, label_u=0.5):
    """A route drawn up to u_draw (0..1) in map coordinates; ship = position 0..1 of a small fleet marker."""
    a, b = (p0[0] - ox, p0[1] - oy), (p2[0] - ox, p2[1] - oy)
    pts = [qpoint(a, b, bend, i / 40 * u_draw) for i in range(41)]
    s = f'<polyline points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}" fill="none" stroke="{col}" stroke-width="2.4" stroke-dasharray="{dash}" />'
    if u_draw >= 1:
        s += f'<circle cx="{b[0]:.0f}" cy="{b[1]:.0f}" r="3.5" fill="{col}" />'
    if label and u_draw >= 1:
        lx, ly = qpoint(a, b, bend, label_u)
        w = 7 * len(label) + 14
        s += (f'<rect x="{lx - w / 2:.0f}" y="{ly - 11:.0f}" width="{w}" height="20" rx="10" fill="#0f0b08" stroke="{col}" />'
              f'<text x="{lx:.0f}" y="{ly + 3.5:.0f}" fill="{col}" font-size="12" font-family="Georgia" text-anchor="middle">{label}</text>')
    if ship is not None:
        x, y = qpoint(a, b, bend, ship)
        x2, y2 = qpoint(a, b, bend, min(1, ship + 0.02))
        ang = math.degrees(math.atan2(y2 - y, x2 - x))
        s += f'<path d="M 8 0 L -6 -5 L -3 0 L -6 5 Z" fill="{col}" stroke="#0f0b08" transform="translate({x:.1f} {y:.1f}) rotate({ang:.1f})" />'
    return s


SYS_SUN = (MX0 + 70, MY0 + MH * 0.52)
SYS_POS = {4: ('wasser', 0, 'Nox', 'Angriff 14:32', 'bad', -0.62), 8: ('normal', 1, 'Aurelia', '60 · 20 · 30 Schiffe', 'ok', -0.18),
           11: ('dschungel', 2, 'Vesper', 'Tiefbohrung · 1 h', '', 0.2), 14: ('gas', 0, 'Stiller Hafen', 'Leander · aktiv', '', 0.36)}


def sys_world(p):
    k, n, nm, st, bc, a = SYS_POS[p]
    r = 60 + p * 40
    return SYS_SUN[0] + r * math.cos(a), SYS_SUN[1] + r * math.sin(a)


def system_view(sel=None, building=False):
    """System 1:27 as the map level below the galaxy [E] sg: orbits, the own worlds large, others small."""
    sx, sy = SYS_SUN[0] - MX0, SYS_SUN[1] - MY0
    s = [f'<svg width="{MW}" height="{MH}" viewBox="0 0 {MW} {MH}">', bg_stars(int(MW * MH / 3200), MW, MH, 11),
         f'<circle cx="{sx:.0f}" cy="{sy:.0f}" r="46" fill="#f3d36b" opacity="0.95" /><circle cx="{sx:.0f}" cy="{sy:.0f}" r="70" fill="#f3d36b" opacity="0.12" />']
    for p in range(1, 16):
        r = 60 + p * 40
        s.append(f'<path d="M {sx + r * math.cos(-1.0):.0f} {sy + r * math.sin(-1.0):.0f} A {r} {r} 0 0 1 {sx + r * math.cos(1.0):.0f} {sy + r * math.sin(1.0):.0f}" '
                 f'stroke="#3b2f22" stroke-width="1.2" fill="none" />')
    s.append('</svg>')
    html = ''
    for p, (k, n, nm, st, bc, a) in SYS_POS.items():
        x, y = sys_world(p)
        own = p != 14
        sz = 54 if own else 38
        ring = 'box-shadow: 0 0 0 3px #f1d27a; border-radius: 50%;' if p == sel else ''
        html += (f'<div class="k-abs" style="left: {x - sz / 2:.0f}px; top: {y - sz / 2:.0f}px; {ring}">{ball(k, n, sz)}</div>'
                 f'<div class="k-abs" style="left: {x + sz / 2 + 10:.0f}px; top: {y - 16:.0f}px; font-size: 13px; line-height: 1.35; white-space: nowrap">'
                 f'<b style="color: {"#f1d27a" if own else "#e9dfc8"}">{p} · {nm}</b><br />'
                 + (f'<span class="k-bubble {bc}" style="position: static">{st}</span>' if bc else f'<span class="m-dim">{st}</span>') + '</div>')
    return ''.join(s) + f'<div class="k-abs" style="left: 0; top: 0">{html}</div>'


# ------------------------------------------------------------------ the frame of the interface
def topbar(R, race, t, clock, area=0, alert=False):
    areas = ''.join(f'<span style="display: flex; gap: 6px; align-items: center; color: var(--{"gold-hi" if i == area else "dim"}); '
                    f'{"border-bottom: 2px solid var(--gold); " if i == area else ""}padding: 14px 4px 12px">{g(ic, 18)} {nm}</span>'
                    for i, (ic, nm) in enumerate(zip(['map', 'planet', 'fleet', 'reports', 'menu'], R['areas'])))
    bar = (f'<div class="k-abs" style="left: 0; right: 0; top: 0; height: {TOPBAR}px; display: flex; gap: 8px; align-items: center; padding: 0 14px; '
           f'background: {R["panel"]}; border-bottom: 1px solid var(--line); z-index: 20">'
           f'<b style="font: 800 15px var(--head); color: var(--gold-hi); letter-spacing: 0.06em; margin-right: 8px">NOVA IMPERIUM</b>'
           + pill('metal', '184 k') + pill('crystal', '<span style="color: var(--orange)">92 k</span>') + pill('deuterium', '41 k')
           + f'<div style="display: flex; gap: 18px; margin-left: 18px; font-size: 14px; letter-spacing: 0.02em">{areas}</div>'
           + f'<span style="margin-left: auto; display: flex; gap: 10px; align-items: center"><span class="k-pill">{R["galaxy"]} ▾</span>'
           f'<b class="m-num" style="color: var(--gold-hi); min-width: 44px; text-align: right">{clock}</b></span></div>')
    return recolour(bar, R) + deco(race, 'bar', 0, TOPBAR, DW, 0, t, alert=alert, z=21)


WORLDS = [('wasser', 0, 'Nox', 'red', 'Angriff 14:32', '61 k · 33 k · 12 k'), ('normal', 1, 'Aurelia', 'orange', 'Lager voll 1 h 40', '84 k · 52 k · 18 k'),
          ('dschungel', 2, 'Vesper', 'dim', 'Tiefbohrung 1 h', '39 k · 7 k · 11 k')]


def left_strip(R, race, t, alert_gem=False):
    out = (f'<div class="k-abs" style="left: 0; top: {TOPBAR}px; bottom: 0; width: {LEFT}px; z-index: 12; background: {R["panel"]}; border-right: 1px solid var(--line); padding-top: 10px">'
           + ''.join(f'<div style="text-align: center; margin: 6px 0 14px; font-size: 11px; line-height: 1.3"><div style="display: inline-block; border-radius: 50%; '
                     f'{"box-shadow: 0 0 0 2px var(--red);" if c == "red" else ""}">{ball(k, n, 44)}</div><br /><b>{nm}</b><br />'
                     f'<span style="color: var(--{c})">{st}</span><br /><span class="m-dim">{r}</span></div>' for k, n, nm, c, st, r in WORLDS)
           + '</div>')
    return out + deco(race, 'vbar', LEFT, TOPBAR, 0, DH - TOPBAR, t, alert_gem, z=13, seed=4)


def lexikon_tab(R):
    """[E] gv: the Lexikon is hidden; a narrow vertical tab „Lexikon“ at the right edge slides it out."""
    return (f'<div class="k-abs" style="right: 0; top: {TOPBAR}px; bottom: 0; width: {LEXW}px; z-index: 12; background: {R["panel"]}; border-left: 1px solid var(--line)"></div>'
            f'<div class="k-abs" style="right: 0; top: 300px; width: {LEXW}px; height: 118px; z-index: 13; background: {R["panel2"]}; border: 1px solid var(--gold); border-right: 0; '
            f'border-radius: 8px 0 0 8px; display: grid; place-items: center"><span style="writing-mode: vertical-rl; transform: rotate(180deg); font: 600 12px var(--head); '
            f'letter-spacing: 0.12em; color: var(--gold-hi)">LEXIKON ‹</span></div>')


def map_chips(R):
    """[E] d6: the Börse icon at the top right of the map; [E] d10 the layer „Gilde“; [E] gv the legend minimized to a small hint tab."""
    leg = ''.join(f'<svg width="12" height="12" viewBox="-6 -6 12 12" style="display: block; margin: 3px auto">{mark(0, 0, PAL[k], SHAPES[k], 3.6)}</svg>' for k in 'dfgeo')
    return (f'<div class="k-abs" style="left: {MX1 - 178}px; top: {MY0 + 12}px; z-index: 9; display: flex; gap: 6px">'
            f'<span class="m-chip" style="background: {R["panel"]}">⚖ Börse</span><span class="m-chip" style="background: {R["panel"]}">Gilde</span></div>'
            f'<div class="k-abs" style="left: {MX1 - 24}px; top: {MY0 + 60}px; z-index: 9; width: 24px; padding: 4px 0; background: {R["panel"]}; '
            f'border: 1px solid var(--line); border-right: 0; border-radius: 6px 0 0 6px; text-align: center; font-size: 11px; color: var(--dim)">‹{leg}</div>')


def lage(R, race, t, height, line='', body='', tab='Zeitleiste', alert_gem=False, border=None):
    """[E] d7: centred, fixed width, two fixed heights; the line shows the most urgent item with a hint that it can be clicked."""
    tabs = ['Zeitleiste', 'Funk', 'Herold', R['reports']]
    head = ''.join(f'<span style="flex: 1; text-align: center; padding: 5px 0; border-bottom: 2px solid var(--{"gold" if x == tab else "line"}); '
                   f'color: var(--{"gold-hi" if x == tab else "dim"})">{x}</span>' for x in tabs)
    y = DH - height
    full = height > SH_LO + 20
    inner = (f'<div style="height: {SH_LO - 6}px; display: flex; gap: 8px; align-items: center; font-size: 13px; white-space: nowrap; overflow: hidden">'
             f'<b style="font: 600 12px var(--head); color: var(--gold-hi); letter-spacing: 0.06em">{R["lage"]} {"▾" if full else "▴"}</b>{line}</div>')
    if full:
        inner += f'<div style="display: flex; font-size: 13px; margin-bottom: 8px">{head}</div><div style="position: relative">{body}</div>'
    shape = cut65(12) if race == 'ewige' else f'border-radius: {R["sheet_radius"]};'
    bcol = border or 'var(--gold)'
    zs = 30 if full else 15
    box = (f'<div class="k-abs" style="left: {SX}px; width: {SW}px; top: {y:.0f}px; height: {height:.0f}px; z-index: {zs}; background: {R["panel"]}; '
           f'border: 1px solid {bcol}; border-bottom: 0; {shape} box-shadow: 0 -10px 30px rgb(0 0 0 / 0.7); padding: 4px 16px; overflow: hidden">{inner}</div>')
    return recolour(box, R) + deco(race, 'sheet', SX, y, SW, height, t, alert_gem, z=zs + 1, seed=2)


def window(R, race, t, x, y, w, h, title, body, z=24, grow=1.0, alert_gem=False, seed=3, pinned=False):
    """[E] d1–d5: windows over the map; independent, minimizable and pinnable."""
    if grow <= 0:
        return ''
    sc = 0.92 + 0.08 * ease(grow)
    op = ease(grow)
    shape = cut65(12) if race == 'ewige' else f'border-radius: {R["radius"]};'
    border = 'border: 0;' if race == 'ewige' else f'border: 1px solid var(--{"gold" if race == "imperium" else "line"});'
    ctl = (f'<span style="margin-left: auto; display: flex; gap: 10px; color: var(--dim)">{icon("min")}{icon("pin", 14, "var(--gold-hi)" if pinned else "var(--dim)")}{icon("close")}</span>')
    box = (f'<div class="k-abs" style="left: {x}px; top: {y}px; width: {w}px; height: {h}px; z-index: {z}; opacity: {op:.3f}; transform: scale({sc:.3f}); transform-origin: 50% 40%">'
           f'<div style="position: absolute; inset: 0; background: {R["panel"]}; {border} {shape} box-shadow: 0 12px 34px rgb(0 0 0 / 0.75); overflow: hidden">'
           f'<div style="height: {TB}px; display: flex; align-items: center; gap: 8px; padding: 0 12px; background: {R["panel2"]}; border-bottom: 1px solid var(--line)">'
           f'<span class="m-dim">⠿</span><b style="font: 700 13.5px var(--head); color: var(--gold-hi); white-space: nowrap">{title}</b>{ctl}</div>'
           f'<div style="position: relative; padding: 8px 14px">{recolour(body, R)}</div></div>'
           + deco(race, 'window', 0, 0, w, h, t, alert_gem, z=2, seed=seed) + '</div>')
    return box


def close_xy(x, y, w):
    return x + w - 19, y + TB / 2


def fade(html, op):
    return f'<div style="opacity: {op:.3f}">{html}</div>' if op < 0.999 else html


def toast(text, op, R):
    return (f'<div class="k-abs" style="left: 50%; top: {TOPBAR + 16}px; transform: translateX(-50%); z-index: 30; opacity: {op:.3f}; background: {R["panel2"]}; '
            f'border: 1px solid var(--gold); border-radius: 8px; padding: 8px 14px; font-size: 13.5px; box-shadow: 0 8px 24px rgb(0 0 0 / 0.6)">{text}</div>')


def caption(text, sub=''):
    return (f'<div class="k-abs" style="left: 0; right: 0; top: {DH}px; height: {CAP}px; background: #050404; border-top: 1px solid #2a2018; display: flex; gap: 12px; '
            f'align-items: center; padding: 0 18px; font: 15px Georgia, serif; color: #d9cfb8; z-index: 50"><b style="color: #f1d27a">{text}</b>'
            f'<span style="color: #8a7f6a; font-size: 13.5px">{sub}</span><span style="margin-left: auto; color: #6a604f; font-size: 12px">Proposal · example values</span></div>')


# ------------------------------------------------------------------ the Lage line and timeline entries
def line_alert(extra=''):
    return (f'<span style="color: var(--red)">{icon("warn", 14)} Angriff auf Nox 14:32</span><span class="m-dim">noch 1 h 12</span>{extra}'
            '<span style="margin-left: auto; color: var(--gold-hi)">›</span>')


def line_plain(text, col='txt', ic='', right='›'):
    return (f'<span style="color: var(--{col})">{icon(ic, 14) + " " if ic else ""}{text}</span>'
            f'<span style="margin-left: auto; color: var(--gold-hi)">{right}</span>')


def alert_card(sel=False):
    return (f'<div style="border: 1px solid var(--red); border-radius: 8px; padding: 6px 9px; margin: 4px 0 6px; font-size: 13px; '
            f'background: rgb(238 118 96 / {0.18 if sel else 0.08})"><b style="color: var(--red)">{icon("warn", 13)} Angriff auf Nox 14:32</b> · noch 1 h 12 · Haus Valcor · '
            'Mira hält bis 15:00 <span style="float: right; color: var(--gold-hi)">›</span></div>')


def timeline(extra_future=(), highlight=None, past=None, future=None, now='13:20'):
    past = past or [('03:12', 'Nox verteidigt · Sieg', 'green', ''), ('07:02', '2 Transporte zurück', '', ''), ('12:58', 'gründet Kolonie in 1:44', '', 'Leander')]
    future = list(future or [('13:42', 'Psikristall-Steinbruch 16 fertig', ''), ('14:32', '<b style="color: var(--red)">Angriff Haus Valcor auf Nox</b> · Mira hält', 'red'),
                             ('15:00', 'Psikristall-Lager voll', 'orange')])
    future = sorted(future + list(extra_future), key=lambda r: r[0])
    rows = ''
    for tm, x, c in future:
        r = tl_row(tm, x, c, False)
        if highlight and tm == highlight:
            r = f'<div style="background: rgb(212 165 55 / 0.16); border-radius: 6px; margin: 0 -6px; padding: 0 6px">{r}</div>'
        rows += r
    return ('<div style="margin: 4px 0 0 20px; border-left: 2px solid var(--line); padding-left: 10px">' + ''.join(tl_row(tm, x, c, True, w) for tm, x, c, w in past)
            + now_line().replace('JETZT 13:20', f'JETZT {now}') + rows + '</div>')


# ------------------------------------------------------------------ the three race flows (about 20 s each)
def race_flow(race, t):
    R = RACES[race]
    alert = t >= 2.0
    clock = '13:20'
    cur = Path(980, 250)
    cur.go(3.4, 640, 697, True, 0.9)
    cur.go(4.9, 600, 383, True, 0.8)
    WX, WY, WW, WH = 150, 80, 430, 320
    nox, aur = (WX + 1 + 64.5, WY + 1 + TB + 92.4), (WX + 1 + 119.6, WY + 1 + TB + 112.0)
    cur.go(6.6, *aur, dur=0.9)
    cur.go(7.9, *nox, dur=1.0)
    TX, TY, TW, THh = 610, 80, 380, 300
    btn = (TX + TW / 2, TY + THh - 31)
    cur.go(9.6, *btn, True, 1.0)
    cur.go(11.4, 640, 697, True, 1.0)
    cur.go(15.0, 1000, 170, True, 1.0)
    cx, cy = close_xy(WX, WY, WW)
    cur.go(16.8, cx, cy, True, 1.0)
    cur.go(18.4, 930, 330, dur=1.2)

    sent = t >= 9.6
    out = [f'<div class="k-abs" style="left: {MX0}px; top: {MY0}px">{galaxy_svg()}</div>', map_chips(R)]
    # the Lage sheet
    up = ease(seg(t, 3.4, 3.9)) * (1 - ease(seg(t, 4.9, 5.3))) + ease(seg(t, 11.4, 11.9)) * (1 - ease(seg(t, 15.0, 15.4)))
    h = SH_LO + (SH_HI - SH_LO) * up
    if not alert:
        line = line_plain('13:42 Psikristall-Steinbruch 16 fertig', 'txt')
    else:
        flash = 0.5 + 0.5 * math.cos(min(1.0, (t - 2.0) / 1.2) * math.pi * 3) if t < 3.2 else 0
        line = line_alert(' · <span style="color: var(--green)">Flotte an 13:31 ' + icon('ok', 13) + '</span>' if t >= 10.0 else '')
        if flash:
            line = f'<span style="display: contents; filter: brightness({1 + flash * 0.6:.2f})">{line}</span>'
    body = alert_card(sel=between(t, 4.6, 5.0)) + timeline(extra_future=[('13:31', 'Flotte von Aurelia kommt auf Nox an', 'green')] if sent else [],
                                                         highlight='13:31' if sent else None)
    out.append(lage(R, race, t, h, line, body, alert_gem=alert, border='var(--red)' if alert and h < SH_LO + 2 else None))
    # the system window with the drag
    g1 = seg(t, 5.0, 5.4) * (1 - seg(t, 16.8, 17.2))
    dragging = between(t, 6.8, 7.9)
    route = ''
    if sent:
        u = ease(seg(t, 9.7, 10.4))
        a, b = (aur[0] - WX - 1, aur[1] - WY - 1 - TB), (nox[0] - WX - 1, nox[1] - WY - 1 - TB)
        route = (f'<svg class="k-abs" style="left: 0; top: 0; z-index: 3; overflow: visible" width="{WW}" height="{WH - TB}">'
                 + flight(a, b, '#f1d27a', u, 'an 13:31', 0.35, '5 4', ox=0, oy=0) + '</svg>')
    sw = system_win(WW - 30, WH - TB - 30, S27, drag=8 if dragging else None, drop=4 if between(t, 7.5, 8.4) else None) + route
    out.append(window(R, race, t, WX, WY, WW, WH, 'System 1:27 · deine Welten', sw, 24, g1, alert, seed=3))
    # the target window: [E] d2 drop → a window to pick the action; [E] d5 all in the target window
    g2 = seg(t, 8.0, 8.4) * (1 - seg(t, 9.6, 9.9))
    tb = (actions_rows([('Verlegung', 'die Flotte bleibt auf Nox', True), ('Versorgungsflug', 'Rohstoffe bringen', False)])
          + '<div style="font: 600 11.5px var(--head); letter-spacing: 0.1em; color: var(--gold); margin: 8px 0 2px">VORLAGE</div>'
          + '<div style="border: 1px solid var(--gold); border-radius: 6px; padding: 6px 8px; background: rgb(212 165 55 / 0.1)"><b style="color: var(--gold-hi)">Alles</b> '
          '<span class="m-dim" style="font-size: 12px">60 Abfangjäger · 20 Fregatten · 30 Lastbarken</span></div>'
          + kv([('Ankunft auf Nox', '<span style="color: var(--green)">13:31 · vor dem Angriff ✓</span>')])
          + f'<span class="m-btn big" style="position: absolute; left: 12px; right: 12px; top: {THh - TB - 1 - 50}px; height: 38px; display: grid; place-items: center">Verlegung losschicken</span>')
    out.append(window(R, race, t, TX, TY, TW, THh, 'Aurelia → Nox', tb, 26, g2, alert, seed=5))
    out += [left_strip(R, race, t, alert), lexikon_tab(R), topbar(R, race, t, clock, alert=alert)]
    ghost = ball('normal', 1, 40) if dragging else ''
    out.append(cur.html(t, drag=ghost))
    steps = [(0, 'calm: the Lage line rotates slowly'), (2.0, 'an attack: the most urgent item takes the line'), (3.4, 'click: the sheet comes up with the timeline'),
             (4.9, 'click on the entry: the system window opens'), (6.6, 'drag Aurelia onto Nox'), (8.0, 'the target window: Verlegung with the preset „Alles“'),
             (9.6, 'sent: the line and the timeline show the fleet'), (15.0, 'a click on the map closes the sheet; the window closes')]
    sub = [s for a, s in steps if t >= a][-1]
    name = {'imperium': 'Imperium', 'brut': 'Brut', 'ewige': 'Ewige'}[race]
    out.append(caption(name, sub))
    return ''.join(out)


def actions_rows(rows):
    return ''.join(f'<div style="display: flex; justify-content: space-between; align-items: center; height: 34px; padding: 0 10px; margin: 0 0 6px; '
                   f'border: 1px solid var(--{"gold" if on else "line"}); border-radius: 6px; font-size: 13px;{" background: rgb(212 165 55 / 0.1)" if on else ""}">'
                   f'<b style="color: var(--{"gold-hi" if on else "txt"})">{a}</b><span class="m-dim" style="font-size: 12px">{d}</span></div>' for a, d, on in rows)


# ------------------------------------------------------------------ the Kriegsbericht (a sketch; the real one comes from Godot, #382)
ROUNDS = [  # own Abfangjäger, Fregatten | Varn Abfangjäger, Fregatten, Raketenbatterien, Lichtlanzen (r3: victory after 4 of 6 rounds)
    (60, 20, 24, 6, 40, 12), (56, 20, 14, 5, 30, 10), (51, 19, 6, 3, 18, 6), (48, 18, 1, 1, 7, 2), (46, 18, 0, 0, 0, 0)]
KB_LEN = 72  # 1:12, example


def battle_svg(w, h, pt):
    rnd = random.Random(5)
    rd = min(4, int(pt / 3))       # a round every 3 s of the sketch
    u = (pt % 3) / 3
    a, b = ROUNDS[rd], ROUNDS[min(4, rd + 1)]
    cnt = [round(lerp(x, y, ease(u))) for x, y in zip(a, b)]
    s = [f'<svg width="{w:.0f}" height="{h:.0f}" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" style="display: block">',
         '<defs><radialGradient id="kbp" cx="0.35" cy="0.35"><stop offset="0" stop-color="#c9a06a" /><stop offset="0.7" stop-color="#7a5232" /><stop offset="1" stop-color="#2a1a10" /></radialGradient>'
         '<radialGradient id="kbx"><stop offset="0" stop-color="#fff2c0" /><stop offset="0.4" stop-color="#f0a050" /><stop offset="1" stop-color="#f0a050" stop-opacity="0" /></radialGradient></defs>',
         '<rect width="960" height="540" fill="#07060a" />', bg_stars(260, 960, 540, 3), '<circle cx="1010" cy="300" r="300" fill="url(#kbp)" />']
    drift = pt * 4
    own = [(rnd.uniform(60, 300) + drift, rnd.uniform(60, 480)) for _ in range(40)]
    fr = [(rnd.uniform(40, 200) + drift, rnd.uniform(120, 420)) for _ in range(12)]
    foe = [(rnd.uniform(560, 680), rnd.uniform(80, 460)) for _ in range(14)]
    ffr = [(rnd.uniform(620, 700), rnd.uniform(160, 380)) for _ in range(4)]
    dfn = [(720 + 40 * math.cos(k), 300 + 210 * math.sin(k)) for k in [(-1.1 + i * 0.105) for i in range(22)]]
    n_own, n_fr = round(cnt[0] / 60 * 40), round(cnt[1] / 20 * 12)
    n_foe, n_ffr, n_def = round(cnt[2] / 24 * 14), round(cnt[3] / 6 * 4), round((cnt[4] + cnt[5]) / 52 * 22)
    shots = random.Random(int(pt * 10))
    alive_o, alive_f = own[:n_own] + fr[:n_fr], foe[:n_foe] + ffr[:n_ffr] + dfn[:n_def]
    if alive_f and rd < 4:
        for _ in range(16):
            (x1, y1), (x2, y2) = shots.choice(alive_o), shots.choice(alive_f)
            s.append(f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="#f1d27a" stroke-width="1.4" opacity="{shots.uniform(0.3, 0.9):.2f}" />')
        for _ in range(8):
            (x1, y1), (x2, y2) = shots.choice(alive_f), shots.choice(alive_o)
            s.append(f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="{WAR}" stroke-width="1.2" opacity="{shots.uniform(0.3, 0.8):.2f}" />')
    s += [f'<path d="M {x + 9:.0f} {y:.0f} L {x - 6:.0f} {y - 5:.0f} L {x - 3:.0f} {y:.0f} L {x - 6:.0f} {y + 5:.0f} Z" fill="{OWN}" />' for x, y in own[:n_own]]
    s += [f'<path d="M {x + 16:.0f} {y:.0f} L {x - 10:.0f} {y - 8:.0f} L {x - 5:.0f} {y:.0f} L {x - 10:.0f} {y + 8:.0f} Z" fill="#9fd0ff" />' for x, y in fr[:n_fr]]
    s += [f'<path d="M {x - 9:.0f} {y:.0f} L {x + 6:.0f} {y - 5:.0f} L {x + 3:.0f} {y:.0f} L {x + 6:.0f} {y + 5:.0f} Z" fill="{WAR}" />' for x, y in foe[:n_foe]]
    s += [f'<path d="M {x - 16:.0f} {y:.0f} L {x + 10:.0f} {y - 8:.0f} L {x + 5:.0f} {y:.0f} L {x + 10:.0f} {y + 8:.0f} Z" fill="#ff9a86" />' for x, y in ffr[:n_ffr]]
    s += [f'<rect x="{x - 5:.0f}" y="{y - 5:.0f}" width="10" height="10" fill="#c86a50" stroke="#2a1a10" />' for x, y in dfn[:n_def]]
    for k in range(min(rd + 1, 4) * 6 + int(u * 6)):  # explosions of the units lost so far
        er = random.Random(100 + k)
        t0 = (k // 6) * 3 + (k % 6) * 0.5
        age = pt - t0
        if 0 <= age < 0.8:
            x, y = er.choice(foe + dfn + ffr) if er.random() < 0.8 else er.choice(own)
            r = 6 + 26 * age
            s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="url(#kbx)" opacity="{1 - age / 0.8:.2f}" />')
    s.append('</svg>')
    hud = (f'<div style="position: absolute; left: 14px; top: 12px; font-size: 13px; line-height: 1.5; background: rgb(0 0 0 / 0.45); padding: 6px 10px; border-radius: 6px">'
           f'<b style="color: {OWN}">du</b> · {cnt[0]} Abfangjäger · {cnt[1]} Fregatten</div>'
           f'<div style="position: absolute; right: 14px; top: 12px; font-size: 13px; line-height: 1.5; text-align: right; background: rgb(0 0 0 / 0.45); padding: 6px 10px; border-radius: 6px">'
           f'<b style="color: {WAR}">Varn</b> · {cnt[2]} Abfangjäger · {cnt[3]} Fregatten<br />{cnt[4]} Raketenbatterien · {cnt[5]} Lichtlanzen</div>'
           f'<div style="position: absolute; left: 50%; top: 12px; transform: translateX(-50%); font: 600 13px var(--head); letter-spacing: 0.1em; color: #f1d27a">'
           f'{"RUNDE " + str(rd + 1) + " VON 6" if rd < 4 else "SIEG · 4 VON 6 RUNDEN"}</div>')
    return ''.join(s), hud


def mmss(s):
    return f'{int(s) // 60}:{int(s) % 60:02d}'


def player(R, race, t, x, y, w, h, pt, playing, grow, full_u):
    """[E] d6: the Kriegsbericht plays in a window with a full-screen option like a video player."""
    if grow <= 0:
        return ''
    X, Y = lerp(x, 0, full_u), lerp(y, 0, full_u)
    W, H = lerp(w, DW, full_u), lerp(h, DH, full_u)
    tb = TB * (1 - full_u)
    bar = 46
    svg, hud = battle_svg(W - 2, H - tb - 2, pt)
    prog = clamp(pt / KB_LEN)
    segs = ''.join(f'<span style="position: absolute; left: {k * 3 / KB_LEN * 100:.2f}%; top: -3px; width: 2px; height: 10px; background: #f1d27a"></span>' for k in range(1, 5))
    ctl = (f'<div style="position: absolute; left: 0; right: 0; bottom: 0; height: {bar}px; background: linear-gradient(transparent, rgb(0 0 0 / 0.85)); display: flex; gap: 14px; '
           f'align-items: center; padding: 0 14px; font-size: 13px; color: #e9dfc8">{icon("pause" if playing else "play", 16)}'
           f'<div style="position: relative; flex: 1; height: 4px; background: rgb(255 255 255 / 0.25); border-radius: 2px">'
           f'<i style="position: absolute; left: 0; top: 0; bottom: 0; width: {prog * 100:.1f}%; background: var(--gold-hi); border-radius: 2px"></i>{segs}</div>'
           f'<span class="m-num">{mmss(pt)} / {mmss(KB_LEN)}</span><span class="m-btn" style="padding: 4px 8px">Durchstechen</span>{icon("full", 18)}</div>')
    shape = cut65(12) if race == 'ewige' and full_u < 0.5 else f'border-radius: {R["radius"] if full_u < 0.5 else 0};'
    title = (f'<div style="height: {tb:.1f}px; overflow: hidden; display: flex; align-items: center; gap: 8px; padding: 0 12px; background: {R["panel2"]}; border-bottom: 1px solid var(--line)">'
             f'<span class="m-dim">⠿</span><b style="font: 700 13.5px var(--head); color: var(--gold-hi)">Kriegsbericht · Varn · Imperialer Herold</b>'
             f'<span class="m-dim" style="font-size: 12px">nur für dich und Haus Valcor</span>'
             f'<span style="margin-left: auto; display: flex; gap: 10px; color: var(--dim)">{icon("min")}{icon("pin")}{icon("close")}</span></div>')
    op = ease(grow)
    sc = 0.92 + 0.08 * ease(grow)
    box = (f'<div class="k-abs" style="left: {X:.1f}px; top: {Y:.1f}px; width: {W:.1f}px; height: {H:.1f}px; z-index: {45 if full_u > 0 else 28}; opacity: {op:.3f}; '
           f'transform: scale({sc:.3f}); transform-origin: 50% 50%">'
           f'<div style="position: absolute; inset: 0; background: #000; border: 1px solid var(--gold); {shape} box-shadow: 0 14px 40px rgb(0 0 0 / 0.8); overflow: hidden">'
           f'{title}<div style="position: relative">{svg}{hud}{ctl}</div></div>'
           + (deco(race, 'window', 0, 0, W, H, t, z=2, seed=7) if full_u < 0.05 else '') + '</div>')
    return box


def herold_preview(R):
    """[E] s13/d6 the Herold tab offers the newest Kriegsbericht; owner 2026-11-23: only a preview here, the whole only in the big window."""
    svg, _ = battle_svg(406, 150, 4.6)
    card = (f'<div style="border: 1px solid var(--gold); border-radius: 8px; overflow: hidden; margin: 2px 0 8px">'
            f'<div style="position: relative; height: 150px; overflow: hidden">{svg}'
            '<div style="position: absolute; inset: 0; display: grid; place-items: center"><span style="width: 52px; height: 52px; border-radius: 50%; background: rgb(0 0 0 / 0.6); '
            f'border: 2px solid var(--gold-hi); display: grid; place-items: center; color: var(--gold-hi)">{icon("play", 22)}</span></div>'
            f'<span style="position: absolute; right: 8px; bottom: 8px; background: rgb(0 0 0 / 0.7); padding: 1px 6px; border-radius: 4px; font-size: 12px" class="m-num">{mmss(KB_LEN)}</span></div>'
            '<div style="padding: 6px 9px; font-size: 13px; display: flex; gap: 8px; align-items: center"><div><b style="color: var(--gold-hi)">Kriegsbericht: Varn</b> '
            '<span class="m-dim">· 14:05</span><br /><span class="m-dim" style="font-size: 12px">nur für dich und Haus Valcor</span></div>'
            '<span class="m-btn" style="margin-left: auto">Durchstechen</span></div></div>')
    rows = ''.join(f'<div style="padding: 5px 0; border-bottom: 1px solid var(--line); font-size: 13px"><span class="m-dim" style="font-size: 11.5px">{t}</span><br /><b>{h}</b></div>'
                   for t, h, c in NEWS[:2])
    return card + rows


# ------------------------------------------------------------------ the run through the whole loop (Imperium, about 94 s)
LONG_STEPS = [
    (0.0, '1 · Willkommen zurück', 'what happened, what to do now: in the Lage sheet'),
    (5.0, '2 · Galaxy › system', 'a click on the map closes the sheet; the mouse wheel zooms into system 1:27'),
    (11.0, '3 · Building', 'Aurelia opens as a window; drag the building onto a field, every field shows its yield'),
    (20.4, '4 · Espionage', 'zoom out, system 1:44 as a window, Varn, „Auspex-Erkundung“; the report stays with the world'),
    (33.0, '5 · Raubzug', '„Angreifen“ opens the target window: preset „Raubzug“, ships, cargo, send'),
    (40.0, 'Time skip', '13:24 → 14:05'),
    (43.0, '6 · The battle', 'the Lage line shows the result; the timeline entry opens the report as a table'),
    (52.0, '7 · Herold tab', 'only a preview of the Kriegsbericht in the sheet'),
    (56.5, '8 · Kriegsbericht', 'the whole replay plays only in the big window, with full screen (a sketch; the real one comes from Godot, #382)'),
    (71.0, '9 · Siege', 'your turn: the siege opens with its overview (#155)'),
    (79.0, '10 · Ground combat', 'the board fills the map; plan up to 10 moves for a battalion and send them (units and values are examples)'),
]
KB_START = 57.2


def clock_at(t):
    if t < 28.8:
        return '13:20'
    if t < 30.3:
        return f'13:{20 + round(4 * seg(t, 28.8, 30.3)):02d}'
    if t < 40.0:
        return '13:24'
    if t < 43.0:
        m = 13 * 60 + 24 + round(41 * ease(seg(t, 40.0, 43.0)))
        return f'{m // 60}:{m % 60:02d}'
    return '14:05'


def welcome_body():
    counts = ''.join(f'<span class="m-tag {c}">{t}</span>' for c, t in [('green', '1 SIEG'), ('orange', '1 AUSPEX'), ('blue', '3 BERICHTE'), ('gold', '2 FERTIG')])
    acts = ''.join(f'<div style="border: 1px solid var(--{c}); border-radius: 8px; padding: 7px 9px; margin: 6px 0; font-size: 13px"><b style="color: var(--{c})">{t}</b>'
                   f'<div style="display: flex; justify-content: space-between; align-items: center"><span class="m-dim" style="font-size: 12px">{d}</span><span class="m-btn">{b}</span></div></div>'
                   for c, t, d, b in [('red', 'Nox wird um 14:32 angegriffen', 'Mira hält Nox bis 15:00', 'Abwehr'),
                                      ('orange', 'Psikristall-Lager voll in 1 h 40', 'Reliquiar 1 kostet 1.000 / 500', 'Bauen')])
    return ('<b style="color: var(--gold-hi); font: 700 15px var(--head)">Willkommen zurück</b> <span class="m-dim" style="font-size: 12px">· seit gestern 22:14</span>'
            f'<div style="display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0">{counts}</div>'
            '<div style="font: 600 11.5px var(--head); letter-spacing: 0.1em; color: var(--gold); margin-top: 6px">JETZT TUN</div>' + acts
            + '<div style="font: 600 11.5px var(--head); letter-spacing: 0.1em; color: var(--gold); margin-top: 10px">SEIT 22:14</div>'
            + ''.join(tl_row(tm, x, c, True) for tm, x, c in [('03:12', 'Feindkontakt! Nox verteidigt · Sieg', 'green'), ('04:40', 'Auspex-Aktivität bei Aurelia', 'orange'),
                                                            ('07:02', '2 Lastbarken zurück mit Beute', 'gold')]).replace('margin: 5px 0;', 'margin: 5px 0 5px 18px;'))


def surface_body(t, drag_on, hover, placed, building):
    sel = (1, 3) if hover else (-1, -1)
    grid = field_grid(62, sel=sel, show_eff=drag_on)
    if placed:
        op = 0.55 if not building else 1.0
        tag = ('<span style="position: absolute; left: 50%; bottom: -9px; transform: translateX(-50%); background: #17110d; border: 1px solid var(--gold); border-radius: 8px; '
               'padding: 0 5px; font-size: 10.5px; color: var(--gold-hi); white-space: nowrap">im Bau</span>') if building else ''
        grid += (f'<div class="k-abs" style="left: {3 * 66}px; top: {66}px; width: 62px; height: 62px; border-radius: 6px; border: 2px solid #f1d27a; background: #9a7a2c">'
                 f'<img src="{I}buildings/solar_plant.svg" alt="" style="width: 70%; height: 70%; margin: 15%; opacity: {op}" />{tag}</div>')
    return (f'<div style="display: flex; gap: 10px">{palette(size=46)}<div style="position: relative; width: 392px; height: 392px">{grid}</div></div>'
            '<div class="m-dim" style="font-size: 12px; margin-top: 8px">Ziehe ein Gebäude auf ein Feld oder tippe Gebäude und Feld.</div>')


def varn_actions():
    return ('<div style="display: flex; gap: 10px; align-items: center; height: 28px; font-size: 13px">' + ball('trocken', 1, 26)
            + f'<b style="color: {WAR}">4 · Varn</b><span class="m-dim">Haus Valcor · Krieg · aktiv</span></div>'
            + '<div style="height: 6px"></div>'
            + actions_rows([('Sturmangriff', 'Vorlage „Raubzug“ · an 14:05', False), ('Auspex-Erkundung', '3 Spähschädel · 4 min', True), ('Versorgungsflug', 'Rohstoffe bringen', False)]))


def varn_report(h):
    from playtest_r3 import buttons
    body = report_body(True).replace(buttons(), '')
    return (body + f'<div style="position: absolute; left: 12px; right: 12px; top: {h - TB - 1 - 50}px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px">'
            '<span class="m-btn" style="height: 38px; display: grid; place-items: center; background: var(--red); color: #120d0a">Angreifen</span>'
            '<span class="m-btn" style="height: 38px; display: grid; place-items: center; background: none; color: var(--gold-hi); border: 1px solid var(--gold)">Nochmal spionieren</span></div>')


def attack_body(h):
    from playtest_d4 import presets
    chips = ''.join(f'<span class="m-chip{" on" if i == 0 else ""}">{a}</span>' for i, a in enumerate(['Sturmangriff', 'Auspex-Erkundung', 'Versorgungsflug']))
    p = presets().replace('<span class="m-btn big" style="display: block; margin-top: 8px; text-align: center">Raubzug losschicken</span>', '')
    return (f'<div class="m-chips" style="margin: 2px 0 8px">{chips}</div>' + p
            + f'<span class="m-btn big" style="position: absolute; left: 12px; right: 12px; top: {h - TB - 1 - 50}px; height: 38px; display: grid; place-items: center">Raubzug losschicken</span>')


def battle_report_body(h):
    return (result_head() + sides_table() + loot_debris(btn=False)
            + f'<span class="m-btn" style="position: absolute; left: 12px; right: 12px; top: {h - TB - 1 - 50}px; height: 38px; display: grid; place-items: center">Trümmer bergen</span>')


def siege_body(h):
    def bar(label, pct, col, txt):
        return (f'<div style="margin: 7px 0; font-size: 13px"><div style="display: flex; justify-content: space-between"><span>{label}</span><b style="color: var(--{col})">{txt}</b></div>'
                f'<div class="m-prog" style="height: 6px"><i style="width: {pct}%; background: var(--{col})"></i></div></div>')
    phases = ''.join(f'<span class="m-chip{" on" if i == 2 else ""}">{p}</span>' for i, p in enumerate(['Orbit', 'Landung', 'Bodenkampf', 'Ende']))
    return ('<div style="display: flex; gap: 8px; align-items: baseline"><b style="font: 800 17px var(--head); color: var(--gold)">Belagerung von 1:31:5</b>'
            '<span class="m-dim" style="font-size: 12.5px">Haus Valcor · Tag 1 von 2</span></div>'
            f'<div class="m-chips" style="margin: 6px 0">{phases}</div>'
            '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px">'
            + bar('Nachschub', 40, 'orange', 'reicht noch 9 h') + bar('Schäden an der Infrastruktur', 25, 'red', '3 Gebäudestufen')
            + bar('Deine Truppen', 70, 'c', '3 Bataillone · 19 Leben') + bar('Truppen von 1:31:5', 55, 'red', '16 Leben') + '</div>'
            f'<div style="border: 1px solid var(--gold); border-radius: 8px; overflow: hidden; margin-top: 8px; position: relative; height: 190px">'
            f'<div style="position: absolute; left: -30px; top: -50px; opacity: 0.8">{hexes(660, 300, r=18, path=False)}</div>'
            '<span class="m-btn" style="position: absolute; right: 10px; bottom: 10px; padding: 8px 12px">Zum Bodenkampf · dein Zug 0:42</span></div>'
            f'<span class="m-btn big" style="position: absolute; left: 12px; right: 12px; top: {h - TB - 1 - 50}px; height: 38px; display: grid; place-items: center; '
            'background: none; color: var(--gold-hi); border: 1px solid var(--gold)">Nachschub schicken</span>')


SQ3 = math.sqrt(3)
BR, BOX, BOY = 36, -10, -20


def hexc(q, rr):
    return MX0 + BOX + BR + q * 1.5 * BR, MY0 + BOY + BR + rr * SQ3 * BR + (SQ3 * BR / 2 if q % 2 else 0)


PATH = [(1, 7), (2, 6), (3, 5), (3, 4), (4, 3)]
UNITS = {(1, 7): '1. Bataillon', (2, 8): '2. Bataillon', (1, 5): '3. Bataillon'}


def board(k, selected):
    out = f'<div class="k-abs" style="left: {MX0}px; top: {MY0}px; width: {MW}px; height: {MH}px; background: #0b0806; overflow: hidden">{hexes(MW, MH, r=BR, ox=BOX, oy=BOY, path=False)}</div>'
    pts = [hexc(*p) for p in PATH[:k + 1]]
    s = [f'<svg class="k-abs" style="left: 0; top: 0; z-index: 2" width="{DW}" height="{DH}">']
    if k:
        s.append('<polyline points="' + ' '.join(f'{x:.0f},{y:.0f}' for x, y in pts) + '" fill="none" stroke="#f1d27a" stroke-width="3" stroke-dasharray="7 5" />')
        for i, (x, y) in enumerate(pts[1:], 1):
            s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="10" fill="#17110d" stroke="#f1d27a" /><text x="{x:.0f}" y="{y + 4:.0f}" text-anchor="middle" font-size="11" fill="#f1d27a" font-family="Georgia">{i}</text>')
    if selected:
        x, y = hexc(1, 7)
        s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{BR * 0.8:.0f}" fill="none" stroke="#f1d27a" stroke-width="2.5" />')
    for p, nm in UNITS.items():
        x, y = hexc(*p)
        s.append(f'<text x="{x:.0f}" y="{y + BR * 0.84:.0f}" text-anchor="middle" font-size="10.5" fill="#e9dfc8" font-family="Georgia" stroke="#0b0806" stroke-width="3" paint-order="stroke">{nm}</text>')
    s.append('</svg>')
    pillx = (f'<div class="k-abs" style="left: {MX0 + 14}px; top: {MY0 + 12}px; z-index: 3"><span class="k-pill" style="white-space: nowrap">Bodenkampf · 1:31:5 · Runde 7</span></div>')
    return out + ''.join(s) + pillx


def planner_body(k, selected, sent, h):
    q = ''.join(f'<span style="display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--{"gold" if i <= k else "line"}); '
                f'font-size: 11.5px; color: var(--{"gold-hi" if i <= k else "dim"}); background: {"rgb(212 165 55 / 0.15)" if i <= k else "none"}">{i}</span>' for i in range(1, 11))
    sel = '1. Bataillon · 9 Leben' if selected else '–'
    btn = ('<span class="m-btn big" style="position: absolute; left: 12px; right: 12px; top: {top}px; height: 38px; display: flex; align-items: center; justify-content: center; gap: 6px;{dim}">{txt}</span>'
           .format(top=h - TB - 1 - 50, dim='' if k else ' opacity: 0.45', txt=f'{icon("ok", 15)} {k} Züge abgeschickt' if sent else 'Züge abschicken'))
    return (f'<div style="display: flex; justify-content: space-between; align-items: baseline"><b style="color: var(--gold-hi)">Geplante Züge {k} von 10</b>'
            '<span style="font-size: 12.5px">Dein Zug · <b>0:42</b> + Guthaben <b>2 h</b></span></div>'
            f'<div style="display: flex; gap: 5px; margin: 8px 0">{q}</div>'
            + kv([('Ausgewählt', sel), ('Weg', f'{k} Felder' if k else '–')]) + btn)


def long_frame(t):
    race, R = 'imperium', RACES['imperium']
    out = []
    cur = Path(980, 260)
    # 1 welcome → click on the map closes the sheet
    cur.go(2.6, 560, 470, dur=1.4).go(5.0, 1010, 210, True, 1.2)
    # 2 zoom into 1:27
    p27 = P('1:27')
    cur.go(7.6, *p27, dur=1.2)
    # 3 building
    a8 = sys_world(8)
    cur.go(12.2, *a8, True, 1.2)
    SWX, SWY, SWW, SWH = 124, 64, 520, 500
    pal0, d2 = (SWX + 36, SWY + TB + 30), (SWX + 298, SWY + TB + 104)
    cur.go(14.0, *pal0, dur=1.0).go(15.8, *d2, dur=1.6)
    IWX, IWY, IWW, IWH = 670, 90, 400, 372
    cur.go(18.4, IWX + IWW / 2, IWY + IWH - 31, True, 1.4)
    cur.go(19.8, *close_xy(SWX, SWY, SWW), True, 1.0)
    # 4 espionage
    cur.go(21.0, *p27, dur=0.9)
    p44 = P('1:44')
    cur.go(24.0, *p44, True, 1.4)
    YWX, YWY, YWW, YWH = 760, 64, 440, 300
    varn = (YWX + 1 + 64.5, YWY + 1 + TB + 82.4)
    cur.go(26.2, *varn, True, 1.2)
    cur.go(28.0, YWX + YWW / 2 + 40, YWY + 1 + TB + 6 + 34 + 40 + 17, True, 1.0)
    RWH = 360
    cur.go(31.6, YWX + 300, YWY + 150, dur=1.2)
    att = (YWX + 1 + 12 + (YWW - 34) / 4, YWY + RWH - 31)
    cur.go(34.0, *att, True, 1.4)
    # 5 Raubzug
    AWX, AWY, AWW, AWH = 250, 64, 420, 560
    cur.go(36.2, AWX + 150, AWY + TB + 60, True, 1.2)
    cur.go(38.5, AWX + AWW / 2, AWY + AWH - 31, True, 1.4)
    cur.go(40.5, 960, 420, dur=1.4)
    # 6 the battle
    cur.go(45.0, 640, 697, True, 1.5)
    cur.go(47.5, 600, 421, True, 1.4)   # the entry (checked on a still)
    BWX, BWY, BWW, BWH = 880, 64, 370, 430
    cur.go(50.0, BWX + 180, BWY + 200, dur=1.6)
    # 7 Herold tab
    cur.go(53.0, 691, 338, True, 1.4)
    cur.go(56.5, 640, 433, True, 1.6)
    # 8 the Kriegsbericht
    KX, KY, KW, KH = 150, 62, 980, 600
    cur.go(58.5, 900, 300, dur=1.4)
    cur.go(64.0, KX + KW - 26, KY + KH - 22, True, 1.8)
    cur.go(65.2, 1240, 700, dur=0.9)
    cur.go(68.5, DW - 26, DH - 22, True, 1.2)
    cur.go(70.5, *close_xy(KX, KY, KW), True, 1.4)
    # 9 the siege
    cur.go(73.0, 640, 697, True, 1.6)
    GWX, GWY, GWW, GWH = 330, 64, 620, 480
    zum = (GWX + GWW - 145, GWY + 347)  # checked on a still
    cur.go(79.0, *zum, True, 2.0)
    # 10 ground combat
    PWX, PWY, PWW, PWH = 860, 70, 380, 250
    cur.go(81.5, *hexc(1, 7), True, 1.4)
    for i, p in enumerate(PATH[1:]):
        cur.go(82.6 + i, *hexc(*p), True, 0.6)
    cur.go(87.8, PWX + PWW / 2, PWY + PWH - 31, True, 1.6)
    cur.go(90.0, 980, 420, dur=1.6)

    # --- the map: galaxy, system, board
    zin = ease(seg(t, 8.2, 9.8)) * (1 - ease(seg(t, 20.5, 22.0)))
    sys_on = seg(t, 9.4, 10.4) * (1 - seg(t, 20.5, 21.3))
    gal_op = 1 - seg(t, 9.0, 9.9) * (1 - seg(t, 20.9, 21.8))
    on_board = seg(t, 79.2, 80.0)
    routes = ''
    if between(t, 28.0, 31.0):
        routes += flight(p27, p44, '#f1d27a', ease(seg(t, 28.0, 28.8)), 'Auspex · 4 min', 0.2, '2 4', ship=seg(t, 28.8, 30.3) if t >= 28.8 else None, label_u=0.3)
    if between(t, 38.8, 43.6):
        routes += f'<g opacity="{1 - seg(t, 43.0, 43.6):.2f}">' + flight(p27, p44, '#f1d27a', ease(seg(t, 38.8, 39.6)), 'Raubzug · an 14:05', 0.2,
                                                                       ship=seg(t, 40.0, 43.0) if t >= 40.0 else None, label_u=0.3) + '</g>'
    gal = galaxy_svg(routes, sel='1:44' if between(t, 24.0, 38.6) else None)
    tox, toy = p27[0] - MX0, p27[1] - MY0
    sc = 1 + 5 * zin
    out.append(f'<div class="k-abs" style="left: {MX0}px; top: {MY0}px; width: {MW}px; height: {MH}px; overflow: hidden; background: #070504">'
               f'<div style="position: absolute; inset: 0; transform-origin: {tox:.0f}px {toy:.0f}px; transform: scale({sc:.3f}); opacity: {gal_op:.3f}">{gal}</div></div>')
    if sys_on > 0:
        s2 = 0.55 + 0.45 * ease(sys_on)
        sx, sy = a8[0] - MX0, a8[1] - MY0
        out.append(f'<div class="k-abs" style="left: {MX0}px; top: {MY0}px; width: {MW}px; height: {MH}px; overflow: hidden; z-index: 1; opacity: {ease(sys_on):.3f}">'
                   f'<div style="position: absolute; inset: 0; background: #070504; transform-origin: {sx:.0f}px {sy:.0f}px; transform: scale({s2:.3f})">'
                   f'<div style="position: absolute; left: -{MX0}px; top: -{MY0}px">{system_view(sel=8 if between(t, 11.8, 20.0) else None)}</div></div>'
                   f'<div class="k-abs" style="left: 14px; top: 12px"><span class="k-pill">Galaxie 1 › System 1:27</span></div></div>')
    if on_board > 0:
        k = sum(1 for i in range(4) if t >= 82.6 + i)
        out.append(f'<div class="k-abs" style="left: 0; top: 0; z-index: 2; opacity: {ease(on_board):.3f}">{board(k, t >= 81.5)}</div>')
    if on_board < 1:
        out.append(fade(map_chips(R), 1 - on_board))

    # --- the Lage sheet
    up = (1 - ease(seg(t, 5.0, 5.6))) + ease(seg(t, 45.0, 45.6)) * (1 - ease(seg(t, 56.5, 57.0)))
    h = SH_LO + (SH_HI - SH_LO) * clamp(up)
    if t < 38.6:
        line = line_alert()
    elif t < 43.0:
        line = (f'<span style="color: var(--gold-hi)">{icon("swords", 14)} Raubzug auf Varn · an 14:05</span>'
                f'<span class="m-dim">noch {41 - round(41 * seg(t, 40.0, 43.0))} min</span><span style="margin-left: auto; color: var(--gold-hi)">›</span>')
    elif t < 71.0:
        line = line_plain('Sieg über Varn · Beute 600 k', 'green', 'ok')
    else:
        line = (f'<span style="color: var(--gold-hi)">{icon("flag", 14)} Du bist am Zug · Belagerung 1:31:5</span><span class="m-dim">noch 0:42</span>'
                '<span style="margin-left: auto; color: var(--gold-hi)">›</span>')
    tab = 'Zeitleiste'
    if t < 6.0:
        body = welcome_body()
    elif t < 53.0:
        past = [('12:58', 'gründet Kolonie in 1:44', '', 'Leander'), ('13:24', 'Auspex-Bericht von Varn', '', ''),
                ('14:05', '<b style="color: var(--green)">Sieg über Varn</b> · Beute 600 k', 'green', '')]
        rows = ''.join(tl_row(tm, x, c, True, w) for tm, x, c, w in past[:2])
        hl = tl_row(*past[2][:3], True).replace(' opacity: 0.8', '')
        hl = f'<div style="background: rgb(156 203 118 / {0.24 if between(t, 47.2, 47.6) else 0.12}); border-radius: 6px; margin: 0 -6px; padding: 0 6px">{hl}</div>'
        fut = ''.join(tl_row(tm, x, c, False) for tm, x, c in [('14:32', '<b style="color: var(--red)">Angriff Haus Valcor auf Nox</b> · Mira hält', 'red'),
                                                               ('14:50', 'Raubzug zurück mit Beute', 'gold'), ('15:00', 'Psikristall-Lager voll', 'orange')])
        body = ('<div style="margin: 4px 0 0 20px; border-left: 2px solid var(--line); padding-left: 10px">' + rows + hl
                + now_line().replace('JETZT 13:20', 'JETZT 14:05') + fut + '</div>')
    else:
        tab = 'Herold'
        body = herold_preview(R)
    if between(t, 52.9, 53.3):
        body = f'<div style="opacity: {seg(t, 53.0, 53.3):.2f}">{body}</div>'
    out.append(lage(R, race, t, h, line, body, tab=tab, border='var(--red)' if t < 38.6 and h < SH_LO + 2 else None))

    # --- windows
    # 3 the surface of Aurelia and the info window
    gS = seg(t, 12.2, 12.7) * (1 - seg(t, 19.8, 20.2))
    drag_on = between(t, 14.0, 15.8)
    out.append(window(R, race, t, SWX, SWY, SWW, SWH, 'Aurelia · Oberfläche · 102 / 163 Felder',
                      surface_body(t, drag_on, between(t, 15.2, 16.0), t >= 15.8, t >= 18.4), 24, gS, seed=3))
    gI = seg(t, 15.9, 16.4) * (1 - seg(t, 18.4, 18.8))
    ib = info_tabs(370).replace('<span class="m-btn big" style="display: block; margin-top: 10px; text-align: center">Auf D2 bauen</span>', '')
    ib += f'<span class="m-btn big" style="position: absolute; left: 12px; right: 12px; top: {IWH - TB - 1 - 50}px; height: 38px; display: grid; place-items: center">Auf D2 bauen</span>'
    out.append(window(R, race, t, IWX, IWY, IWW, IWH, 'Sonnenkathedrale', ib, 25, gI, seed=4))
    # 4 system 1:44 → Varn → report
    gY = seg(t, 24.0, 24.5) * (1 - seg(t, 34.0, 34.4))
    if t < 26.4:
        yb, title, yh = system_win(YWW - 30, YWH - TB - 30, S44), 'System 1:44', YWH
    elif t < 30.3:
        yb, title, yh = varn_actions(), 'Varn [1:44:4]', YWH
        if t >= 28.0:
            yb += ('<div style="margin-top: 4px; font-size: 13px; color: var(--gold-hi)">3 Spähschädel unterwegs · '
                   f'Bericht in {4 - round(4 * seg(t, 28.8, 30.3))} min</div>')
    else:
        yb, title, yh = varn_report(RWH), 'Varn [1:44:4] · Bericht 13:24', RWH
    out.append(window(R, race, t, YWX, YWY, YWW, yh, title, yb, 24, gY, seed=6))
    # 5 the target window
    gA = seg(t, 34.0, 34.5) * (1 - seg(t, 38.5, 38.9))
    out.append(window(R, race, t, AWX, AWY, AWW, AWH, 'Varn · Angriff', attack_body(AWH), 26, gA, seed=8))
    # 6 the report as a table
    gB = seg(t, 47.5, 48.0) * (1 - seg(t, 56.5, 56.9))
    out.append(window(R, race, t, BWX, BWY, BWW, BWH, 'Kampf · Varn [1:44:4] · 14:05', battle_report_body(BWH), 24, gB, seed=9))
    # 8 the Kriegsbericht
    gK = seg(t, 56.6, 57.2) * (1 - seg(t, 70.5, 70.9))
    if gK > 0:
        pt = clamp(t - KB_START, 0, 30) * 1.0
        full = ease(seg(t, 64.0, 64.45)) * (1 - ease(seg(t, 68.5, 68.95)))
        out.append(player(R, race, t, KX, KY, KW, KH, pt, True, gK, full))
    # 9 the siege overview
    gG = seg(t, 73.0, 73.5) * (1 - seg(t, 79.0, 79.4))
    out.append(window(R, race, t, GWX, GWY, GWW, GWH, 'Belagerung · 1:31:5', siege_body(GWH), 24, gG, seed=10))
    # 10 the planner: on the desktop a window ([V]: [E] d5 keeps the sheet the same everywhere on the desktop)
    gP = seg(t, 80.0, 80.5)
    k = sum(1 for i in range(4) if t >= 82.6 + i)
    out.append(window(R, race, t, PWX, PWY, PWW, PWH, 'Bodenkampf · Planer', planner_body(k, t >= 81.5, t >= 87.8, PWH), 26, gP, seed=11))
    if t >= 87.9:
        out.append(toast(f'{icon("ok", 15, "var(--green)")} 4 Züge abgeschickt · Belagerung 1:31:5', ease(seg(t, 87.9, 88.3)) * (1 - seg(t, 91.5, 92.0)), R))

    full_now = between(t, 64.2, 68.8)
    out += [left_strip(R, race, t), lexikon_tab(R), topbar(R, race, t, clock_at(t))]
    ghost = f'<img src="{I}buildings/solar_plant.svg" alt="" style="width: 44px; height: 44px" />' if drag_on else ''
    out.append(cur.html(t, wheel=between(t, 8.0, 10.6) or between(t, 20.4, 22.2), hidden=between(t, 65.3, 68.0), drag=ghost))
    # the end
    if t > 92.6:
        out.append(f'<div class="k-abs" style="inset: 0; height: {DH}px; background: #000; opacity: {seg(t, 92.6, 93.6):.3f}; z-index: 60"></div>')
    step = [s for s in LONG_STEPS if t >= s[0]][-1]
    out.append(caption(step[1], step[2]))
    return ''.join(out)


ANIMS = {'imperium': (20.0, lambda t: race_flow('imperium', t), 'imperium'), 'brut': (20.0, lambda t: race_flow('brut', t), 'brut'),
         'ewige': (20.0, lambda t: race_flow('ewige', t), 'ewige'), 'durchlauf': (93.6, long_frame, 'imperium')}


def host(anim):
    race = ANIMS[anim][2]
    R = RACES[race]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Animation</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="/interface-modern/modern.css" />\n<link rel="stylesheet" href="/interface-modern/studies.css" />\n'
            f'<style>body {{ margin: 0; background: #000 }} #shot {{ position: relative; width: {DW}px; height: {DH + CAP}px; overflow: hidden; background: #000 }} '
            f'#stage {{ position: absolute; left: 0; top: 0; width: {DW}px; height: {DH + CAP}px; overflow: hidden; background: #070504; {css_vars(R)} }} '
            f'#stage .m-btn {{ background: {R["btn"]}; border-color: {R["gold"]} }} #stage .k-pill, #stage .m-chip {{ font-family: {R["body"]} }}</style>\n'
            '</head>\n<body>\n<div id="shot"><div id="stage"></div></div>\n</body>\n</html>\n')


def serve(root, port):
    import functools
    from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
    from urllib.parse import parse_qs, urlparse

    class H(SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            u = urlparse(self.path)
            q = parse_qs(u.query)
            if u.path in ('/host', '/frame', '/meta'):
                anim = q['anim'][0]
                if u.path == '/host':
                    data = host(anim)
                elif u.path == '/meta':
                    data = str(ANIMS[anim][0])
                else:
                    data = ANIMS[anim][1](float(q['t'][0]))
                b = data.encode('utf-8')
                self.send_response(200)
                self.send_header('content-type', 'text/html; charset=utf-8')
                self.send_header('content-length', str(len(b)))
                self.end_headers()
                self.wfile.write(b)
                return
            return super().do_GET()

    ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory=root)).serve_forever()


if __name__ == '__main__':
    if sys.argv[1] == 'serve':
        serve(sys.argv[2], int(sys.argv[3]))
