"""Playtest round 6 – the races again, inside the winners of round 1b.

[E] r1b: Brut = chitin, the wobbling means organic elements that move a
little, „gerne auch ein wenig eklig“ (in the spirit of StarCraft II's Zerg,
inspiration only, own shapes); terms change per race. Ewige = clockwork,
„eher ruhig“, more visible mechanics, futuristic bends at 65°.
Three versions each; same map and layout. Proposal only.
"""
import math
import os

from playtest_race import BRUT, EWIGE, chrome, css, mapsvg

W, H = 390, 780
T65 = 1 / math.tan(math.radians(65))  # horizontal run of a 65° bend per unit of height


def clip65(cut=16):
    run = cut * T65
    return (f'polygon({run:.1f}px 0, calc(100% - {run:.1f}px) 0, 100% {cut}px, 100% calc(100% - {cut}px), '
            f'calc(100% - {run:.1f}px) 100%, {run:.1f}px 100%, 0 calc(100% - {cut}px), 0 {cut}px)')


# ------------------------------------------------------------------ Brut overlays
def brut_overlay(kind):
    s = [f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none">']
    if kind == 'adern':
        # veins crawling over the edge of the sheet and the top bar, pulsing
        for i, (x0, y0) in enumerate([(30, 640), (120, 642), (260, 641), (350, 640), (80, 96), (300, 96)]):
            up = -1 if y0 > 300 else 1
            s.append(f'<path d="M {x0} {y0} q 8 {up * 14} -4 {up * 26} t 6 {up * 22}" stroke="#8a2a4a" stroke-width="2.5" fill="none" stroke-linecap="round">'
                     f'<animate attributeName="stroke-width" dur="1.5s" values="1.5;4;1.5" begin="{i * 0.2:.1f}s" repeatCount="indefinite" />'
                     f'<animate attributeName="stroke" dur="1.5s" values="#6a1a3a;#c0406a;#6a1a3a" begin="{i * 0.2:.1f}s" repeatCount="indefinite" /></path>')
    elif kind == 'schleim':
        # slime drops sliding down from the sheet and the top bar
        for i, (x, y0, l) in enumerate([(40, 96, 46), (150, 96, 30), (290, 96, 56), (70, 642, 18), (210, 642, 24), (340, 642, 14)]):
            s.append(f'<path d="M {x - 5} {y0} Q {x} {y0 + l} {x + 5} {y0} Z" fill="#b6e04a" opacity="0.55">'
                     f'<animate attributeName="d" dur="1.5s" begin="{i * 0.25:.2f}s" repeatCount="indefinite" '
                     f'values="M {x - 5} {y0} Q {x} {y0 + l * 0.4:.0f} {x + 5} {y0} Z;M {x - 4} {y0} Q {x} {y0 + l} {x + 4} {y0} Z;M {x - 5} {y0} Q {x} {y0 + l * 0.4:.0f} {x + 5} {y0} Z" /></path>'
                     f'<circle cx="{x}" cy="{y0 + l}" r="3" fill="#b6e04a" opacity="0.6"><animate attributeName="cy" dur="1.5s" begin="{i * 0.25:.2f}s" '
                     f'values="{y0 + l * 0.4:.0f};{y0 + l + 30};{y0 + l + 30}" keyTimes="0;0.8;1" repeatCount="indefinite" />'
                     f'<animate attributeName="opacity" dur="1.5s" begin="{i * 0.25:.2f}s" values="0.7;0.5;0" repeatCount="indefinite" /></circle>')
    elif kind == 'blasen':
        # blisters on the map that swell and shrink
        import random
        rnd = random.Random(8)
        for i in range(16):
            x, y, r = rnd.uniform(20, 370), rnd.uniform(140, 620), rnd.uniform(5, 13)
            s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="#4a1a3a" stroke="#8a3a5a" stroke-width="1" opacity="0.7">'
                     f'<animate attributeName="r" dur="1.5s" begin="{i * 0.09:.2f}s" values="{r * 0.6:.1f};{r * 1.25:.1f};{r * 0.6:.1f}" repeatCount="indefinite" /></circle>'
                     f'<circle cx="{x - r * 0.3:.0f}" cy="{y - r * 0.3:.0f}" r="{r * 0.25:.1f}" fill="#f0c0d0" opacity="0.4" />')
    s.append('</svg>')
    return ''.join(s)


def brut_css(kind):
    if kind == 'adern':
        return '.r-sheet { box-shadow: 0 -4px 18px rgb(192 64 106 / 0.35) }'
    if kind == 'schleim':
        return ('@keyframes sheen { to { background-position: 200px 0 } } .r-sheet, .r-top { background-image: linear-gradient(100deg, transparent 30%, rgb(182 224 74 / 0.12) 45%, transparent 60%); '
                'background-size: 200px 100%; animation: sheen 1.5s linear infinite }')
    return ('@keyframes swell { 0%, 100% { transform: scale(1, 1) } 50% { transform: scale(1.015, 0.985) } } .r-sheet { animation: swell 1.5s ease-in-out infinite; '
            'background-image: radial-gradient(circle at 20% 0, rgb(138 58 90 / 0.5) 0 10px, transparent 11px), radial-gradient(circle at 70% 0, rgb(138 58 90 / 0.5) 0 14px, transparent 15px) }')


