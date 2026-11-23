"""Playtest – the Brut a fifth time: realistic, plastic, prerendered.

[E] brut4 (owner, 2026-11-23): the direction is the fleshy band with veins;
make it more plastic and realistic, 3D allowed; it reacts to nothing, so it
may be prerendered. Here the borders are lit relief: SVG lighting filters
(fractal noise as a height map, diffuse and specular light) give flesh,
wet gloss and raised veins; they would ship as prerendered images.
Only borders and large surfaces; the map is the Imperium's. Proposal only.
"""
import os
import random

from playtest_d1 import galaxy
from playtest_race3 import BRUT, SHEET, TABS, TOP, H, W, base_css, chrome_html, panels

P = dict(BRUT)


def defs(kind, t):
    """Filters for a lit organic surface; t (0..1) animates the pulse."""
    import math
    pulse = 0.5 + 0.5 * math.sin(2 * math.pi * t)
    base = {'fleisch': 0.012, 'chitin': 0.03, 'nass': 0.016}[kind]
    surf = 3.5 + 2.5 * pulse
    return (f'<defs>'
            f'<filter id="flesh" x="-5%" y="-20%" width="110%" height="140%">'
            f'<feTurbulence type="fractalNoise" baseFrequency="{base} {base * 2.2:.3f}" numOctaves="4" seed="7" result="n" />'
            f'<feDiffuseLighting in="n" surfaceScale="{surf:.2f}" lighting-color="#ffffff" result="d"><feDistantLight azimuth="235" elevation="38" /></feDiffuseLighting>'
            f'<feSpecularLighting in="n" surfaceScale="{surf:.2f}" specularConstant="{0.7 if kind == "nass" else 0.28}" specularExponent="{38 if kind == "nass" else 30}" lighting-color="#fff0e0" result="s">'
            f'<feDistantLight azimuth="235" elevation="45" /></feSpecularLighting>'
            f'<feComposite in="d" in2="SourceGraphic" operator="arithmetic" k1="1.5" k2="0" k3="0" k4="0" result="lit0" /><feColorMatrix in="lit0" type="saturate" values="1.6" result="lit" />'
            f'<feComposite in="s" in2="SourceAlpha" operator="in" result="sp" />'
            f'<feMerge><feMergeNode in="lit" /><feMergeNode in="sp" /></feMerge></filter>'
            f'<filter id="vein" x="-10%" y="-50%" width="120%" height="200%">'
            f'<feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="b" />'
            f'<feSpecularLighting in="b" surfaceScale="{3 + 2 * pulse:.1f}" specularConstant="0.55" specularExponent="22" lighting-color="#ff9ab8" result="s"><feDistantLight azimuth="235" elevation="50" /></feSpecularLighting>'
            f'<feComposite in="s" in2="SourceAlpha" operator="in" result="sp" />'
            f'<feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="sp" /></feMerge></filter>'
            f'<filter id="drop" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.7" /></filter>'
            f'</defs>')


def band_path(y_edge, down, w=W, amp=7, seed=1, x0=0):
    """An uneven organic band edge."""
    rnd = random.Random(seed)
    d = f'M {x0} {y_edge}'
    x = x0
    while x < w:
        nx = min(w, x + rnd.uniform(22, 40))
        bulge = rnd.uniform(3, amp) * (1 if down else -1)
        d += f' Q {(x + nx) / 2:.0f} {y_edge + bulge:.0f} {nx:.0f} {y_edge:.0f}'
        x = nx
    return d


def veins(y0, y1, seed, n, x0=10, x1=W - 10):
    rnd = random.Random(seed)
    out = ''
    for i in range(n):
        x = rnd.uniform(x0, x1 - 60)
        y = rnd.uniform(y0, y1)
        d = f'M {x:.0f} {y:.0f}'
        for _ in range(3):
            x += rnd.uniform(30, 60)
            y = min(y1, max(y0, y + rnd.uniform(-5, 5)))
            d += f' T {x:.0f} {y:.0f}'
        w = rnd.uniform(3.6, 5.5)
        out += f'<path d="{d}" stroke="#5a0a22" stroke-width="{w:.1f}" fill="none" stroke-linecap="round" filter="url(#vein)" />'
        out += f'<path d="M {x:.0f} {y:.0f} q 8 {rnd.uniform(-8, 8):.0f} 18 {rnd.uniform(-4, 4):.0f}" stroke="#5a0a22" stroke-width="{w * 0.6:.1f}" fill="none" stroke-linecap="round" filter="url(#vein)" />'
    return out


