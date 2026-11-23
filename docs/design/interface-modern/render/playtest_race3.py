"""Playtest round 6 – the races a third time: only the UI elements change.

[E] brut2/ewige2 (owner, 2026-11-23): the race lives in the UI elements –
frames, borders, bars, sheet, pills, tabs – not in effects over the map;
motion only in background and borders, never in the controls. Brut: organic
elements in the borders, veins are good. Ewige: technical frames (in the
spirit of StarCraft II's Protoss, inspiration only, own shapes), bends at
65°, terms solemn and old. The map is the same pip map as for the Imperium.
Terms are proposals. Proposal only.
"""
import math
import os
import random

from playtest_d1 import galaxy

W, H = 390, 780
TOP, SHEET, TABS = 64, 650, 718
T65 = 1 / math.tan(math.radians(65))

BRUT = dict(panel='#1a0c18', panel2='#2a1226', txt='#f0e0e8', dim='#b090a8', acc='#b6e04a', edge='#5a2a3a', plate='#6a3a3a', plate2='#9a5a4a',
            vein='#8a2a4a', vein2='#d04a7a', font="'EB Garamond', Georgia, serif", ls='0.02em',
            tabs=['Brutstätten', 'Nest', 'Schwärme', 'Spuren', 'Mehr'], lage='Witterung', galaxy='Jagdgrund 1 ▾')
EWIGE = dict(panel='#0d141c', panel2='#141e2a', txt='#e6e0d0', dim='#9a927e', acc='#7fe0f0', edge='#b89a5a', edge2='#6a5a3a',
             font="'Cinzel', 'EB Garamond', Georgia, serif", ls='0.12em',
             tabs=['Sternkarte', 'Welten', 'Flotten', 'Chronik', 'Mehr'], lage='Zeitlauf', galaxy='Kreis 1 ▾')


def base_css(p):
    return (f'body {{ margin: 0; background: #050405 }} .r-phone {{ width: {W}px; height: {H}px; position: relative; overflow: hidden; border-radius: 32px; background: #0b0806; '
            f'font-family: {p["font"]}; color: {p["txt"]} }} .r-ui {{ position: absolute; z-index: 3 }} '
            f'.r-pill {{ position: absolute; top: 30px; height: 24px; display: flex; gap: 5px; align-items: center; padding: 0 10px; font-size: 13px; background: {p["panel2"]}; z-index: 5 }} '
            '.r-pill img { width: 15px; height: 15px } '
            f'.r-tab {{ position: absolute; top: {TABS + 20}px; width: 78px; text-align: center; font-size: 11.5px; color: {p["dim"]}; letter-spacing: {p["ls"]}; z-index: 5 }} '
            f'.r-tab.on {{ color: {p["acc"]} }} .r-line {{ position: absolute; left: 22px; right: 22px; top: {SHEET + 22}px; z-index: 5; display: flex; gap: 6px; align-items: center; font-size: 12.5px; white-space: nowrap }}')


def chrome_html(p, pill_style=''):
    res = '/icons/resources/small/'
    pills = ''.join(f'<span class="r-pill" style="left: {x}px; {pill_style}"><img src="{res}{i}.svg" alt="" />{v}</span>' for x, i, v in [(12, 'metal', '184 k'), (100, 'crystal', '92 k'), (184, 'deuterium', '41 k')])
    pills += f'<span class="r-pill" style="right: 12px; {pill_style}">{p["galaxy"]}</span>'
    tabs = ''.join(f'<span class="r-tab{" on" if i == 0 else ""}" style="left: {i * 78}px; font-size: {10 if p is EWIGE else 11.5}px">{t}</span>' for i, t in enumerate(p['tabs']))
    line = (f'<div class="r-line"><b style="color: {p["acc"]}; letter-spacing: {p["ls"]}">{p["lage"]} ▴</b><span style="color: #ff6a5a">⚠ Angriff auf Nox 14:32</span>'
            f'<span style="color: {p["dim"]}">noch 1 h 12</span><span style="margin-left: auto; color: {p["dim"]}">›</span></div>')
    return pills + tabs + line


