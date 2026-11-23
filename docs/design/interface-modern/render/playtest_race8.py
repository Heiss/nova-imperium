"""Playtest – the Ewige and the Imperium as prerendered frames, like the Brut.

[E] ewige3 (owner, 2026-11-23): bronze double frames with 65° corners and a
glowing gem; calm; solemn, old terms (Sternkarte, Welten, Flotten, Chronik,
Zeitlauf, Kreis). [E] brut4–6: frames may be prerendered, plastic and real,
calm in colour, only on borders and large surfaces. [E] the Imperium keeps
today's styling; here it is shown in the same frames so all three races are
equally far. Metal is lit relief (fractal noise as a height map with
diffuse and specular light). Own shapes. Proposal only.
"""
import math
import os

from playtest_d1 import galaxy
from playtest_race3 import EWIGE, SHEET, TABS, TOP, H, W, base_css, chrome_html, panels

T65 = 1 / math.tan(math.radians(65))
N = 12
IMPERIUM = dict(panel='#17110d', panel2='#211812', txt='#e9dfc8', dim='#a8997f', acc='#f1d27a', edge='#8a6a2a',
                font="'EB Garamond', Georgia, serif", ls='0.04em', tabs=['Karte', 'Welten', 'Flotten', 'Berichte', 'Menü'], lage='Lage', galaxy='Galaxie 1 ▾')


def metal_defs(t, tint, spec=0.9, rough=0.06, patina=False):
    pulse = 0.5 + 0.5 * math.sin(2 * math.pi * t)
    pat = ('<feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="5" result="pn" />'
           '<feColorMatrix in="pn" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.42  0 0 0 0 0.36  0 0 0 1.6 -0.75" result="pc" />'
           '<feComposite in="pc" in2="SourceAlpha" operator="in" result="pat" />') if patina else ''
    merge_pat = '<feMergeNode in="pat" />' if patina else ''
    return ('<defs>'
            f'<filter id="metal" x="-5%" y="-30%" width="110%" height="160%">'
            f'<feTurbulence type="fractalNoise" baseFrequency="{rough} {rough * 0.3:.3f}" numOctaves="3" seed="9" result="n" />'
            f'<feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="bev" />'
            f'<feComposite in="n" in2="bev" operator="arithmetic" k1="0" k2="0.25" k3="1" k4="0" result="h" />'
            f'<feDiffuseLighting in="h" surfaceScale="2.4" lighting-color="#ffffff" result="d"><feDistantLight azimuth="235" elevation="40" /></feDiffuseLighting>'
            f'<feSpecularLighting in="h" surfaceScale="2.4" specularConstant="{spec}" specularExponent="26" lighting-color="{tint}" result="s"><feDistantLight azimuth="235" elevation="52" /></feSpecularLighting>'
            f'<feComposite in="d" in2="SourceGraphic" operator="arithmetic" k1="1.2" k2="0" k3="0" k4="0" result="lit" />'
            f'<feComposite in="s" in2="SourceAlpha" operator="in" result="sp" />{pat}'
            f'<feMerge><feMergeNode in="lit" /><feMergeNode in="sp" />{merge_pat}</feMerge></filter>'
            f'<filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="{2 + 2 * pulse:.1f}" result="b" />'
            f'<feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>'
            '<filter id="shade" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.8" /></filter>'
            '</defs>')


def band65(y0, y1, x0=0, x1=W, cut=6):
    run = cut * T65
    return (f'<path d="M {x0} {y0} H {x1} V {y1} H {x0} Z" />', f'<path d="M {x0 + run:.1f} {y0} H {x1 - run:.1f} L {x1} {y0 + cut} V {y1 - cut} L {x1 - run:.1f} {y1} H {x0 + run:.1f} L {x0} {y1 - cut} V {y0 + cut} Z" />')


def frame65(x, y, w, h, cut, sw):
    run = cut * T65
    pts = [(x + run, y), (x + w - run, y), (x + w, y + cut), (x + w, y + h - cut), (x + w - run, y + h), (x + run, y + h), (x, y + h - cut), (x, y + cut)]
    return f'<polygon points="{" ".join(f"{a:.1f},{b:.1f}" for a, b in pts)}" fill="none" stroke-width="{sw}" />'


def gem(cx, cy, size, col, t):
    return (f'<g filter="url(#glow)"><path d="M {cx} {cy - size} L {cx + size * 0.8:.1f} {cy} L {cx} {cy + size} L {cx - size * 0.8:.1f} {cy} Z" fill="{col}" />'
            f'<path d="M {cx} {cy - size} L {cx + size * 0.8:.1f} {cy} L {cx} {cy} Z" fill="#ffffff" opacity="0.35" /></g>')


