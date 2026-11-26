"""Playtest round 1b – race skins on the chosen galaxy map (pip map).

[E] 2026-11-23: the Imperium keeps today's styling; Brut and Ewige get their
own colours, shapes, type, frames and motion; the layout (map, Lage sheet,
tab bar) stays the same; the Brut wobbles organically. Three versions per
race. Original shapes only, no art of existing games (#154). Proposal only.

Animation: CSS keyframes and SVG <animate>; render_race.cjs steps through
the timeline and writes frames, ffmpeg makes GIFs.
"""
import math
import os

W, H = 390, 780
RES = '/icons/resources/small/'

SYS = {'1:24': (60, 70, [5, 9], 'o'), '1:26': (120, 200, [7, 12], 'g'), '1:27': (190, 300, [4, 8, 11, 14], 'me'),
       '1:29': (310, 150, [6], 'o'), '1:31': (300, 390, [3, 5, 9], 'w'), '1:35': (90, 430, [8, 10], 'o'),
       '1:44': (330, 500, [4, 6, 8], 'w'), '1:21': (250, 60, [2], 'o')}
OWNER = {'1:27': {4: 'me', 8: 'me', 11: 'me', 14: 'o'}, '1:26': {7: 'g', 12: 'o'}, '1:44': {4: 'w', 6: 'g', 8: 'o'}}


def owner(sysname, pos, default):
    return OWNER.get(sysname, {}).get(pos, default)


