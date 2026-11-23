"""Playtest – the Brut a seventh time: brut6 (calm chitin, viscous slime) with real bones.

[E] brut6 (owner, 2026-11-23): calm, dark purple-brown chitin with viscous
slime is right; now add real-looking bones for more goo. Bones are lit
relief too (a bone filter: low-frequency noise, diffuse light, a muted
ivory), partly wet with slime. Only borders and large surfaces; motion only
there (an option „keine Animationen“ stops it). Own shapes. Proposal only.
"""
import math
import os

from playtest_d1 import galaxy
from playtest_race3 import SHEET, TABS, TOP, H, W, base_css, chrome_html, panels
from playtest_race6 import N, P, defs, drop, edge, strand, thorn_row

BONE = '#7a6e60'


def bone_defs():
    return ('<defs><filter id="bone" x="-10%" y="-20%" width="120%" height="140%">'
            '<feTurbulence type="fractalNoise" baseFrequency="0.09 0.05" numOctaves="3" seed="21" result="n" />'
            '<feDiffuseLighting in="n" surfaceScale="1.6" lighting-color="#ffffff" result="d"><feDistantLight azimuth="235" elevation="48" /></feDiffuseLighting>'
            '<feComposite in="d" in2="SourceGraphic" operator="arithmetic" k1="1.25" k2="0" k3="0" k4="0" result="lit" />'
            '<feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="b" />'
            '<feSpecularLighting in="b" surfaceScale="3" specularConstant="0.35" specularExponent="22" lighting-color="#fff6e6" result="s"><feDistantLight azimuth="235" elevation="55" /></feSpecularLighting>'
            '<feComposite in="s" in2="SourceAlpha" operator="in" result="sp" />'
            '<feMerge><feMergeNode in="lit" /><feMergeNode in="sp" /></feMerge></filter>'
            '<filter id="shade" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.8" /></filter></defs>')


def rib(x, y, h, lean):
    """A curved rib hanging from a band."""
    return (f'<path d="M {x - 4} {y} C {x - 6 + lean} {y + h * 0.5:.0f} {x + lean * 1.6:.0f} {y + h * 0.9:.0f} {x + lean * 2:.0f} {y + h} '
            f'C {x + lean * 2 + 5:.0f} {y + h - 1} {x + lean * 1.6 + 4:.0f} {y + h * 0.85:.0f} {x + 5} {y} Z" fill="{BONE}" filter="url(#bone)" />')


def vertebra(x, y, w=22, h=12):
    return (f'<g filter="url(#shade)"><path d="M {x} {y + h / 2} q {w * 0.1:.1f} {-h * 0.7:.1f} {w / 2:.1f} {-h * 0.55:.1f} q {w * 0.4:.1f} {-h * 0.15:.1f} {w / 2:.1f} {h * 0.55:.1f} '
            f'q {-w * 0.1:.1f} {h * 0.7:.1f} {-w / 2:.1f} {h * 0.55:.1f} q {-w * 0.4:.1f} {h * 0.15:.1f} {-w / 2:.1f} {-h * 0.55:.1f} Z" fill="{BONE}" filter="url(#bone)" />'
            f'<path d="M {x + w / 2:.1f} {y - h * 0.1:.1f} l -3 -7 l 6 0 Z" fill="{BONE}" filter="url(#bone)" /></g>')


def spur(x, y, size, flip, up):
    f = -1 if flip else 1
    v = -1 if up else 1
    return (f'<path d="M {x} {y} q {f * size * 0.2:.1f} {v * size * 0.8:.1f} {f * size:.1f} {v * size * 1.1:.1f} q {-f * size * 0.5:.1f} {-v * size * 0.2:.1f} {-f * size * 0.75:.1f} {-v * size * 1.1:.1f} Z" '
            f'fill="{BONE}" filter="url(#bone)" />')