# ------------------------------------------------------------------ Ewige overlays
def gear(cx, cy, r, teeth, dur, rev=False, col='#3a4f62'):
    return (f'<g><circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{col}" stroke-width="{r * 0.18:.1f}" stroke-dasharray="{2 * math.pi * r / teeth / 2:.1f} {2 * math.pi * r / teeth / 2:.1f}" />'
            f'<circle cx="{cx}" cy="{cy}" r="{r * 0.78:.0f}" fill="none" stroke="{col}" stroke-width="1.5" /><circle cx="{cx}" cy="{cy}" r="{r * 0.15:.0f}" fill="{col}" />'
            f'<animateTransform attributeName="transform" type="rotate" dur="{dur}" values="0 {cx} {cy};{-30 if rev else 30} {cx} {cy}" repeatCount="indefinite" /></g>')


def bent(x, y, l1, l2, col):
    """A rod with a 65° bend."""
    dx, dy = l2 * math.cos(math.radians(65)), l2 * math.sin(math.radians(65))
    return f'<path d="M {x} {y} h {l1} l {dx:.1f} {dy:.1f}" stroke="{col}" stroke-width="2" fill="none" />'


def ewige_overlay(kind):
    s = [f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position: absolute; left: 0; top: 0; z-index: 1; pointer-events: none">']
    if kind == 'kante':
        cx, cy = 190, 396
        s.append(f'<line x1="{cx}" y1="{cy}" x2="{cx}" y2="{cy - 120}" stroke="#7fe0f0" stroke-width="1.5" opacity="0.7">'
                 f'<animateTransform attributeName="transform" type="rotate" dur="1.5s" calcMode="discrete" values="0 {cx} {cy};6 {cx} {cy};12 {cx} {cy};18 {cx} {cy};24 {cx} {cy};30 {cx} {cy}" repeatCount="indefinite" /></line>')
        for x, y in [(20, 140), (250, 560), (300, 170)]:
            s.append(bent(x, y, 40, 30, '#2a4a5c'))
    elif kind == 'zahn':
        s.append(gear(330, 200, 46, 16, '1.5s') + gear(330 - 46 - 26, 200 + 30, 30, 10, '1s', True) + gear(60, 560, 40, 14, '1.5s', True))
        for x, y in [(20, 150), (240, 600)]:
            s.append(bent(x, y, 60, 40, '#2a4a5c'))
    elif kind == 'pendel':
        px, py = 330, 110
        s.append(f'<g><line x1="{px}" y1="{py}" x2="{px}" y2="{py + 110}" stroke="#7f93a8" stroke-width="1.5" /><circle cx="{px}" cy="{py + 116}" r="7" fill="none" stroke="#7fe0f0" stroke-width="1.5" />'
                 f'<animateTransform attributeName="transform" type="rotate" dur="1.5s" values="-10 {px} {py};10 {px} {py};-10 {px} {py}" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" calcMode="spline" repeatCount="indefinite" /></g>')
        s.append(bent(16, 600, 50, 26, '#2a4a5c'))
    s.append('</svg>')
    return ''.join(s)


def ewige_css(kind):
    c = clip65(14 if kind != 'pendel' else 10)
    out = f'.r-sheet, .r-pill, .r-tab.on, .r-tag {{ clip-path: {c}; border-radius: 0 }} '
    if kind == 'zahn':
        out += '.r-sheet { border-width: 2px }'
    if kind == 'pendel':
        out += '.r-sheet { animation: none; background-image: none }'
    return out


VARIANTS = {'brut': [('a', 'adern'), ('b', 'schleim'), ('c', 'blasen')], 'ewige': [('a', 'kante'), ('b', 'zahn'), ('c', 'pendel')]}


def page(race, letter, kind):
    p, base = (BRUT, 'chitin') if race == 'brut' else (EWIGE, 'uhrwerk')
    extra_css = brut_css(kind) if race == 'brut' else ewige_css(kind)
    over = brut_overlay(kind) if race == 'brut' else ewige_overlay(kind)
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Rasse</title>\n<link rel="stylesheet" href="/style.css" />\n'
            f'<style>{css(p, base)} {extra_css}</style>\n</head>\n<body>\n<div class="r-phone" id="ph">' + mapsvg(p, base) + over + chrome(p, base) + '</div>\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest', 'race2')
    os.makedirs(out, exist_ok=True)
    for race, vs in VARIANTS.items():
        for letter, kind in vs:
            with open(os.path.join(out, f'{race}-{letter}.html'), 'w', encoding='utf-8') as f:
                f.write(page(race, letter, kind))
    print('wrote race2 pages')