def mapsvg(p, mode):
    """The pip map in palette p; mode adds the race's own shapes."""
    w, h = W, 544
    out = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="position: absolute; left: 0; top: 96px">',
           '<defs>'
           '<filter id="wob" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3">'
           '<animate attributeName="baseFrequency" dur="3s" values="0.03;0.05;0.03" repeatCount="indefinite" /></feTurbulence>'
           '<feDisplacementMap in="SourceGraphic" scale="9" /></filter>'
           f'<radialGradient id="nest"><stop offset="0" stop-color="{p["star"]}" /><stop offset="1" stop-color="{p["star"]}" stop-opacity="0" /></radialGradient>'
           '</defs>']
    # background texture per mode
    if mode == 'membran':
        for i in range(9):
            y0 = 30 + i * 60
            out.append(f'<path d="M -10 {y0} C 90 {y0 - 40} 200 {y0 + 50} 400 {y0 - 10}" stroke="{p["vein"]}" stroke-width="2" fill="none" opacity="0.5">'
                       f'<animate attributeName="stroke-width" dur="1.5s" values="1.5;4;1.5" begin="{i * 0.17:.2f}s" repeatCount="indefinite" /></path>')
    elif mode == 'chitin':
        for r in range(9):
            for c in range(6):
                x, y = c * 70 + (35 if r % 2 else 0), r * 64
                out.append(f'<polygon points="{x},{y + 20} {x + 30},{y} {x + 62},{y + 20} {x + 62},{y + 52} {x + 30},{y + 66} {x},{y + 52}" fill="none" stroke="{p["vein"]}" stroke-width="1.2" opacity="0.6" />')
    elif mode == 'schwarm':
        import random
        rnd = random.Random(5)
        for i in range(140):
            x, y = rnd.uniform(0, w), rnd.uniform(0, h)
            dx, dy = rnd.uniform(-14, 14), rnd.uniform(-14, 14)
            out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="1.3" fill="{p["acc"]}" opacity="0.55"><animateTransform attributeName="transform" type="translate" dur="1.5s" '
                       f'values="0 0;{dx:.0f} {dy:.0f};0 0" repeatCount="indefinite" /></circle>')
    elif mode == 'monolith':
        for i in range(0, w, 26):
            out.append(f'<line x1="{i}" y1="0" x2="{i}" y2="{h}" stroke="{p["vein"]}" stroke-width="0.6" opacity="0.35" />')
        out.append(f'<rect x="0" y="0" width="{w}" height="30" fill="{p["acc"]}" opacity="0.07"><animate attributeName="y" dur="1.5s" values="-30;{h}" repeatCount="indefinite" /></rect>')
    elif mode == 'uhrwerk':
        cx, cy = 190, 300
        for r, d in [(90, '1.5s'), (150, '3s'), (220, '4.5s'), (300, '6s')]:
            out.append(f'<g><circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{p["vein"]}" stroke-width="1" stroke-dasharray="4 10" opacity="0.7" />'
                       f'<animateTransform attributeName="transform" type="rotate" dur="{d}" values="0 {cx} {cy};{24 if r % 2 else -24} {cx} {cy};0 {cx} {cy}" repeatCount="indefinite" /></g>')
    elif mode == 'gitter':
        for r in range(12):
            for c in range(9):
                x, y = c * 46 + (23 if r % 2 else 0), r * 40
                out.append(f'<path d="M {x} {y} l 23 13 l 0 26" stroke="{p["vein"]}" stroke-width="0.8" fill="none" opacity="0.5" />')
        out.append(f'<circle r="3" fill="{p["acc"]}"><animateMotion dur="1.5s" repeatCount="indefinite" path="M 23 13 L 46 0 L 69 13 L 69 39 L 92 52 L 115 39 L 115 13" /></circle>')
    # routes
    def route(x1, y1, x2, y2, col, label, bend, lx, ly, dash='6 4'):
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        cx, cy = mx - (y2 - y1) * bend, my + (x2 - x1) * bend
        anim = '<animate attributeName="stroke-dashoffset" dur="1.5s" values="20;0" repeatCount="indefinite" />'
        r = f'<path d="M {x1} {y1} Q {cx:.0f} {cy:.0f} {x2} {y2}" stroke="{col}" stroke-width="2.4" fill="none" stroke-dasharray="{dash}">{anim}</path>'
        w_ = 7 * len(label) + 14
        r += (f'<rect x="{lx - w_ / 2:.0f}" y="{ly - 10}" width="{w_}" height="19" rx="{9 if p["round"] else 2}" fill="{p["panel"]}" stroke="{col}" />'
              f'<text x="{lx}" y="{ly + 4}" fill="{col}" font-size="11.5" font-family="{p["font"]}" text-anchor="middle">{label}</text>')
        return r
    out.append(route(300, 390, 196, 306, p['war'], p['t_attack'], 0.2, 280, 345))
    out.append(route(120, 200, 184, 290, p['guild'], p['t_hold'], -0.25, 120, 262))
    # systems
    for name, (x, y, occ, kind) in SYS.items():
        big = name == '1:27'
        r = 16 if big else 11
        if mode in ('membran', 'schwarm'):
            out.append(f'<circle cx="{x}" cy="{y}" r="{r + 6}" fill="url(#nest)" opacity="0.55" filter="url(#wob)" />')
            out.append(f'<circle cx="{x}" cy="{y}" r="{6 if big else 4}" fill="{p["star"]}" filter="url(#wob)" />')
        elif mode == 'chitin':
            out.append(f'<polygon points="{x - 6},{y} {x},{y - 7} {x + 6},{y} {x},{y + 7}" fill="{p["star"]}" />')
        elif mode in ('monolith', 'gitter'):
            out.append(f'<rect x="{x - 5}" y="{y - 5}" width="10" height="10" fill="none" stroke="{p["star"]}" stroke-width="2" transform="rotate(45 {x} {y})" />')
        else:
            out.append(f'<circle cx="{x}" cy="{y}" r="5" fill="none" stroke="{p["star"]}" stroke-width="2" /><circle cx="{x}" cy="{y}" r="1.6" fill="{p["star"]}" />')
        if big:
            out.append(f'<circle cx="{x}" cy="{y}" r="{r + 8}" fill="none" stroke="{p["me"]}" stroke-width="1.5" opacity="0.8"'
                       + (' filter="url(#wob)"' if mode in ('membran', 'schwarm') else '') + ' />')
        for pos in occ:
            k = owner(name, pos, kind)
            col = {'me': p['me'], 'g': p['guild'], 'w': p['war'], 'o': p['other']}[k]
            a = -math.pi / 2 + (pos - 1) * 2 * math.pi / 15
            px, py = x + r * math.cos(a), y + r * math.sin(a)
            if mode == 'chitin':
                out.append(f'<polygon points="{px - 3.5:.1f},{py:.1f} {px:.1f},{py - 3.5:.1f} {px + 3.5:.1f},{py:.1f} {px:.1f},{py + 3.5:.1f}" fill="{col}" />')
            elif mode in ('monolith', 'gitter', 'uhrwerk'):
                out.append(f'<rect x="{px - 2.8:.1f}" y="{py - 2.8:.1f}" width="5.6" height="5.6" fill="{col}" />')
            else:
                out.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{3.4 if big else 2.7}" fill="{col}" />')
        out.append(f'<text x="{x + (24 if big else 16)}" y="{y + 4}" fill="{p["txt"] if big else p["dim"]}" font-size="{12 if big else 10.5}" font-family="{p["font"]}">'
                   f'{name}{p["mine"] if big else ""}</text>')
    out.append('</svg>')
    return ''.join(out)


