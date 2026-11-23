"""Playtest – the whole picture: every decision of the playtest in one place.

Phone start: the galaxy as a pip map with colours and shapes per group [E]
(sc), names on tap [E] (s1n), the Lage sheet pulled down to one line with
the most urgent item and a hint that it can be tapped, no button [E] (s2r),
the tab bar Karte · Welten · Flotten · Berichte · Menü [E] (s17–s19).
Phone sheet: pulled up, tabs Zeitleiste · Funk · Herold · Berichte [E]
(s12, s13, d7), the timeline with the alert of the attack [E] (s2m, s6).
Desktop: map in the middle as the main view; left a slim strip of the own
worlds with resources [E] (d8); right the Lexikon [E] (d9); top the menu as
a drop-down [E] (d9) and the Börse icon on the map [E] (d6); bottom the Lage
sheet in the middle with a fixed width [E] (d7); windows over the map, one
system window open [E] (d1–d3); guild members always in their colour [E]
(d10). The place of minimized pinned windows (d5) was not decided; here a
small row at the top of the map, a proposal. Proposal only.
"""
import os

from kit import ball, g, phone, pill
from playtest_d1 import DH, DW, TOPBAR, stars_bg, window
from playtest_d2 import S27, system_win
from playtest_r1m import header, sheet as sheet_chips, tabs
from playtest_r1x import pulled
from playtest_r6 import colour_map, mark, PALETTES, SHAPES, NAMES

PAL = PALETTES['c']


def urgent_line():
    return ('<div class="k-abs" style="left: 0; right: 0; top: 640px; bottom: 62px; background: #17110d; border-top: 2px solid var(--red); '
            'border-radius: 16px 16px 0 0; box-shadow: 0 -8px 24px rgb(0 0 0 / 0.6); padding: 6px 12px; z-index: 3">'
            '<div style="width: 40px; height: 4px; border-radius: 2px; background: var(--line); margin: 0 auto 6px"></div>'
            '<div style="display: flex; gap: 6px; align-items: center; font-size: 13px; white-space: nowrap">'
            '<b style="font: 600 12px var(--head); color: var(--gold-hi); letter-spacing: 0.06em">LAGE ▴</b><span style="color: var(--red)">⚠</span>'
            '<b style="color: var(--red)">Angriff auf Nox 14:32</b><span class="m-dim">noch 1 h 12</span><span style="margin-left: auto; color: var(--gold-hi)">›</span></div></div>')


def phone_start():
    return colour_map('c').replace(sheet_chips(), urgent_line())


def phone_sheet():
    from playtest_d1 import galaxy
    tab = ''.join(f'<span style="flex: 1; text-align: center; padding: 5px 0; border-bottom: 2px solid var(--{"gold" if t == "Zeitleiste" else "line"}); '
                  f'color: var(--{"gold-hi" if t == "Zeitleiste" else "dim"})">{t}</span>' for t in ['Zeitleiste', 'Funk', 'Herold', 'Berichte'])

    def row(t, txt, c='dim', past=True):
        return (f'<div style="position: relative; display: grid; grid-template-columns: 44px 1fr; gap: 6px; font-size: 13px; margin: 5px 0;{" opacity: 0.8" if past else ""}">'
                f'<span style="position: absolute; left: -17px; top: 5px; width: 9px; height: 9px; border-radius: 50%; background: var(--{c})"></span>'
                f'<b class="m-num" style="color: var(--{"dim" if past else "txt"})">{t}</b><span>{txt}</span></div>')
    alert = ('<div style="border: 1px solid var(--red); border-radius: 8px; padding: 6px 8px; margin: 6px 0; font-size: 13px; background: rgb(238 118 96 / 0.08)">'
             '<b style="color: var(--red)">⚠ Angriff auf Nox 14:32</b> · noch 1 h 12 · Haus Valcor · Mira hält bis 15:00 ›</div>')
    body = (f'<div style="display: flex; font-size: 13px; margin-bottom: 6px">{tab}</div>' + alert
            + '<div style="margin: 6px 0 0 20px; border-left: 2px solid var(--line); padding-left: 10px">'
            + row('07:02', '2 Lastbarken zurück mit Beute') + row('12:58', '<span class="m-dim">Leander</span> gründet Kolonie in 1:44')
            + '<div style="position: relative; margin: 6px 0; border-top: 2px solid var(--gold); text-align: center"><span style="position: relative; top: -10px; background: #17110d; padding: 0 8px; '
            'font: 600 12px var(--head); color: var(--gold-hi)">JETZT 13:20</span></div>'
            + row('13:42', 'Psikristall-Steinbruch 16 fertig', 'gold', False) + row('14:32', '<b style="color: var(--red)">Angriff Haus Valcor auf Nox</b>', 'red', False)
            + row('15:00', 'Psikristall-Lager voll', 'orange', False) + '</div>')
    m = f'<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="left: 0; top: 96px">{galaxy(390, 544, tip=False)}</div>'
    return phone(m + header() + pulled(470, body) + tabs())