def panels(p):
    """The three panels (top bar, sheet, tab bar) as plain shapes; the frames are drawn on top."""
    return (f'<div class="r-ui" style="left: 0; right: 0; top: 0; height: {TOP}px; background: {p["panel"]}"></div>'
            f'<div class="r-ui" style="left: 6px; right: 6px; top: {SHEET}px; height: {TABS - SHEET - 6}px; background: {p["panel"]}"></div>'
            f'<div class="r-ui" style="left: 0; right: 0; top: {TABS}px; bottom: 0; background: {p["panel"]}"></div>')


# ------------------------------------------------------------------ Brut frames
def thorns(x1, x2, y, up, n, h, p, seed=1):
    rnd = random.Random(seed)
    out = ''
    step = (x2 - x1) / n
    for i in range(n):
        x = x1 + i * step + rnd.uniform(-3, 3)
        hh = h * rnd.uniform(0.6, 1.2)
        tip = y - hh if up else y + hh
        bend = rnd.uniform(-6, 6)
        out += (f'<path d="M {x:.0f} {y} Q {x + step * 0.3 + bend:.0f} {(y + tip) / 2:.0f} {x + step * 0.45 + bend:.0f} {tip:.0f} Q {x + step * 0.55:.0f} {(y + tip) / 2:.0f} {x + step * 0.9:.0f} {y} Z" '
                f'fill="{p["plate"]}" stroke="{p["plate2"]}" stroke-width="1" />')
    return out


def vein(d, p, i):
    return (f'<path d="{d}" stroke="{p["vein"]}" stroke-width="2.2" fill="none" stroke-linecap="round">'
            f'<animate attributeName="stroke" dur="1.5s" begin="{i * 0.3:.1f}s" values="{p["vein"]};{p["vein2"]};{p["vein"]}" repeatCount="indefinite" />'
            f'<animate attributeName="stroke-width" dur="1.5s" begin="{i * 0.3:.1f}s" values="1.6;3.2;1.6" repeatCount="indefinite" /></path>')


def tendril(x, y, s, flip, p, down=False):
    f = -1 if flip else 1
    v = 1 if down else -1
    return (f'<path d="M {x} {y} c {f * 10 * s:.1f} {v * 4 * s:.1f} {f * 18 * s:.1f} {v * 16 * s:.1f} {f * 10 * s:.1f} {v * 24 * s:.1f} '
            f'c {-f * 6 * s:.1f} {v * 6 * s:.1f} {-f * 14 * s:.1f} 0 {-f * 10 * s:.1f} {-v * 6 * s:.1f} c {f * 3 * s:.1f} {-v * 4 * s:.1f} {f * 8 * s:.1f} {-v * 2 * s:.1f} {f * 7 * s:.1f} {v * 2 * s:.1f}" '
            f'stroke="{p["plate2"]}" stroke-width="{2.2 * s:.1f}" fill="none" stroke-linecap="round" />')


def ridge(x1, x2, y, up, p, n=14):
    step = (x2 - x1) / n
    d = f'M {x1} {y} ' + ' '.join(f'q {step / 2:.1f} {-10 if up else 10} {step:.1f} 0' for _ in range(n))
    return f'<path d="{d}" fill="{p["plate"]}" stroke="{p["plate2"]}" stroke-width="1.2" />'


