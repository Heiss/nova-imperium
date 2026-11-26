"""Playtest – the Brut a fourth time: more organic, more goo.

[E] brut3 (owner, 2026-11-23): chitin thorns on the edges of the large
surfaces (top bar, sheet, tab bar) with veins; more organic, clearly
visible veins of creature-like beings, „ein wenig mehr Schmodder“; only
borders and large surfaces, never buttons or pills; motion only there.
The map is the Imperium's. Own shapes; inspiration only. Proposal only.
"""
import os
import random

from playtest_d1 import galaxy
from playtest_race3 import BRUT, SHEET, TABS, TOP, H, W, base_css, chrome_html, panels, thorns

P = dict(BRUT, goo='#a8c83a', goo2='#d8f06a', flesh='#5a1a2a', flesh2='#7a2a3a')


def vein(d, p, i, w=2.4):
    """A raised vein: a dark outline and a pulsing inner line."""
    return (f'<path d="{d}" stroke="#2a0a14" stroke-width="{w + 2.4:.1f}" fill="none" stroke-linecap="round" opacity="0.9" />'
            f'<path d="{d}" stroke="{p["vein"]}" stroke-width="{w}" fill="none" stroke-linecap="round">'
            f'<animate attributeName="stroke" dur="1.5s" begin="{i * 0.3:.1f}s" values="{p["vein"]};{p["vein2"]};{p["vein"]}" repeatCount="indefinite" />'
            f'<animate attributeName="stroke-width" dur="1.5s" begin="{i * 0.3:.1f}s" values="{w * 0.8:.1f};{w * 1.4:.1f};{w * 0.8:.1f}" repeatCount="indefinite" /></path>'
            f'<path d="{d}" stroke="#f0a0c0" stroke-width="0.7" fill="none" opacity="0.35" transform="translate(-0.6 -0.8)" />')


def vein_net(y0, y1, x0, x1, seed, p, n=5):
    """Branching veins across a large surface (between y0 and y1)."""
    rnd = random.Random(seed)
    out = ''
    for i in range(n):
        x = rnd.uniform(x0, x1)
        y = rnd.uniform(y0 + 4, y1 - 4)
        d = f'M {x:.0f} {y:.0f} Q {x + 12:.0f} {y - 3:.0f} {x + 20:.0f} {y:.0f}'
        for _ in range(4):
            x += rnd.uniform(30, 55) * (1 if i % 2 else -1)
            y = min(y1 - 3, max(y0 + 3, y + rnd.uniform(-4, 4)))
            d += f' T {x:.0f} {y:.0f}'
        out += vein(d, p, i)
        # a side branch
        out += vein(f'M {x:.0f} {y:.0f} q {rnd.uniform(-14, 14):.0f} {rnd.uniform(-8, 8):.0f} {rnd.uniform(-24, 24):.0f} {rnd.uniform(-6, 6):.0f}', p, i + 1)
    return out


def drips(points, p, long=1.0):
    out = ''
    for i, (x, y0, l) in enumerate(points):
        l *= long
        def tear(L):
            return f'M {x - 5} {y0} C {x - 5} {y0 + L * 0.55:.0f} {x - 7} {y0 + L:.0f} {x} {y0 + L:.0f} C {x + 7} {y0 + L:.0f} {x + 5} {y0 + L * 0.55:.0f} {x + 5} {y0} Z'
        out += (f'<path d="{tear(l)}" fill="{p["goo"]}" opacity="0.85">'
                f'<animate attributeName="d" dur="1.5s" begin="{i * 0.2:.1f}s" repeatCount="indefinite" values="{tear(l * 0.55)};{tear(l)};{tear(l * 0.55)}" /></path>'
                f'<ellipse cx="{x - 2}" cy="{y0 + l * 0.5:.0f}" rx="1.4" ry="3" fill="{p["goo2"]}" opacity="0.8" />')
    return out


def strands(pairs, p):
    out = ''
    for i, (x1, y1, x2, y2) in enumerate(pairs):
        mx, my = (x1 + x2) / 2, max(y1, y2) + 14
        out += (f'<path d="M {x1} {y1} Q {mx} {my} {x2} {y2}" stroke="{p["goo"]}" stroke-width="1.6" fill="none" opacity="0.75">'
                f'<animate attributeName="d" dur="1.5s" begin="{i * 0.25:.2f}s" repeatCount="indefinite" '
                f'values="M {x1} {y1} Q {mx} {my} {x2} {y2};M {x1} {y1} Q {mx} {my + 8} {x2} {y2};M {x1} {y1} Q {mx} {my} {x2} {y2}" /></path>')
    return out