def frames(kind, t):
    s = [f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none">', defs(kind, t)]
    col = {'fleisch': '#9a3a48', 'chitin': '#7a4a34', 'nass': '#a83a4a'}[kind]
    # top bar: the whole bar is flesh, its lower edge uneven
    top = f'M 0 0 H {W} V {TOP} ' + band_path(TOP, True, seed=1).replace(f'M 0 {TOP}', '').replace('Q', 'Q', 1)
    s.append(f'<g filter="url(#drop)"><path d="M 0 0 H {W} V {TOP - 2} L 0 {TOP - 2} Z" fill="{col}" filter="url(#flesh)" />'
             f'<path d="{band_path(TOP - 4, True, seed=1)} L {W} {TOP - 8} L 0 {TOP - 8} Z" fill="{col}" filter="url(#flesh)" /></g>')
    # sheet: a fleshy band on its upper edge
    s.append(f'<g filter="url(#drop)"><path d="{band_path(SHEET - 8, False, x0=6, w=W - 6, seed=2)} L {W - 6} {SHEET + 10} L 6 {SHEET + 10} Z" fill="{col}" filter="url(#flesh)" /></g>')
    # tab bar: a thin band on its upper edge
    s.append(f'<path d="{band_path(TABS - 3, False, seed=3, amp=4)} L {W} {TABS + 8} L 0 {TABS + 8} Z" fill="{col}" filter="url(#flesh)" />')
    if kind == 'chitin':
        rnd = random.Random(4)
        for x in range(4, W, 26):
            s.append(f'<path d="M {x} {SHEET - 2} q 6 {-14 - rnd.uniform(0, 8):.0f} 18 -3 Z" fill="#9a6a50" filter="url(#flesh)" />')
            s.append(f'<path d="M {x} {TOP - 4} q 6 {12 + rnd.uniform(0, 6):.0f} 18 2 Z" fill="#9a6a50" filter="url(#flesh)" />')
    s.append(veins(8, 24, 5, 4) + veins(SHEET - 6, SHEET + 6, 6, 3) + veins(TABS, TABS + 5, 7, 2))
    if kind == 'nass':
        rnd = random.Random(9)
        for i in range(6):
            x = rnd.uniform(20, W - 20)
            l = 10 + 16 * ((t + i / 6) % 1)
            s.append(f'<path d="M {x - 4:.0f} {TOP} C {x - 4:.0f} {TOP + l * 0.6:.0f} {x - 5:.0f} {TOP + l:.0f} {x:.0f} {TOP + l:.0f} C {x + 5:.0f} {TOP + l:.0f} {x + 4:.0f} {TOP + l * 0.6:.0f} {x + 4:.0f} {TOP} Z" '
                     f'fill="#b8c84a" opacity="0.9" filter="url(#vein)" />')
    s.append('</svg>')
    return ''.join(s)


VARIANTS = [('a', 'fleisch'), ('b', 'chitin'), ('c', 'nass')]


def page(kind, t):
    p = P
    m = f'<div style="position: absolute; left: 0; top: {TOP}px">{galaxy(W, SHEET - TOP, tip=False)}</div>'
    pill = f'border-radius: 12px 9px 13px 8px; border: 1px solid {p["edge"]}; box-shadow: 0 2px 6px rgb(0 0 0 / 0.6);'
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Rasse</title>\n<link rel="stylesheet" href="/style.css" />\n'
            f'<style>{base_css(p)}</style>\n</head>\n<body>\n<div class="r-phone" id="ph">{m}{panels(p)}{frames(kind, t)}{chrome_html(p, pill)}</div>\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest', 'race5')
    os.makedirs(out, exist_ok=True)
    N = 10
    for letter, kind in VARIANTS:
        for i in range(N):
            with open(os.path.join(out, f'brut-{letter}-{i:02d}.html'), 'w', encoding='utf-8') as f:
                f.write(page(kind, i / N))
    print('wrote race5 frames')
