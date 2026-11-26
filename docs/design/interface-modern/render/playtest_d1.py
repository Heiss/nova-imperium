"""Playtest desktop round d1 – the round-1 winners on a desktop screen.

[E] 2026-11-23: the game must be fully playable on the phone and on the
desktop; the owner plays mostly on the desktop (answers of round 1). The
three variants derive the desktop from the chosen phone views in three
ways; content is the same in all three (pip map [E], names on tap [E],
Lage as a timeline [E], the same colours):

a  side panel – the Lage timeline is a fixed column on the right, the tab
   bar becomes an icon rail on the left;
b  sheet as on the phone – the Lage sheet stays at the bottom (wider), the
   tab bar moves to the top;
c  windows – the map fills the screen; Lage and the system open as
   movable windows over it.

Proposal only.
"""
import math
import os

from kit import ball, g, pill
from playtest_r1m import GUILD, OTHER, OWN, WAR, bg_stars, pips, route

DW, DH = 1280, 720
TOPBAR = 52

SYSTEMS = {  # name: (fx, fy, occupied positions)
    '1:12': (0.07, 0.42, [(3, OTHER)]), '1:18': (0.93, 0.12, [(5, OTHER)]), '1:21': (0.55, 0.11, [(2, OTHER)]),
    '1:24': (0.18, 0.17, [(5, OTHER), (9, OTHER)]), '1:26': (0.30, 0.38, [(7, GUILD), (12, OTHER)]),
    '1:27': (0.45, 0.56, [(4, OWN), (8, OWN), (11, OWN), (14, OTHER)]), '1:29': (0.71, 0.29, [(6, OTHER)]),
    '1:31': (0.67, 0.66, [(3, WAR), (5, WAR), (9, WAR)]), '1:33': (0.33, 0.88, []), '1:35': (0.16, 0.72, [(8, OTHER), (10, OTHER)]),
    '1:38': (0.88, 0.46, [(1, OTHER), (7, OTHER)]), '1:40': (0.58, 0.90, []), '1:44': (0.86, 0.82, [(4, WAR), (6, GUILD), (8, OTHER)])}


def galaxy(w, h, tip=True, routes=True):
    """The pip map [E] on a desktop area of w x h; names appear on tap [E] (here: the hover/tap card on 1:31)."""
    P = {n: (fx * w, fy * h) for n, (fx, fy, _) in SYSTEMS.items()}
    s = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}">', bg_stars(int(w * h / 2600), w, h, 7)]
    (x1, y1), (x0, y0), (xg, yg), (xs, ys) = P['1:31'], P['1:27'], P['1:26'], P['1:44']
    if routes is True:
        s.append(route(x1, y1, x0 + 10, y0 + 6, WAR, 'Angriff 14:32', 0.2, lx=(x1 + x0) / 2 + 10, ly=(y1 + y0) / 2 + 40))
        s.append(route(xg, yg, x0 - 8, y0 - 10, GUILD, 'Mira hält', -0.25))
        s.append(route(x0 + 8, y0 + 12, xs, ys, '#f1d27a', 'Spionage 4 min', -0.25, '2 4', lx=x0 + 0.62 * (xs - x0) + 70, ly=y0 + 0.62 * (ys - y0) + 52))
    if callable(routes):
        s.append(routes(P))
    for n, (fx, fy, occ) in SYSTEMS.items():
        x, y = P[n]
        big = n == '1:27'
        if occ or big:
            s.append(pips(round(x), round(y), occ, 20 if big else 14, big))
        else:
            s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="3.5" fill="#8a7a5c" />')
        tx, ty = (x - 30, y - 32) if big else (x + 20, y + 4)
        s.append(f'<text x="{tx:.0f}" y="{ty:.0f}" fill="{"#f1d27a" if big else "#a8997f"}" font-size="{13 if big else 11.5}" '
                 f'font-family="Georgia">{n}{" · deine 3 Welten" if big else ""}</text>')
    s.append('</svg>')
    out = ''.join(s)
    if tip:
        x, y = P['1:31']
        out += (f'<div class="k-abs" style="left: {x + 22:.0f}px; top: {y - 118:.0f}px; z-index: 2; width: 210px; background: #17110d; border: 1px solid {WAR}; '
                'border-radius: 8px; padding: 8px 10px; font-size: 13px; box-shadow: 0 6px 18px rgb(0 0 0 / 0.6)">'
                f'<b style="color: {WAR}">System 1:31</b> <span class="m-dim">· 3 von 15</span>'
                f'<div style="margin-top: 3px">Haus Valcor · <span style="color: {WAR}">Krieg</span> · aktiv</div>'
                '<div class="m-dim" style="font-size: 12px; margin-top: 3px">Klick: ins System</div></div>')
    return out