def ewige_frames(kind, t):
    bronze = {'poliert': '#9a7a46', 'patina': '#7a6440', 'dunkel': '#5a4a36'}[kind]
    spec = {'poliert': 1.0, 'patina': 0.55, 'dunkel': 0.7}[kind]
    s = [f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none">',
         metal_defs(t, '#fff0d0', spec, patina=kind == 'patina')]
    sheet = (8, SHEET, W - 16, TABS - SHEET - 8)
    # bars as metal strips; the sheet as a double frame with 65° corners
    s.append(f'<g filter="url(#shade)"><path d="M 0 {TOP - 6} H {W / 2 - 46} l {8 * T65:.1f} 8 H {W / 2 + 46 - 8 * T65:.1f} l {8 * T65:.1f} -8 H {W} V {TOP - 1} H 0 Z" fill="{bronze}" filter="url(#metal)" /></g>')
    s.append(f'<g filter="url(#shade)" stroke="{bronze}">' + frame65(*sheet, 14, 4.5).replace('fill="none"', 'fill="none" filter="url(#metal)"') + '</g>')
    s.append(f'<g stroke="{bronze}" opacity="0.8">' + frame65(sheet[0] + 6, sheet[1] + 6, sheet[2] - 12, sheet[3] - 12, 10, 1.6).replace('fill="none"', 'fill="none" filter="url(#metal)"') + '</g>')
    s.append(f'<path d="M 0 {TABS - 3} H {W} V {TABS + 2} H 0 Z" fill="{bronze}" filter="url(#metal)" />')
    if kind == 'dunkel':  # engraved lines in the strips
        for x in range(30, W - 20, 40):
            s.append(f'<path d="M {x} {TOP - 4} l {4 * T65:.1f} 4 h 10 l {4 * T65:.1f} -4" stroke="#2a2218" stroke-width="1" fill="none" />')
    s.append(gem(W / 2, TOP + 1, 6, '#7fe0f0', t) + gem(W / 2, SHEET, 5, '#7fe0f0', t))
    s.append('</svg>')
    return ''.join(s)


def imperium_frames(kind, t):
    gold = '#b08a3a'
    s = [f'<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" style="position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none">',
         metal_defs(t, '#fff4d8', 0.8 if kind != 'heute' else 0.0, 0.08)]
    if kind == 'heute':  # today's styling: thin gold lines, no relief
        s.append(f'<path d="M 0 {TOP - 1} H {W}" stroke="#8a6a2a" stroke-width="1" /><path d="M 6 {SHEET} H {W - 6}" stroke="#d4a537" stroke-width="1" />'
                 f'<path d="M 0 {TABS} H {W}" stroke="#4a3a2a" stroke-width="1" />')
    else:
        s.append(f'<g filter="url(#shade)"><path d="M 0 {TOP - 5} H {W} V {TOP} H 0 Z" fill="{gold}" filter="url(#metal)" /></g>')
        s.append(f'<g filter="url(#shade)"><rect x="6" y="{SHEET - 2}" width="{W - 12}" height="6" rx="3" fill="{gold}" filter="url(#metal)" /></g>')
        s.append(f'<path d="M 0 {TABS - 2} H {W} V {TABS + 2} H 0 Z" fill="{gold}" filter="url(#metal)" />')
        if kind == 'zier':  # corner ornaments: a pointed arch and a small cross of lines
            for x, f in [(10, 1), (W - 10, -1)]:
                s.append(f'<g filter="url(#shade)"><path d="M {x} {SHEET + 2} q {f * 2} -22 {f * 18} -28 q {-f * 6} 10 {-f * 4} 26 Z" fill="{gold}" filter="url(#metal)" />'
                         f'<circle cx="{x + f * 14}" cy="{SHEET - 14}" r="3" fill="#d4a537" /></g>')
            s.append(f'<g filter="url(#shade)"><path d="M {W / 2 - 22} {SHEET + 1} q 22 -20 44 0 Z" fill="{gold}" filter="url(#metal)" /><circle cx="{W / 2}" cy="{SHEET - 8}" r="3.5" fill="#f1d27a" /></g>')
    s.append('</svg>')
    return ''.join(s)


VARIANTS = {'ewige': [('a', 'poliert'), ('b', 'patina'), ('c', 'dunkel')], 'imperium': [('a', 'heute'), ('b', 'gold'), ('c', 'zier')]}


def page(race, kind, t):
    p = EWIGE if race == 'ewige' else IMPERIUM
    if race == 'ewige':
        p = dict(p, galaxy='Kreis 1 ▾', ls='0.05em')
    m = f'<div style="position: absolute; left: 0; top: {TOP}px">{galaxy(W, SHEET - TOP, tip=False)}</div>'
    frames = ewige_frames(kind, t) if race == 'ewige' else imperium_frames(kind, t)
    run = 7 * T65
    pill = (f'clip-path: polygon({run:.1f}px 0, calc(100% - {run:.1f}px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - {run:.1f}px) 100%, {run:.1f}px 100%, 0 calc(100% - 7px), 0 7px); '
            'box-shadow: inset 0 0 0 1px #9a7a46; font-size: 11px;') if race == 'ewige' else 'border-radius: 12px; border: 1px solid #4a3a2a;'
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Rasse</title>\n<link rel="stylesheet" href="/style.css" />\n'
            f'<style>{base_css(p)}</style>\n</head>\n<body>\n<div class="r-phone" id="ph">{m}{panels(p)}{frames}{chrome_html(p, pill)}</div>\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest', 'race5')
    os.makedirs(out, exist_ok=True)
    for race, vs in VARIANTS.items():
        for letter, kind in vs:
            for i in range(N):
                with open(os.path.join(out, f'{race}8-{letter}-{i:02d}.html'), 'w', encoding='utf-8') as f:
                    f.write(page(race, kind, i / N))
    print('wrote race8 frames')
