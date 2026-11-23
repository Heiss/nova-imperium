"""Playtest round 1, situations s1s (system view) and s2m (content of the
pull-up dashboard) – proposal only.

[E] 2026-11-23: the dashboard is a sheet that can be pulled up and down
everywhere. So s2m keeps the sheet and varies only its content; s1s shows
the system 1:27 with the player's three worlds after zooming in.
"""
import math
import os

from kit import I, RES, ball, g, galaxy_svg, phone, pill, tag
from playtest_r1m import GUILD, OTHER, OWN, WAR, header, sheet, tabs

W = 390


def mapbg(dim=0.0):
    d = f'<div class="k-abs" style="inset: 0; background: rgb(0 0 0 / {dim})"></div>' if dim else ''
    return ('<div class="k-stars" style="position: absolute; inset: 0"></div>'
            f'<div class="k-abs" style="left: -440px; top: 110px">{galaxy_svg(1280, 620)}</div>' + d)


def pulled(height, body):
    """The dashboard sheet pulled up."""
    return (f'<div class="k-abs" style="left: 0; right: 0; bottom: 62px; height: {height}px; background: #17110d; border-top: 1px solid var(--gold); '
            'border-radius: 16px 16px 0 0; box-shadow: 0 -10px 30px rgb(0 0 0 / 0.7); padding: 6px 12px; z-index: 3; overflow: hidden">'
            '<div style="width: 40px; height: 4px; border-radius: 2px; background: var(--line); margin: 0 auto 6px"></div>' + body + '</div>')


def sec(t, n=''):
    return f'<div style="font: 600 11.5px var(--head); letter-spacing: 0.1em; color: var(--gold); margin: 8px 0 3px">{t} <span class="m-dim">{n}</span></div>'


# ------------------------------------------------------------------ s2m: dashboard content in the pulled-up sheet
def s2m(e):
    if e == 'a':
        cats = ''.join(f'{sec("▾ " + c, n)}<div style="font-size: 13px">{b}</div>'
                       for c, n, b in [('ANGEHEFTET', '1', '📌 Nox: Angriff 14:32 – Abwehr prüfen'), ('KÄMPFE', '1', 'Nox verteidigt · Sieg · 03:12'),
                                       ('FORSCHUNG', '1', 'Waffensegnung 11 fertig · 05:40'), ('DIE ANDEREN', '3', 'Mira hält Nox · Leander kolonisiert 1:44 · Valcor ▲ Platz 1'),
                                       ('BEFUNDE', '5', '<span class="m-dim">3 Spionageberichte, 2 Flotten zurück (gebündelt)</span>')])
        worlds = ''.join(f'<div style="display: grid; grid-template-columns: 24px 1fr auto; gap: 6px; align-items: center; margin: 4px 0; font-size: 13px">{ball(k, n, 22)}'
                         f'<div><b>{nm}</b><div class="m-prog" style="height: 3px"><i style="width: {p}%"></i></div></div><span style="color: var(--{c})">{t}</span></div>'
                         for k, n, nm, p, c, t in [('normal', 1, 'Aurelia', 64, 'dim', 'Steinbruch 22 min'), ('wasser', 0, 'Nox', 0, 'red', 'Bau leer'), ('dschungel', 2, 'Vesper', 80, 'dim', 'Tiefbohrung 1 h')])
        body = '<b style="color: var(--gold-hi)">Lage · seit gestern 22:14</b>' + cats + sec('DEINE WELTEN') + worlds
    elif e == 'b':
        def row(t, txt, c='', past=True, who=''):
            dot = f'<span style="position: absolute; left: -17px; top: 5px; width: 9px; height: 9px; border-radius: 50%; background: var(--{c or ("dim" if past else "gold")})"></span>'
            w = f'<span class="m-dim">{who} </span>' if who else ''
            return (f'<div style="position: relative; display: grid; grid-template-columns: 44px 1fr; gap: 6px; font-size: 13px; margin: 5px 0;{" opacity: 0.8" if past else ""}">'
                    f'{dot}<b class="m-num" style="color: var(--{"dim" if past else "txt"})">{t}</b><span>{w}{txt}</span></div>')
        past = (row('03:12', 'Nox verteidigt · Sieg', 'green') + row('05:40', 'Waffensegnung 11 fertig', 'c') + row('07:02', '2 Transporte zurück')
                + row('08:30', '3 Spionageberichte') + row('12:58', 'gründet Kolonie in 1:44', who='Leander'))
        now = ('<div style="position: relative; margin: 6px 0; border-top: 2px solid var(--gold); text-align: center">'
               '<span style="position: relative; top: -10px; background: #17110d; padding: 0 8px; font: 600 12px var(--head); color: var(--gold-hi)">JETZT 13:20</span></div>')
        fut = (row('13:42', 'Psikristall-Steinbruch 16 fertig', past=False) + row('13:50', 'Transport kommt auf Vesper an', 'green', False)
               + row('14:32', '<b style="color: var(--red)">Angriff Haus Valcor auf Nox</b> · Mira hält', 'red', False)
               + row('15:00', 'Psikristall-Lager voll', 'orange', False) + row('16:32', 'Warp-Antrieb 5 fertig', 'c', False))
        body = ('<b style="color: var(--gold-hi)">Lage · Zeitleiste</b>'
                '<div style="margin: 6px 0 0 20px; border-left: 2px solid var(--line); padding-left: 10px">' + past + now + fut + '</div>')
    else:
        def act(c, t, d, b1, b2=''):
            return (f'<div style="border: 1px solid var(--{c}); border-radius: 8px; padding: 8px; margin: 6px 0">'
                    f'<b style="color: var(--{c})">{t}</b><div style="font-size: 13px; margin: 2px 0 6px">{d}</div>'
                    f'<div style="display: flex; gap: 6px"><span class="m-btn">{b1}</span>{f"<span class=m-btn style=background:none;color:var(--gold-hi)>{b2}</span>" if b2 else ""}</div></div>')
        body = ('<b style="color: var(--gold-hi)">Jetzt handeln</b>'
                + act('red', 'Nox wird um 14:32 angegriffen', 'Haus Valcor, Flotte ≥ 8 Schiffe · Mira hält mit 40 Jägern · dein Bauplatz ist leer', 'Abwehr bauen', 'Flotte abziehen')
                + act('orange', 'Psikristall-Lager voll in 1 h 40', 'Psikristall-Reliquiar 1 kostet 1.000 / 500', 'Reliquiar bauen')
                + sec('LÄUFT') + '<div style="font-size: 13px">Steinbruch 16 · 22 min · Warp-Antrieb 5 · 3 h 12 · 12 Fregatten · 1 h</div>'
                + sec('DIE ANDEREN') + '<div style="font-size: 13px; line-height: 1.6">Mira hält Nox · Leander kolonisiert 1:44 · Haus Valcor ▲ Platz 1</div>')
    return phone(mapbg(0.35) + header() + pulled(560, body) + tabs())