def desktop():
    from playtest_d1 import SYSTEMS, galaxy
    import math
    T = TOPBAR
    # top bar: logo, resources, areas, the menu drop-down closed
    areas = ''.join(f'<span style="display: flex; gap: 6px; align-items: center; color: var(--{"gold-hi" if i == 0 else "dim"}); '
                    f'{"border-bottom: 2px solid var(--gold); " if i == 0 else ""}padding: 14px 4px 12px">{g(ic, 18)} {nm}</span>'
                    for i, (ic, nm) in enumerate([('map', 'Karte'), ('planet', 'Welten'), ('fleet', 'Flotten'), ('reports', 'Berichte'), ('menu', 'Menü ▾')]))
    top = (f'<div class="k-abs" style="left: 0; right: 0; top: 0; height: {T}px; display: flex; gap: 8px; align-items: center; padding: 0 14px; background: rgb(18 13 10 / 0.94); '
           f'border-bottom: 1px solid var(--line); z-index: 6"><b style="font: 800 15px var(--head); color: var(--gold); letter-spacing: 0.06em; margin-right: 8px">NOVA IMPERIUM</b>'
           + pill('metal', '184 k') + pill('crystal', '<span style="color: var(--orange)">92 k</span>') + pill('deuterium', '41 k')
           + f'<div style="display: flex; gap: 18px; margin-left: 18px; font-size: 14px">{areas}</div>'
           + '<span style="margin-left: auto; display: flex; gap: 10px; align-items: center"><span class="k-pill">Galaxie 1 ▾</span><b class="m-num" style="color: var(--gold-hi)">13:20</b></span></div>')
    # left: own worlds with resources
    worlds = [('wasser', 0, 'Nox', 'red', 'Angriff 14:32', '61 k · 33 k · 12 k'), ('normal', 1, 'Aurelia', 'orange', 'Lager voll 1 h 40', '84 k · 52 k · 18 k'),
              ('dschungel', 2, 'Vesper', 'dim', 'Tiefbohrung 1 h', '39 k · 7 k · 11 k')]
    left = (f'<div class="k-abs" style="left: 0; top: {T}px; bottom: 0; width: 104px; z-index: 4; background: #110c09; border-right: 1px solid var(--line); padding-top: 8px">'
            + ''.join(f'<div style="text-align: center; margin: 6px 0 12px; font-size: 11px; line-height: 1.3"><div style="display: inline-block; border-radius: 50%; '
                      f'{"box-shadow: 0 0 0 2px var(--red);" if c == "red" else ""}">{ball(k, n, 44)}</div><br /><b>{nm}</b><br />'
                      f'<span style="color: var(--{c if c != "dim" else "dim"})">{st}</span><br /><span class="m-dim">{r}</span></div>' for k, n, nm, c, st, r in worlds)
            + '</div>')
    # right: the Lexikon
    right = (f'<div class="k-abs" style="right: 0; top: {T}px; bottom: 0; width: 250px; z-index: 4; background: #110c09; border-left: 1px solid var(--line); padding: 12px 14px; font-size: 12.5px">'
             '<b style="font: 700 14px var(--head); color: var(--gold-hi)">Lexikon</b><div class="m-dim" style="margin: 4px 0 8px">Suche …</div>'
             '<b>Sonnenkathedrale</b><div style="margin-top: 4px; line-height: 1.5">Liefert Energie für die Minen. Kosten je Stufe · 1,5; Energie 20 · Stufe · 1,1<sup>Stufe</sup>.</div>'
             '<div class="m-dim" style="margin-top: 8px">Verwandt: Fusionssanktum · Machina-Energetik</div></div>')
    # map in the middle with colours and shapes
    mx, mw, mh = 104, DW - 104 - 250, DH - T
    m = f'<div class="k-abs" style="left: {mx}px; top: {T}px">{galaxy(mw, mh, tip=False)}</div>'
    börse = (f'<div class="k-abs" style="left: {mx + mw - 120}px; top: {T + 12}px; z-index: 3; display: flex; gap: 6px"><span class="m-chip">⚖ Börse</span><span class="m-chip">Gilde</span></div>')
    pins = (f'<div class="k-abs" style="left: {mx + 12}px; top: {T + 12}px; z-index: 3; display: flex; gap: 6px; font-size: 12px">'
            '<span class="m-chip">📌 Forschungsbaum</span><span class="m-chip">📌 Flotte Raubzug</span></div>')
    sysw = window(mx + 20, T + 54, 400, 330, 'System 1:27 · deine Welten', system_win(380, 280, S27), 3)
    # bottom: the Lage sheet in the middle, fixed width
    w = 440
    lage = (f'<div class="k-abs" style="left: {(DW - w) / 2:.0f}px; width: {w}px; bottom: 0; height: 46px; background: #17110d; border: 1px solid var(--red); border-bottom: 0; '
            'border-radius: 14px 14px 0 0; box-shadow: 0 -10px 30px rgb(0 0 0 / 0.7); z-index: 5; padding: 8px 16px">'
            '<div style="display: flex; gap: 8px; align-items: center; font-size: 12.5px"><b style="font: 600 12px var(--head); color: var(--gold-hi)">LAGE ▴</b>'
            '<span style="color: var(--red)">⚠ Angriff auf Nox 14:32</span><span class="m-dim">noch 1 h 12</span><span style="margin-left: auto; color: var(--gold-hi)">›</span></div></div>')
    return stars_bg() + m + börse + pins + sysw + left + right + top + lage


SITS = {'gv': {'a': phone_start, 'b': phone_sheet, 'c': desktop}}


def build_sheet():
    parts = []
    for e, fn in SITS['gv'].items():
        inner = fn()
        wrap = f'<div class="k-desk">{inner}</div>' if e == 'c' else inner
        parts.append(f'<figure id="gv-gv-{e}" style="margin: 0; display: inline-block">{wrap}</figure>')
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest Gesamtbild</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-wrap: wrap; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'final-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/final-sheet.html')