def brut_frames(kind, p):
    s = [f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none">']
    if kind == 'chitin':
        s.append(thorns(0, W, TOP, False, 16, 14, p, 1) + thorns(6, W - 6, SHEET, True, 15, 16, p, 2) + thorns(0, W, TABS, True, 12, 8, p, 3))
        s.append(vein(f'M 0 {TOP + 1} C 120 {TOP + 6} 260 {TOP - 4} {W} {TOP + 2}', p, 0) + vein(f'M 6 {SHEET + 2} C 140 {SHEET + 8} 250 {SHEET - 2} {W - 6} {SHEET + 3}', p, 1))
    elif kind == 'ranke':
        for x, y, sc, fl in [(14, TOP + 2, 1.3, False), (W - 14, TOP + 2, 1.3, True), (18, SHEET + 2, 1.6, False), (W - 18, SHEET + 2, 1.6, True), (110, SHEET + 1, 0.9, False), (280, SHEET + 1, 0.9, True)]:
            s.append(tendril(x, y, sc, fl, p, down=(y == TOP + 2)))
        s.append(vein(f'M 6 {SHEET + 2} C 100 {SHEET - 3} 290 {SHEET + 6} {W - 6} {SHEET + 1}', p, 0) + vein(f'M 0 {TOP} C 160 {TOP + 5} 230 {TOP - 3} {W} {TOP + 1}', p, 1))
        for x in (12, 100, 184):  # small curls at the pills
            s.append(f'<path d="M {x} 42 q -6 -2 -5 -8 q 2 -4 6 -2" stroke="{p["plate2"]}" stroke-width="1.6" fill="none" />')
    else:  # knochen
        s.append(ridge(0, W, TOP, False, p, 18) + ridge(6, W - 6, SHEET, True, p, 16) + ridge(0, W, TABS, True, p, 20))
        for x, fl in [(6, False), (W - 6, True)]:
            f = -1 if fl else 1
            s.append(f'<path d="M {x} {SHEET + 4} q {f * 4} -26 {f * 22} -34 q {-f * 4} 14 {f * 4} 30 Z" fill="{p["plate2"]}" stroke="{p["plate"]}" />'
                     f'<path d="M {x + f * 22} {SHEET - 30} Q {x + f * 40} {SHEET - 8} {x + f * 60} {SHEET}" stroke="{p["vein"]}" stroke-width="1.2" fill="rgb(138 42 74 / 0.25)" />')
        s.append(vein(f'M 30 {SHEET + 8} L {W - 30} {SHEET + 8}', p, 0))
    s.append('</svg>')
    return ''.join(s)


# ------------------------------------------------------------------ Ewige frames
def frame65(x, y, w, h, cut, col, sw=1.5, inset=0):
    run = cut * T65
    x, y, w, h = x + inset, y + inset, w - 2 * inset, h - 2 * inset
    pts = [(x + run, y), (x + w - run, y), (x + w, y + cut), (x + w, y + h - cut), (x + w - run, y + h), (x + run, y + h), (x, y + h - cut), (x, y + cut)]
    return f'<polygon points="{" ".join(f"{a:.1f},{b:.1f}" for a, b in pts)}" fill="none" stroke="{col}" stroke-width="{sw}" />'


def gem(cx, cy, p, i=0, size=5):
    return (f'<path d="M {cx} {cy - size} L {cx + size * 0.8:.1f} {cy} L {cx} {cy + size} L {cx - size * 0.8:.1f} {cy} Z" fill="{p["acc"]}">'
            f'<animate attributeName="opacity" dur="1.5s" begin="{i * 0.4:.1f}s" values="0.45;1;0.45" repeatCount="indefinite" /></path>')


def ring(cx, cy, r, p):
    ticks = ''.join(f'<line x1="{cx + r * math.cos(a):.1f}" y1="{cy + r * math.sin(a):.1f}" x2="{cx + (r + 3) * math.cos(a):.1f}" y2="{cy + (r + 3) * math.sin(a):.1f}" stroke="{p["edge"]}" stroke-width="1" />'
                    for a in [k * math.pi / 6 for k in range(12)])
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{p["panel"]}" stroke="{p["edge"]}" stroke-width="1.5" />{ticks}'
            f'<line x1="{cx}" y1="{cy}" x2="{cx}" y2="{cy - r + 2}" stroke="{p["acc"]}" stroke-width="1.2" />')