def legend():
    return ('<span style="font-size: 12.5px">'
            f'<span style="color: {OWN}">●</span> du <span style="color: {GUILD}">●</span> Gilde '
            f'<span style="color: {WAR}">●</span> Krieg <span style="color: {OTHER}">●</span> andere</span>')


def topbar(left=0, tabs=False):
    t = ''
    if tabs:
        t = ''.join(f'<span style="display: flex; gap: 6px; align-items: center; color: var(--{"gold-hi" if i == 0 else "dim"}); '
                    f'{"border-bottom: 2px solid var(--gold); " if i == 0 else ""}padding: 14px 4px 12px">{g(ic, 18)} {nm}</span>'
                    for i, (ic, nm) in enumerate([('map', 'Karte'), ('planet', 'Welten'), ('fleet', 'Flotten'), ('reports', 'Berichte'), ('menu', 'Menü')]))
        t = f'<div style="display: flex; gap: 18px; margin-left: 18px; font-size: 14px">{t}</div>'
    return (f'<div class="k-abs" style="left: {left}px; right: 0; top: 0; height: {TOPBAR}px; display: flex; gap: 8px; align-items: center; padding: 0 14px; '
            'background: rgb(18 13 10 / 0.94); border-bottom: 1px solid var(--line); z-index: 4">'
            '<b style="font: 800 15px var(--head); color: var(--gold); letter-spacing: 0.06em; margin-right: 8px">NOVA IMPERIUM</b>'
            + pill('metal', '184 k') + pill('crystal', '<span style="color: var(--orange)">92 k</span>') + pill('deuterium', '41 k') + t
            + '<span style="margin-left: auto; display: flex; gap: 10px; align-items: center">' + legend()
            + '<span class="k-pill">Galaxie 1 ▾</span><b class="m-num" style="color: var(--gold-hi)">13:20</b></span></div>')


def rail():
    items = ''.join(f'<span title="{nm}" style="display: grid; place-items: center; height: 54px; color: var(--{"gold-hi" if i == 0 else "dim"}); '
                    f'{"border-left: 3px solid var(--gold); background: rgb(212 165 55 / 0.08); " if i == 0 else ""}">{g(ic, 24)}</span>'
                    for i, (ic, nm) in enumerate([('map', 'Karte'), ('planet', 'Welten'), ('fleet', 'Flotten'), ('reports', 'Berichte'), ('menu', 'Menü')]))
    return (f'<div class="k-abs" style="left: 0; top: {TOPBAR}px; bottom: 0; width: 64px; background: #110c09; border-right: 1px solid var(--line); '
            f'z-index: 4; padding-top: 8px">{items}</div>')


def chat():
    return ('<div class="k-abs" style="right: 16px; bottom: 14px; z-index: 5; display: flex; gap: 6px; align-items: center; background: #17110d; '
            'border: 1px solid var(--gold); border-radius: 18px; padding: 6px 12px; font-size: 13px">💬 Chat <span class="m-tag red">2</span></div>')


def row(t, txt, c='', past=True, who=''):
    dot = f'<span style="position: absolute; left: -17px; top: 5px; width: 9px; height: 9px; border-radius: 50%; background: var(--{c or ("dim" if past else "gold")})"></span>'
    w = f'<span class="m-dim">{who} </span>' if who else ''
    return (f'<div style="position: relative; display: grid; grid-template-columns: 44px 1fr; gap: 6px; font-size: 13px; margin: 5px 0;{" opacity: 0.8" if past else ""}">'
            f'{dot}<b class="m-num" style="color: var(--{"dim" if past else "txt"})">{t}</b><span>{w}{txt}</span></div>')


