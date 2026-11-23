"""Playtest – the Brut a sixth time: calm colour, real slime.

[E] brut5 (owner, 2026-11-23): chitin in lit relief is the direction; the
colour must be far calmer and must not draw attention (research how
StarCraft II's Zerg interface does it); slime drops thicker, slower,
slimier and real, slime strands real too.
Research (2026-11-23, sources in okf/features/ux-playtest.md): the Zerg
interface of Heart of the Swarm uses a purple tone and moved from heavy
skeuomorphism towards flatter design; console skins keep a similar size so
they do not cover the game; strong colour belongs to the units, not to the
frame. Taken here as principles only, with own shapes:
dark, desaturated purple-brown base with little contrast to the panel,
relief from light instead of hue, thin borders, few muted accents.
Slime: a „goo“ filter (blur and alpha threshold) merges drops and strands
smoothly; lighting gives the wet gloss; drops neck and fall slowly.
Prerendered frame by frame. Proposal only.
"""
import math
import os
import random

from playtest_d1 import galaxy
from playtest_race3 import BRUT, SHEET, TABS, TOP, H, W, base_css, chrome_html, panels

P = dict(BRUT, panel='#141012', panel2='#1e161a', edge='#3a2a30', txt='#e6dce0', dim='#9a8a90', acc='#b8a8c8')
N = 16  # frames, about 3 s


def defs(t, accent):
    pulse = 0.5 + 0.5 * math.sin(2 * math.pi * t)
    return (f'<defs>'
            f'<filter id="shell" x="-5%" y="-30%" width="110%" height="160%">'
            f'<feTurbulence type="fractalNoise" baseFrequency="0.028 0.06" numOctaves="4" seed="11" result="n" />'
            f'<feDiffuseLighting in="n" surfaceScale="3.2" lighting-color="#ffffff" result="d"><feDistantLight azimuth="235" elevation="42" /></feDiffuseLighting>'
            f'<feSpecularLighting in="n" surfaceScale="3.2" specularConstant="0.18" specularExponent="34" lighting-color="#e8dce8" result="s"><feDistantLight azimuth="235" elevation="50" /></feSpecularLighting>'
            f'<feComposite in="d" in2="SourceGraphic" operator="arithmetic" k1="1.15" k2="0" k3="0" k4="0" result="lit" />'
            f'<feComposite in="s" in2="SourceAlpha" operator="in" result="sp" /><feMerge><feMergeNode in="lit" /><feMergeNode in="sp" /></feMerge></filter>'
            # goo: merge shapes into one smooth body, then light it as a wet surface
            f'<filter id="goo" x="-20%" y="-20%" width="140%" height="180%">'
            f'<feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="b" />'
            f'<feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" result="g" />'
            f'<feGaussianBlur in="g" stdDeviation="1.2" result="gb" />'
            f'<feSpecularLighting in="gb" surfaceScale="5" specularConstant="0.9" specularExponent="40" lighting-color="#f4f0e0" result="s"><fePointLight x="120" y="-60" z="160" /></feSpecularLighting>'
            f'<feComposite in="s" in2="g" operator="in" result="sp" />'
            f'<feMerge><feMergeNode in="g" /><feMergeNode in="sp" /></feMerge></filter>'
            f'<filter id="seam" x="-5%" y="-100%" width="110%" height="300%"><feGaussianBlur stdDeviation="{1.2 + 0.8 * pulse:.2f}" /></filter>'
            f'</defs>')


def edge(y, down, x0=0, x1=W, seed=1, amp=5):
    rnd = random.Random(seed)
    d = f'M {x0} {y}'
    x = x0
    while x < x1:
        nx = min(x1, x + rnd.uniform(26, 46))
        d += f' Q {(x + nx) / 2:.0f} {y + rnd.uniform(2, amp) * (1 if down else -1):.0f} {nx:.0f} {y}'
        x = nx
    return d


def thorn_row(x0, x1, y, down, seed, h=10):
    rnd = random.Random(seed)
    out = ''
    x = x0
    while x < x1 - 10:
        w = rnd.uniform(12, 20)
        hh = h * rnd.uniform(0.6, 1.1) * (1 if down else -1)
        out += f'<path d="M {x:.0f} {y} Q {x + w * 0.35:.0f} {y + hh * 0.6:.0f} {x + w * 0.55:.0f} {y + hh:.0f} Q {x + w * 0.65:.0f} {y + hh * 0.5:.0f} {x + w:.0f} {y} Z" fill="#42263a" filter="url(#shell)" />'
        x += w + rnd.uniform(4, 12)
    return out