# ------------------------------------------------------------------ s1s: zoomed into the own system 1:27
POS = {4: ('wasser', 0, 'Nox', OWN, 'Angriff 14:32', 'bad'), 8: ('normal', 1, 'Aurelia', OWN, 'Lager 1 h 40', 'warn'),
       11: ('dschungel', 2, 'Vesper', OWN, 'Transport 13:50', 'ok'), 14: ('gas', 0, 'Stiller Hafen', OTHER, 'Leander', '')}


def s1s(e):
    top = 96
    if e == 'a':
        h = 640 - top
        cx, cy = 18, h / 2
        svg = [f'<svg width="{W}" height="{h}" viewBox="0 0 {W} {h}">',
               f'<circle cx="{cx}" cy="{cy}" r="42" fill="#f3d36b" opacity="0.9" /><circle cx="{cx}" cy="{cy}" r="70" fill="#f0a050" opacity="0.12" />']
        place = {}
        for p in range(1, 16):
            r = 52 + p * 21
            a = -0.95 + (p - 1) * 0.135
            x, y = cx + r * math.cos(a), cy + r * math.sin(a)
            place[p] = (x, y)
            svg.append(f'<path d="M {cx + r * math.cos(-1.05):.0f} {cy + r * math.sin(-1.05):.0f} A {r} {r} 0 0 1 {cx + r * math.cos(1.05):.0f} {cy + r * math.sin(1.05):.0f}" stroke="#3b2f22" fill="none" />')
            if p not in POS:
                svg.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="3" fill="#4b3c2c" />')
        svg.append('</svg>')
        balls = ''
        for p, (k, n, nm, col, st, bc) in POS.items():
            x, y = place[p]
            sz = 38 if col == OWN else 26
            balls += (f'<div class="k-abs" style="left: {x - sz / 2:.0f}px; top: {top + y - sz / 2:.0f}px; z-index: 1">{ball(k, n, sz)}</div>'
                      f'<div class="k-abs" style="left: {x + sz / 2 + 4:.0f}px; top: {top + y - 16:.0f}px; z-index: 1; font-size: 12px; line-height: 1.25">'
                      f'<b style="color: {"#f1d27a" if col == OWN else "#e9dfc8"}">{p} · {nm}</b><br />'
                      + (f'<span class="k-bubble {bc}" style="position: static">{st}</span>' if bc else f'<span class="m-dim">{st}</span>') + '</div>')
        hint = '<div class="k-abs" style="left: 10px; top: 104px; z-index: 2"><span class="k-pill">Galaxie 1 › System 1:27 · 4 von 15 besetzt</span></div>'
        body = '<div class="k-stars" style="position: absolute; inset: 0"></div>' + f'<div class="k-abs" style="left: 0; top: {top}px">{"".join(svg)}</div>' + balls + hint
    elif e == 'b':
        rows = ''
        for p in range(1, 16):
            if p in POS:
                k, n, nm, col, st, bc = POS[p]
                own = col == OWN
                rows += (f'<div style="display: grid; grid-template-columns: 20px 30px 1fr auto; gap: 8px; align-items: center; padding: 4px 6px; border-radius: 6px;{" background: rgb(111 184 255 / 0.1)" if own else ""}">'
                         f'<b class="m-dim">{p}</b>{ball(k, n, 28)}<div><b style="color: {"#f1d27a" if own else "#e9dfc8"}">{nm}</b> <span class="m-dim" style="font-size: 12px">{"du" if own else st}</span></div>'
                         + (f'<span class="k-bubble {bc}" style="position: static">{st}</span>' if bc and own else '<span class="m-dim">⋯</span>') + '</div>')
            else:
                rows += f'<div style="display: grid; grid-template-columns: 20px 1fr auto; gap: 8px; padding: 2px 6px; font-size: 12px; color: var(--dim)"><b>{p}</b><span>frei</span><span>besiedeln ›</span></div>'
        body = ('<div class="k-stars" style="position: absolute; inset: 0"></div><div style="position: relative; padding: 100px 10px 0">'
                '<div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px"><b style="font: 800 17px var(--head); color: var(--gold)">System 1:27</b>'
                '<span class="m-dim" style="font-size: 12.5px">‹ 1:26 · 1:28 ›</span></div>' + rows + '</div>')
    else:
        h = 640 - top
        cx, cy = W / 2, h / 2 + 4
        svg = [f'<svg width="{W}" height="{h}" viewBox="0 0 {W} {h}">',
               f'<circle cx="{cx}" cy="{cy}" r="150" fill="none" stroke="#3b2f22" stroke-width="22" opacity="0.55" />',
               f'<circle cx="{cx}" cy="{cy}" r="38" fill="#f3d36b" opacity="0.85" /><circle cx="{cx}" cy="{cy}" r="62" fill="#f0a050" opacity="0.1" />',
               f'<text x="{cx}" y="{cy - 2}" text-anchor="middle" font-size="14" font-family="Georgia" fill="#120d0a" font-weight="700">1:27</text>',
               f'<text x="{cx}" y="{cy + 14}" text-anchor="middle" font-size="10.5" font-family="Georgia" fill="#120d0a">3 Welten</text>']
        place = {}
        for p in range(1, 16):
            a = -math.pi / 2 + (p - 1) * 2 * math.pi / 15
            x, y = cx + 150 * math.cos(a), cy + 150 * math.sin(a)
            place[p] = (x, y)
            if p not in POS:
                svg.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="5" fill="#2a211a" stroke="#4b3c2c" />'
                           f'<text x="{x:.0f}" y="{y + 3:.0f}" text-anchor="middle" font-size="7.5" fill="#a8997f" font-family="Georgia">{p}</text>')
        svg.append('</svg>')
        balls = ''
        for p, (k, n, nm, col, st, bc) in POS.items():
            x, y = place[p]
            sz = 46 if col == OWN else 30
            balls += (f'<div class="k-abs" style="left: {x - sz / 2:.0f}px; top: {top + y - sz / 2:.0f}px; z-index: 1; border-radius: 50%; box-shadow: 0 0 0 3px {col}">{ball(k, n, sz)}</div>'
                      f'<div class="k-abs" style="left: {x - 60:.0f}px; top: {top + y + sz / 2 + 2:.0f}px; width: 120px; text-align: center; z-index: 1; font-size: 11.5px">'
                      f'<b style="color: {"#f1d27a" if col == OWN else "#e9dfc8"}">{p} · {nm}</b>'
                      + (f'<br /><span class="k-bubble {bc}" style="position: static">{st}</span>' if bc else '') + '</div>')
        body = '<div class="k-stars" style="position: absolute; inset: 0"></div>' + f'<div class="k-abs" style="left: 0; top: {top}px">{"".join(svg)}</div>' + balls
    return phone(body + header() + sheet() + tabs())


SITS = {'s1s': s1s, 's2m': s2m}


def build_sheet():
    parts = [f'<figure id="r1-{sid}-{e}" style="margin: 0; display: inline-block">{fn(e)}</figure>' for sid, fn in SITS.items() for e in 'abc']
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest r1x</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-wrap: wrap; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'r1x-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/r1x-sheet.html')