PAST = [('03:12', 'Nox verteidigt · Sieg', 'green', ''), ('05:40', 'Waffensegnung 11 fertig', 'c', ''), ('07:02', '2 Transporte zurück', '', ''),
        ('08:30', '3 Spionageberichte', '', ''), ('12:58', 'gründet Kolonie in 1:44', '', 'Leander')]
FUTURE = [('13:42', 'Psikristall-Steinbruch 16 fertig', ''), ('13:50', 'Transport kommt auf Vesper an', 'green'),
          ('14:32', '<b style="color: var(--red)">Angriff Haus Valcor auf Nox</b> · Mira hält', 'red'),
          ('15:00', 'Psikristall-Lager voll', 'orange'), ('16:32', 'Warp-Antrieb 5 fertig', 'c')]


def now_line(bg='#17110d'):
    return ('<div style="position: relative; margin: 8px 0; border-top: 2px solid var(--gold); text-align: center">'
            f'<span style="position: relative; top: -10px; background: {bg}; padding: 0 8px; font: 600 12px var(--head); color: var(--gold-hi)">JETZT 13:20</span></div>')


def timeline(bg='#17110d'):
    past = ''.join(row(t, x, c, True, w) for t, x, c, w in PAST)
    fut = ''.join(row(t, x, c, False) for t, x, c in FUTURE)
    return '<div style="margin: 6px 0 0 20px; border-left: 2px solid var(--line); padding-left: 10px">' + past + now_line(bg) + fut + '</div>'


def stars_bg():
    return '<div class="k-stars" style="position: absolute; inset: 0"></div>'


# ------------------------------------------------------------------ a: side panel
def va():
    mw, mh = DW - 64 - 360, DH - TOPBAR
    side = (f'<div class="k-abs" style="right: 0; top: {TOPBAR}px; bottom: 0; width: 360px; background: #17110d; border-left: 1px solid var(--gold); '
            'z-index: 3; padding: 12px 14px; overflow: hidden">'
            '<div style="display: flex; align-items: baseline; gap: 8px"><b style="font: 800 16px var(--head); color: var(--gold-hi)">Lage</b>'
            '<span class="m-dim" style="font-size: 12.5px">Zeitleiste · immer offen</span></div>' + timeline() + '</div>')
    return (stars_bg() + f'<div class="k-abs" style="left: 64px; top: {TOPBAR}px">{galaxy(mw, mh)}</div>' + side + rail()
            + topbar(0) + chat().replace('right: 16px', 'right: 376px'))


# ------------------------------------------------------------------ b: sheet as on the phone
def vb():
    mw, mh = DW, DH - TOPBAR
    left = ''.join(row(t, x, c, True, w) for t, x, c, w in PAST[2:])
    right = ''.join(row(t, x, c, False) for t, x, c in FUTURE[:4])
    sheet = ('<div class="k-abs" style="left: 50%; transform: translateX(-50%); bottom: 0; width: 780px; height: 236px; background: #17110d; '
             'border: 1px solid var(--gold); border-bottom: 0; border-radius: 16px 16px 0 0; box-shadow: 0 -10px 30px rgb(0 0 0 / 0.7); z-index: 3; padding: 6px 16px">'
             '<div style="width: 46px; height: 4px; border-radius: 2px; background: var(--line); margin: 0 auto 6px"></div>'
             '<div style="display: flex; align-items: baseline; gap: 8px"><b style="font: 800 15px var(--head); color: var(--gold-hi)">Lage ▾</b>'
             '<span class="m-dim" style="font-size: 12.5px">halb hochgezogen · ganz unten bleibt eine Zeile</span></div>'
             '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 4px">'
             f'<div><div class="m-dim" style="font: 600 11.5px var(--head); letter-spacing: 0.1em">BIS JETZT</div><div style="margin-left: 18px; border-left: 2px solid var(--line); padding-left: 10px">{left}</div></div>'
             f'<div><div style="font: 600 11.5px var(--head); letter-spacing: 0.1em; color: var(--gold)">AB JETZT 13:20</div><div style="margin-left: 18px; border-left: 2px solid var(--gold); padding-left: 10px">{right}</div></div>'
             '</div></div>')
    # the map re-centres on what the half-pulled sheet leaves visible
    return stars_bg() + f'<div class="k-abs" style="left: 0; top: {TOPBAR}px">{galaxy(mw, mh - 236)}</div>' + sheet + topbar(0, tabs=True) + chat()


