"""Playtest desktop d3 – building on fields and the info page on the desktop.

[E] s3: drag a building onto a field or tap the building and then the field;
while placing, every field shows what it gains. [E] s4: compact mode = a
sheet that closes by swiping down; standard mode = its own page with tabs
and an overview of the levels; „what it unlocks“ belongs into the standard
page. [E] d1/d2: desktop keeps the Lage sheet at the bottom, areas on top,
windows on top of the map. Values from the catalog: Sonnenkathedrale cost
[75, 30] · 1.5^(level − 1), energy 20 · L · 1.1^L (src/features/solar,
src/core/rates.ts): level 19 costs 110.842 / 44.337 and gives 2.324 instead
of 2.002 energy at 100 %. Field yields (#158) are examples. Proposal only.
"""
import os

from kit import I
from playtest_d1 import DH, DW, TOPBAR, chat, galaxy, stars_bg, topbar, window
from playtest_d2 import sheet_line
from playtest_r1 import field_grid, legend

PALETTE = [('solar_plant', 'Sonnenkathedrale', 'ok'), ('fusion_reactor', 'Fusionssanktum', 'ok'), ('metal_mine', 'Adamant-Tiefbohrung', 'soon'),
           ('crystal_storage', 'Psikristall-Reliquiar', 'ok'), ('missile_silo', 'Raketensilo', 'ok')]


def palette(vertical=True, size=56):
    items = ''.join(f'<div class="k-tile {st}" style="width: {size}px; height: {size}px; flex: none{"; outline: 3px solid var(--gold-hi); outline-offset: 2px" if i == 0 else ""}" '
                    f'title="{nm}"><img src="{I}buildings/{b}.svg" alt="" /></div>' for i, (b, nm, st) in enumerate(PALETTE))
    return f'<div style="display: flex; flex-direction: {"column" if vertical else "row"}; gap: 8px">{items}</div>'


def info_tabs(width=340):
    tabs = ''.join(f'<span style="padding: 6px 10px; border-bottom: 2px solid var(--{"gold" if i == 0 else "line"}); color: var(--{"gold-hi" if i == 0 else "dim"})">{t}</span>'
                   for i, t in enumerate(['Übersicht', 'Stufen', 'Schaltet frei']))
    rows = [('Stufe', '18 → 19'), ('Kosten', '<span style="color: var(--green)">110.842 Adamant · 44.337 Psikristall ✓</span>'),
            ('Energie (100 %)', '2.002 → 2.324'), ('auf D2 · Sonnenhang (120 %)', '<b style="color: var(--green)">2.789</b>')]
    kv = ''.join(f'<span>{a}</span><b>{b}</b>' for a, b in rows)
    return (f'<div style="width: {width}px; font-size: 13px"><div style="display: flex; gap: 10px; align-items: center; margin-bottom: 6px">'
            f'<div class="k-tile ok" style="width: 54px; height: 54px"><img src="{I}buildings/solar_plant.svg" alt="" /></div>'
            '<div><b style="font: 700 16px var(--head); color: var(--gold-hi)">Sonnenkathedrale</b><br /><span class="m-dim">Liefert Energie für die Minen.</span></div></div>'
            f'<div style="display: flex; gap: 2px; font-size: 13px">{tabs}</div><div class="m-kv" style="margin-top: 8px">{kv}</div>'
            '<span class="m-btn big" style="display: block; margin-top: 10px; text-align: center">Auf D2 bauen</span></div>')


def surface(size=64):
    return (f'<div style="position: relative; height: {size * 6 + 40}px; width: {size * 6 + 20}px">{field_grid(size, sel=(1, 3), show_eff=True)}</div>')


# ------------------------------------------------------------------ a: planet page: palette left, fields centre, info right
def va():
    left = (f'<div class="k-abs" style="left: 20px; top: {TOPBAR + 20}px; z-index: 2"><div class="m-dim" style="font-size: 12px; margin-bottom: 6px">Ziehen oder<br />antippen + Feld</div>'
            + palette() + '</div>')
    mid = (f'<div class="k-abs" style="left: 110px; top: {TOPBAR + 14}px; z-index: 2"><b style="font: 800 17px var(--head); color: var(--gold)">Aurelia · Oberfläche</b> '
           '<span class="m-dim" style="font-size: 12.5px">102 / 163 Felder</span>' + surface(70) + legend() + '</div>')
    right = (f'<div class="k-abs" style="right: 0; top: {TOPBAR}px; bottom: 46px; width: 380px; background: #17110d; border-left: 1px solid var(--gold); z-index: 3; padding: 14px 20px">'
             + info_tabs() + '</div>')
    return stars_bg() + left + mid + right + topbar(0, tabs=True).replace('color: var(--gold-hi); border-bottom: 2px solid var(--gold); ', 'color: var(--dim); ', 1) + sheet_line() + chat()


# ------------------------------------------------------------------ b: the planet as a window over the map, the info as a second window
def vb():
    pw = window(40, TOPBAR + 20, 560, 560, 'Aurelia · Oberfläche · 102 / 163 Felder',
                '<div style="display: flex; gap: 10px">' + palette(size=46) + f'<div>{surface(62)}</div></div>', 3)
    iw = window(640, TOPBAR + 60, 400, 380, 'Sonnenkathedrale', info_tabs(370), 4)
    return (stars_bg() + f'<div class="k-abs" style="left: 0; top: {TOPBAR}px">{galaxy(DW, DH - TOPBAR, tip=False)}</div>' + pw + iw
            + topbar(0, tabs=True) + sheet_line() + chat())


# ------------------------------------------------------------------ c: as on the phone, wider: palette in a bar, info as a sheet
def vc():
    mid = (f'<div class="k-abs" style="left: 60px; top: {TOPBAR + 14}px; z-index: 2"><b style="font: 800 17px var(--head); color: var(--gold)">Aurelia · Oberfläche</b> '
           '<span class="m-dim" style="font-size: 12.5px">102 / 163 Felder</span>' + surface(70) + '</div>')
    bar = (f'<div class="k-abs" style="left: 560px; top: {TOPBAR + 40}px; z-index: 2"><div class="m-dim" style="font-size: 12px; margin-bottom: 6px">Ziehe ein Gebäude auf ein Feld</div>'
           + palette(vertical=False, size=60) + '</div>')
    sh = ('<div class="k-abs" style="left: 540px; right: 40px; bottom: 0; height: 330px; background: #17110d; border: 1px solid var(--gold); border-bottom: 0; '
          'border-radius: 16px 16px 0 0; box-shadow: 0 -10px 30px rgb(0 0 0 / 0.7); z-index: 4; padding: 6px 20px">'
          '<div style="width: 46px; height: 4px; border-radius: 2px; background: var(--line); margin: 0 auto 8px"></div>' + info_tabs(600) + '</div>')
    return stars_bg() + mid + bar + sh + topbar(0, tabs=True).replace('color: var(--gold-hi); border-bottom: 2px solid var(--gold); ', 'color: var(--dim); ', 1) + chat()


SITS = {'d3': {'a': va, 'b': vb, 'c': vc}}


def build_sheet():
    parts = [f'<figure id="d3-{sid}-{e}" style="margin: 0"><div class="k-desk">{fn()}</div></figure>' for sid, vs in SITS.items() for e, fn in vs.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest d3</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-direction: column; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'd3-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/d3-sheet.html')