def drop(x, y0, t, phase, length):
    """A viscous drop: it hangs, necks, lets go and falls slowly; returns shapes for the goo filter."""
    u = (t + phase) % 1.0
    out = ''
    if u < 0.7:  # growing and necking
        g = u / 0.7
        L = length * (0.35 + 0.65 * g)
        r = 4 + 3.5 * g
        neck = 3.2 - 1.8 * g
        out += f'<rect x="{x - neck:.1f}" y="{y0}" width="{2 * neck:.1f}" height="{L:.1f}" rx="{neck:.1f}" fill="#7a7448" />'
        out += f'<circle cx="{x}" cy="{y0 + L:.1f}" r="{r:.1f}" fill="#7a7448" />'
    else:  # let go: a falling drop and a short string snapping back
        g = (u - 0.7) / 0.3
        out += f'<rect x="{x - 1.6:.1f}" y="{y0}" width="3.2" height="{length * 0.35 * (1 - g):.1f}" rx="1.6" fill="#7a7448" />'
        out += f'<circle cx="{x}" cy="{y0 + length + 40 * g * g:.1f}" r="{7.5 - 2 * g:.1f}" fill="#7a7448" opacity="{1 - g * 0.8:.2f}" />'
    out += f'<ellipse cx="{x}" cy="{y0 + 1}" rx="7" ry="3" fill="#7a7448" />'  # the pool at the edge
    return out


def strand(x1, x2, y, t, phase):
    u = 0.5 + 0.5 * math.sin(2 * math.pi * (t + phase))
    sag = 10 + 8 * u
    mid = (x1 + x2) / 2
    thin = 1.2 + 1.0 * (1 - u)
    return (f'<path d="M {x1} {y} Q {mid} {y + sag:.1f} {x2} {y}" stroke="#7a7448" stroke-width="{thin * 2.4:.1f}" fill="none" />'
            f'<circle cx="{x1}" cy="{y}" r="4" fill="#7a7448" /><circle cx="{x2}" cy="{y}" r="4" fill="#7a7448" />'
            f'<circle cx="{mid}" cy="{y + sag * 0.55:.1f}" r="{2.5 + 1.5 * u:.1f}" fill="#7a7448" />')


def frames(kind, t):
    s = [f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none">', defs(t, kind)]
    shell = '#3a2232'
    # thin chitin bands: the lower edge of the top bar, the upper edges of sheet and tab bar
    s.append(f'<path d="{edge(TOP - 2, True, seed=1)} L {W} {TOP - 8} L 0 {TOP - 8} Z" fill="{shell}" filter="url(#shell)" />')
    s.append(f'<path d="{edge(SHEET + 1, False, 6, W - 6, seed=2)} L {W - 6} {SHEET + 7} L 6 {SHEET + 7} Z" fill="{shell}" filter="url(#shell)" />')
    s.append(f'<path d="{edge(TABS + 1, False, seed=3, amp=3)} L {W} {TABS + 5} L 0 {TABS + 5} Z" fill="{shell}" filter="url(#shell)" />')
    s.append(thorn_row(4, W - 4, TOP - 1, True, 4, 9) + thorn_row(10, W - 10, SHEET + 1, False, 5, 11))
    if kind == 'still':
        pass
    elif kind == 'naht':  # a faint violet seam that breathes
        pulse = 0.5 + 0.5 * math.sin(2 * math.pi * t)
        s.append(f'<rect x="10" y="{SHEET + 2}" width="{W - 20}" height="3" rx="1.5" fill="#8a72b0" opacity="{0.3 + 0.35 * pulse:.2f}" filter="url(#seam)" />'
                 f'<rect x="0" y="{TOP - 6}" width="{W}" height="2.5" rx="1.2" fill="#8a72b0" opacity="{0.25 + 0.3 * pulse:.2f}" filter="url(#seam)" />')
    else:  # schleim: viscous drops and strands
        goo = ''.join(drop(x, TOP + 2, t, ph, ln) for x, ph, ln in [(48, 0.0, 30), (170, 0.45, 24), (300, 0.75, 34)])
        goo += strand(96, 132, TOP + 4, t, 0.2) + strand(226, 262, TOP + 4, t, 0.6) + strand(120, 160, SHEET - 2, t, 0.35)
        s.append(f'<g filter="url(#goo)" opacity="0.88">{goo}</g>')
    s.append('</svg>')
    return ''.join(s)


VARIANTS = [('a', 'still'), ('b', 'naht'), ('c', 'schleim')]


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
            with open(os.path.join(out, f'brut6-{letter}-{i:02d}.html'), 'w', encoding='utf-8') as f:
                f.write(page(kind, i / N))
    print('wrote brut6 frames')