def chrome(p, mode):
    pills = ''.join(f'<span class="r-pill"><img src="{RES}{i}.svg" alt="" />{v}</span>' for i, v in [('metal', '184 k'), ('crystal', '92 k'), ('deuterium', '41 k')])
    tabs = ''.join(f'<span class="r-tab{" on" if i == 0 else ""}">{t}</span>' for i, t in enumerate(p['tabs']))
    tags = ''.join(f'<span class="r-tag" style="color: {c}; border-color: {c}">{t}</span>' for t, c in [(p['t_attack'].upper(), p['war']), (p['t_store'], p['acc2']), (p['t_rep'], p['guild'])])
    return (f'<div class="r-top">{pills}<span class="r-pill" style="margin-left: auto">{p["galaxy"]}</span></div>'
            f'<div class="r-sheet"><div class="r-grip"></div><div class="r-row"><b>{p["lage"]} ▴</b>{tags}</div></div>'
            f'<div class="r-tabs">{tabs}</div>')


def css(p, mode):
    radius = {'membran': '28px 22px 30px 18px', 'chitin': '4px', 'schwarm': '20px', 'monolith': '0', 'uhrwerk': '14px', 'gitter': '0'}[mode]
    clip = {'monolith': 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
            'gitter': 'polygon(18px 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 18px 100%, 0 50%)',
            'chitin': 'polygon(0 10px, 10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)'}.get(mode, 'none')
    anim = ''
    if mode == 'membran':
        anim = ('@keyframes morph { 0% { border-radius: 30px 18px 34px 20px / 22px 30px 18px 28px } 50% { border-radius: 18px 34px 20px 30px / 30px 18px 28px 22px } '
                '100% { border-radius: 30px 18px 34px 20px / 22px 30px 18px 28px } } '
                '@keyframes beat { 0%, 100% { box-shadow: 0 0 14px rgb(182 224 74 / 0.25) } 40% { box-shadow: 0 0 30px rgb(182 224 74 / 0.55) } } '
                '.r-sheet, .r-pill, .r-tag { animation: morph 1.5s ease-in-out infinite } .r-sheet { animation: morph 1.5s ease-in-out infinite, beat 1.5s ease-in-out infinite } '
                '.r-tab.on { animation: morph 1.5s infinite }')
    elif mode == 'chitin':
        anim = ('@keyframes breathe { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.012) } } '
                '@keyframes seam { 0%, 100% { border-color: #5a3a18 } 50% { border-color: #e0a640 } } '
                '.r-sheet { animation: breathe 1.5s ease-in-out infinite, seam 1.5s infinite } .r-pill { animation: seam 1.5s infinite }')
    elif mode == 'schwarm':
        anim = ('@keyframes crawl { to { background-position: 40px 0 } } '
                '.r-sheet, .r-pill { border-style: dotted; background-image: radial-gradient(circle, rgb(182 224 74 / 0.25) 1px, transparent 1.5px); '
                'background-size: 8px 8px; animation: crawl 1.5s linear infinite }')
    elif mode == 'monolith':
        anim = ('@keyframes glow { 0%, 100% { box-shadow: inset 0 0 0 1px rgb(127 224 240 / 0.4) } 50% { box-shadow: inset 0 0 0 1px rgb(127 224 240 / 0.9), 0 0 16px rgb(127 224 240 / 0.3) } } '
                '.r-sheet, .r-pill { animation: glow 1.5s ease-in-out infinite }')
    elif mode == 'uhrwerk':
        anim = ('@keyframes tick { to { background-position: 60px 0 } } '
                '.r-sheet { background-image: repeating-linear-gradient(90deg, transparent 0 10px, rgb(201 210 220 / 0.08) 10px 12px); animation: tick 1.5s steps(6) infinite }')
    elif mode == 'gitter':
        anim = ('@keyframes facet { 0%, 100% { filter: brightness(1) } 50% { filter: brightness(1.25) } } .r-sheet, .r-tab.on { animation: facet 1.5s ease-in-out infinite }')
    return (f':root {{ color-scheme: dark }} body {{ margin: 0; background: #050405 }} '
            f'.r-phone {{ width: {W}px; height: {H}px; position: relative; overflow: hidden; border-radius: 32px; border: 1px solid {p["line"]}; background: {p["bg"]}; font-family: {p["font"]}; color: {p["txt"]} }} '
            f'.r-top {{ position: absolute; left: 0; right: 0; top: 0; padding: 30px 10px 8px; display: flex; gap: 6px; align-items: center; background: {p["panel"]}; border-bottom: 1px solid {p["line"]}; z-index: 3 }} '
            f'.r-pill {{ display: inline-flex; gap: 5px; align-items: center; border: 1px solid {p["line"]}; border-radius: {radius}; padding: 3px 10px; font-size: 13px; background: {p["panel2"]}; clip-path: {clip} }} '
            f'.r-pill img {{ width: 15px; height: 15px; filter: {p["iconf"]} }} '
            f'.r-sheet {{ position: absolute; left: 4px; right: 4px; top: 642px; bottom: 64px; background: {p["panel"]}; border: 1.5px solid {p["acc"]}; border-radius: {radius}; padding: 6px 12px; z-index: 3; clip-path: {clip} }} '
            f'.r-grip {{ width: 40px; height: 4px; border-radius: 2px; background: {p["acc"]}; opacity: 0.6; margin: 0 auto 6px }} '
            f'.r-row {{ display: flex; gap: 6px; align-items: center; font-size: 12px; white-space: nowrap; overflow: hidden }} .r-row b {{ color: {p["acc"]}; letter-spacing: {p["ls"]} }} '
            f'.r-tag {{ border: 1px solid; border-radius: {radius}; padding: 1px 6px; font-size: 10.5px; letter-spacing: 0.04em }} '
            f'.r-tabs {{ position: absolute; left: 0; right: 0; bottom: 0; height: 62px; display: grid; grid-template-columns: repeat(5, 1fr); background: {p["panel"]}; border-top: 1px solid {p["line"]}; z-index: 3 }} '
            f'.r-tab {{ display: grid; place-items: center; font-size: 11.5px; color: {p["dim"]}; letter-spacing: {p["ls"]} }} '
            f'.r-tab.on {{ color: {p["acc"]}; background: {p["panel2"]}; border-radius: {radius}; margin: 8px 4px }} '
            f'.r-name {{ position: absolute; left: 12px; top: 104px; z-index: 2; font-size: 11.5px; color: {p["dim"]}; letter-spacing: {p["ls"]} }} ' + anim)