def frames(kind, p):
    s = [f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none">']
    if kind == 'adernetz':
        s.append(vein_net(6, 24, 10, W - 10, 1, p, 3) + vein_net(SHEET + 40, TABS - 8, 20, W - 20, 2, p, 3) + vein_net(TABS + 4, TABS + 16, 10, W - 10, 3, p, 2))
        s.append(thorns(0, W, TOP, False, 16, 14, p, 1) + thorns(6, W - 6, SHEET, True, 15, 16, p, 2) + thorns(0, W, TABS, True, 12, 8, p, 3))
        s.append(''.join(f'<circle cx="{x}" cy="{y}" r="2.6" fill="{p["goo"]}" opacity="0.85" />' for x, y in [(36, TOP + 13), (150, TOP + 15), (290, TOP + 12), (60, SHEET - 15), (210, SHEET - 16), (330, SHEET - 13)]))
    elif kind == 'schmodder':
        s.append(f'<rect x="0" y="{TOP - 6}" width="{W}" height="8" fill="{p["goo"]}" opacity="0.35" />'
                 f'<rect x="6" y="{SHEET - 2}" width="{W - 12}" height="6" fill="{p["goo"]}" opacity="0.35" />')
        s.append(thorns(0, W, TOP, False, 16, 14, p, 1) + thorns(6, W - 6, SHEET, True, 15, 16, p, 2) + thorns(0, W, TABS, True, 12, 8, p, 3))
        s.append(drips([(30, TOP + 6, 30), (96, TOP + 10, 44), (170, TOP + 4, 24), (245, TOP + 8, 52), (330, TOP + 6, 34)], p))
        s.append(vein(f'M 0 {TOP - 3} C 120 {TOP + 2} 260 {TOP - 6} {W} {TOP - 2}', p, 0) + vein(f'M 6 {SHEET + 4} C 140 {SHEET + 9} 250 {SHEET} {W - 6} {SHEET + 5}', p, 1))
    else:  # fleisch
        s.append(f'<path d="M 0 {TOP - 10} Q {W / 2} {TOP + 6} {W} {TOP - 10} V {TOP + 4} H 0 Z" fill="{p["flesh"]}" stroke="{p["flesh2"]}" />'
                 f'<path d="M 6 {SHEET + 12} Q {W / 2} {SHEET - 6} {W - 6} {SHEET + 12} V {SHEET - 2} H 6 Z" fill="{p["flesh"]}" stroke="{p["flesh2"]}" />')
        s.append(vein_net(TOP - 9, TOP + 3, 10, W - 10, 4, p, 3) + vein_net(SHEET - 4, SHEET + 10, 20, W - 20, 5, p, 3))
        s.append(thorns(0, W, TOP + 3, False, 12, 12, p, 6) + thorns(6, W - 6, SHEET - 3, True, 11, 14, p, 7))
        s.append(strands([(40, TOP + 14, 90, TOP + 12), (150, TOP + 12, 210, TOP + 15), (260, TOP + 13, 330, TOP + 12)], p))
        s.append(strands([(50, SHEET - 16, 120, SHEET - 12), (230, SHEET - 14, 300, SHEET - 16)], p))
    s.append('</svg>')
    return ''.join(s)


VARIANTS = [('a', 'adernetz'), ('b', 'schmodder'), ('c', 'fleisch')]


def page(kind):
    p = P
    m = f'<div style="position: absolute; left: 0; top: {TOP}px">{galaxy(W, SHEET - TOP, tip=False)}</div>'
    pill = f'border-radius: 12px 9px 13px 8px; border: 1px solid {p["edge"]};'
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Rasse</title>\n<link rel="stylesheet" href="/style.css" />\n'
            f'<style>{base_css(p)}</style>\n</head>\n<body>\n<div class="r-phone" id="ph">{m}{panels(p)}{frames(kind, p)}{chrome_html(p, pill)}</div>\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest', 'race4')
    os.makedirs(out, exist_ok=True)
    for letter, kind in VARIANTS:
        with open(os.path.join(out, f'brut-{letter}.html'), 'w', encoding='utf-8') as f:
            f.write(page(kind))
    print('wrote race4 pages')