# ------------------------------------------------------------------ c: windows
def window(x, y, w, h, title, body, z=3):
    return (f'<div class="k-abs" style="left: {x}px; top: {y}px; width: {w}px; height: {h}px; z-index: {z}; background: #17110d; border: 1px solid var(--gold); '
            'border-radius: 8px; box-shadow: 0 10px 30px rgb(0 0 0 / 0.7); overflow: hidden">'
            '<div style="display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #211812; border-bottom: 1px solid var(--line); cursor: move">'
            f'<span class="m-dim">⠿</span><b style="font: 700 13.5px var(--head); color: var(--gold-hi)">{title}</b>'
            '<span class="m-dim" style="margin-left: auto">–  ✕</span></div>'
            f'<div style="padding: 6px 12px; position: relative">{body}</div></div>')


def system_mini(w, h):
    cx, cy = 14, h / 2
    s = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}">', f'<circle cx="{cx}" cy="{cy}" r="30" fill="#f3d36b" opacity="0.9" />']
    pos = {4: ('wasser', 0, 'Nox', OWN, 'Angriff 14:32', 'bad'), 8: ('normal', 1, 'Aurelia', OWN, 'Lager 1 h 40', 'warn'),
           11: ('dschungel', 2, 'Vesper', OWN, 'Transport 13:50', 'ok'), 14: ('gas', 0, 'Stiller Hafen', OTHER, 'Leander · aktiv', '')}
    html = ''
    for p in range(1, 16):
        r = 30 + p * 13
        a = -0.75 + (p - 1) * 0.1
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        s.append(f'<path d="M {cx + r * math.cos(-0.85):.0f} {cy + r * math.sin(-0.85):.0f} A {r} {r} 0 0 1 {cx + r * math.cos(0.85):.0f} {cy + r * math.sin(0.85):.0f}" stroke="#3b2f22" fill="none" />')
        if p in pos:
            k, n, nm, col, st, bc = pos[p]
            sz = 30 if col == OWN else 22
            html += (f'<div class="k-abs" style="left: {x - sz / 2 + 12:.0f}px; top: {y - sz / 2 + 6:.0f}px">{ball(k, n, sz)}</div>'
                     f'<div class="k-abs" style="left: {x + sz / 2 + 16:.0f}px; top: {y - 9:.0f}px; font-size: 12px; white-space: nowrap">'
                     f'<b style="color: {"#f1d27a" if col == OWN else "#e9dfc8"}">{p} · {nm}</b> '
                     + (f'<span class="k-bubble {bc}" style="position: static">{st}</span>' if bc else f'<span class="m-dim">{st}</span>') + '</div>')
        else:
            s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="2.5" fill="#4b3c2c" />')
    s.append('</svg>')
    return ''.join(s) + html


def vc():
    mw, mh = DW - 64, DH - TOPBAR
    lage = window(DW - 380, TOPBAR + 14, 362, 360, 'Lage · Zeitleiste', timeline(), 4)
    sysw = window(90, TOPBAR + 250, 400, 300, 'System 1:27 · 4 von 15 besetzt', system_mini(380, 260), 3)
    return (stars_bg() + f'<div class="k-abs" style="left: 64px; top: {TOPBAR}px">{galaxy(mw, mh, tip=False)}</div>' + sysw + lage + rail() + topbar(0) + chat())


SITS = {'d1': {'a': va, 'b': vb, 'c': vc}}


def build_sheet():
    parts = [f'<figure id="d1-{sid}-{e}" style="margin: 0"><div class="k-desk">{fn()}</div></figure>' for sid, vs in SITS.items() for e, fn in vs.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest d1</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-direction: column; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'd1-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/d1-sheet.html')