def ewige_frames(kind, p):
    s = [f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none">']
    sheet = (6, SHEET, W - 12, TABS - SHEET - 6)
    if kind == 'bronze':
        s.append(frame65(*sheet, 14, p['edge'], 1.8) + frame65(*sheet, 14, p['edge2'], 1, 4))
        s.append(f'<path d="M 0 {TOP} H {W / 2 - 40} l {10 * T65:.1f} 10 H {W / 2 + 40 - 10 * T65:.1f} l {10 * T65:.1f} -10 H {W}" stroke="{p["edge"]}" stroke-width="1.8" fill="none" />')
        s.append(f'<path d="M 0 {TABS} H {W}" stroke="{p["edge"]}" stroke-width="1.8" />' + gem(W / 2, TOP + 5, p) + gem(W / 2, SHEET, p, 1))
    elif kind == 'ring':
        s.append(frame65(*sheet, 16, p['edge'], 1.8) + frame65(*sheet, 16, p['edge2'], 1, 4))
        s.append(f'<path d="M 0 {TOP} H {W}" stroke="{p["edge"]}" stroke-width="1.8" /><path d="M 0 {TABS} H {W}" stroke="{p["edge"]}" stroke-width="1.8" />')
        s.append(ring(20, SHEET + 2, 11, p) + ring(W - 20, SHEET + 2, 11, p) + ring(W / 2, TOP, 9, p) + gem(W / 2 - 40, TABS, p, 1, 4) + gem(W / 2 + 40, TABS, p, 2, 4))
    else:  # gravur
        s.append(frame65(*sheet, 10, p['edge'], 1))
        s.append(f'<path d="M 0 {TOP} H {W}" stroke="{p["edge"]}" stroke-width="1" /><path d="M 0 {TABS} H {W}" stroke="{p["edge"]}" stroke-width="1" />')
        for x in range(30, W - 20, 36):
            s.append(f'<path d="M {x} {SHEET + 5} l {6 * T65:.1f} 6 h 10 l {6 * T65:.1f} -6" stroke="{p["edge2"]}" stroke-width="0.8" fill="none" />')
        s.append(f'<rect x="{W / 2 - 1}" y="{TABS - 3}" width="2" height="6" fill="{p["acc"]}" opacity="0.7" />')
    s.append('</svg>')
    return ''.join(s)


def ewige_pill_css():
    run = 8 * T65
    return (f'clip-path: polygon({run:.1f}px 0, calc(100% - {run:.1f}px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - {run:.1f}px) 100%, {run:.1f}px 100%, 0 calc(100% - 8px), 0 8px); '
            'border: 0; box-shadow: inset 0 0 0 1px #b89a5a;')


VARIANTS = {'brut': [('a', 'chitin'), ('b', 'ranke'), ('c', 'knochen')], 'ewige': [('a', 'bronze'), ('b', 'ring'), ('c', 'gravur')]}


def page(race, kind):
    p = BRUT if race == 'brut' else EWIGE
    m = f'<div style="position: absolute; left: 0; top: {TOP}px">{galaxy(W, SHEET - TOP, tip=False)}</div>'
    if race == 'brut':
        frames, pill = brut_frames(kind, p), f'border-radius: 12px 9px 13px 8px; border: 1px solid {p["edge"]};'
    else:
        frames, pill = ewige_frames(kind, p), ewige_pill_css() + ' font-size: 11px; padding: 0 9px;'
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Rasse</title>\n<link rel="stylesheet" href="/style.css" />\n'
            f'<style>{base_css(p)}</style>\n</head>\n<body>\n<div class="r-phone" id="ph">{m}{panels(p)}{frames}{chrome_html(p, pill)}</div>\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest', 'race3')
    os.makedirs(out, exist_ok=True)
    for race, vs in VARIANTS.items():
        for letter, kind in vs:
            with open(os.path.join(out, f'{race}-{letter}.html'), 'w', encoding='utf-8') as f:
                f.write(page(race, kind))
    print('wrote race3 pages')