BRUT = dict(bg='radial-gradient(ellipse at 40% 45%, #2a0f22, #0d0710 70%)', panel='#1a0c18', panel2='#2a1226', line='#4a1a3a', txt='#f0e0e8', dim='#b090a8',
            acc='#b6e04a', acc2='#e0c64a', star='#e05a7a', vein='#5a1a3a', me='#b6e04a', guild='#5ad0b0', war='#ff5a4a', other='#9a7a9a',
            font="'EB Garamond', Georgia, serif", ls='0.02em', round=True, iconf='hue-rotate(250deg) saturate(1.4)',
            tabs=['Brutstätten', 'Nest', 'Schwärme', 'Spuren', 'Mehr'], lage='Witterung', t_attack='Angriff 14:32', t_hold='Mira hält', t_store='SPEICHER 1 h 40',
            t_rep='3 SPUREN', galaxy='Jagdgrund 1 ▾', mine=' · dein Nest, 3 Brutwelten')
EWIGE = dict(bg='linear-gradient(#0b1220, #05080e)', panel='#0d141c', panel2='#141e2a', line='#2a3a4a', txt='#dce6f0', dim='#7f93a8',
             acc='#7fe0f0', acc2='#c9d2dc', star='#c9d2dc', vein='#1f3a4a', me='#7fe0f0', guild='#9ad08a', war='#ff7a6a', other='#6f8296',
             font="'DejaVu Sans', 'Segoe UI', sans-serif", ls='0.14em', round=False, iconf='grayscale(1) brightness(1.4)',
             tabs=['KARTE', 'WELT', 'FLOTTE', 'PROTOKOLL', 'MEHR'], lage='LAGE', t_attack='Angriff 14:32', t_hold='Mira hält', t_store='SPEICHER 1 h 40',
             t_rep='3 PROTOKOLLE', galaxy='SEKTOR 1 ▾', mine=' · 3 WELTEN')

VARIANTS = {
    'brut': [('a', 'membran'), ('b', 'chitin'), ('c', 'schwarm')],
    'ewige': [('a', 'monolith'), ('b', 'uhrwerk'), ('c', 'gitter')],
}


def page(race, letter, mode):
    p = BRUT if race == 'brut' else EWIGE
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Rasse</title>\n<link rel="stylesheet" href="/style.css" />\n'
            f'<style>{css(p, mode)}</style>\n</head>\n<body>\n<div class="r-phone" id="ph">' + mapsvg(p, mode) + chrome(p, mode) + '</div>\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest', 'race')
    os.makedirs(out, exist_ok=True)
    for race, vs in VARIANTS.items():
        for letter, mode in vs:
            with open(os.path.join(out, f'{race}-{letter}.html'), 'w', encoding='utf-8') as f:
                f.write(page(race, letter, mode))
    print('wrote race pages')