def frames(kind, t):
    s = [f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none">', defs(t, 'schleim'), bone_defs()]
    shell = '#3a2232'
    s.append(f'<path d="{edge(TOP - 2, True, seed=1)} L {W} {TOP - 8} L 0 {TOP - 8} Z" fill="{shell}" filter="url(#shell)" />')
    s.append(f'<path d="{edge(SHEET + 1, False, 6, W - 6, seed=2)} L {W - 6} {SHEET + 7} L 6 {SHEET + 7} Z" fill="{shell}" filter="url(#shell)" />')
    s.append(f'<path d="{edge(TABS + 1, False, seed=3, amp=3)} L {W} {TABS + 5} L 0 {TABS + 5} Z" fill="{shell}" filter="url(#shell)" />')
    s.append(thorn_row(4, W - 4, TOP - 1, True, 4, 9) + thorn_row(10, W - 10, SHEET + 1, False, 5, 11))
    if kind == 'rippen':
        s.append('<g filter="url(#shade)">' + ''.join(rib(x, TOP - 4, h, lean) for x, h, lean in [(24, 26, 4), (64, 34, 5), (104, 28, 4), (282, 30, -4), (322, 36, -5), (362, 26, -4)]) + '</g>')
        goo = drop(84, TOP + 2, t, 0.1, 30) + drop(300, TOP + 2, t, 0.6, 26) + strand(64, 104, TOP + 22, t, 0.3) + strand(282, 322, TOP + 22, t, 0.7)
    elif kind == 'wirbel':
        import random
        rnd = random.Random(31)
        x = 12
        while x < W - 40:  # an irregular spine: sizes, gaps and height vary
            w = rnd.uniform(18, 28)
            s.append(vertebra(round(x), round(SHEET - 3 + rnd.uniform(-2, 2)), w, w * rnd.uniform(0.45, 0.6)))
            x += w + rnd.uniform(4, 14)
        x = 20
        while x < W - 60:
            w = rnd.uniform(14, 20)
            s.append(vertebra(round(x), round(TOP - 2 + rnd.uniform(-1, 2)), w, w * 0.5))
            x += w + rnd.uniform(18, 40)
        goo = drop(60, TOP + 4, t, 0.0, 28) + drop(250, TOP + 4, t, 0.5, 34) + strand(118, 170, SHEET - 6, t, 0.25) + strand(220, 262, SHEET - 6, t, 0.65)
    else:  # sporne
        s.append('<g filter="url(#shade)">' + spur(8, SHEET + 2, 30, False, True) + spur(W - 8, SHEET + 2, 30, True, True) + spur(6, TOP - 2, 24, False, False)
                 + spur(W - 6, TOP - 2, 24, True, False) + spur(150, SHEET + 1, 14, False, True) + spur(240, SHEET + 1, 14, True, True) + '</g>')
        goo = drop(26, TOP + 18, t, 0.2, 26) + drop(W - 26, TOP + 18, t, 0.7, 22) + drop(190, TOP + 2, t, 0.45, 30) + strand(150, 240, SHEET - 10, t, 0.4)
    s.append(f'<g filter="url(#goo)" opacity="0.88">{goo}</g>')
    s.append('</svg>')
    return ''.join(s)


VARIANTS = [('a', 'rippen'), ('b', 'wirbel'), ('c', 'sporne')]


def page(kind, t):
    p = P
    m = f'<div style="position: absolute; left: 0; top: {TOP}px">{galaxy(W, SHEET - TOP, tip=False)}</div>'
    pill = f'border-radius: 12px 9px 13px 8px; border: 1px solid {p["edge"]};'
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Rasse</title>\n<link rel="stylesheet" href="/style.css" />\n'
            f'<style>{base_css(p)}</style>\n</head>\n<body>\n<div class="r-phone" id="ph">{m}{panels(p)}{frames(kind, t)}{chrome_html(p, pill)}</div>\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest', 'race5')
    os.makedirs(out, exist_ok=True)
    for letter, kind in VARIANTS:
        for i in range(N):
            with open(os.path.join(out, f'brut7-{letter}-{i:02d}.html'), 'w', encoding='utf-8') as f:
                f.write(page(kind, i / N))
    print('wrote brut7 frames')
