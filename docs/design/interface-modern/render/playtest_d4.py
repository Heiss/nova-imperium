"""Playtest desktop d4–d6 – research tree, fleet with presets, Herold and Börse.

[E] s5: research as a tree of prerequisites with the path to the goal
highlighted, also a full tree that scrolls sideways; queues only through a
special research. [E] s9: a tap on a world opens the sheet with presets;
dragging a route is a second way; ship-by-ship selection stays; presets per
player. [E] d1–d3: desktop keeps the Lage sheet at the bottom, areas on
top, windows over the map. Requirements from the catalog (src/features/*/
entry.ts): Laser needs Energie 2; Refraktionsfelder Energie 3; Ionen Laser 5
and Energie 4; Plasma Energie 8, Laser 10, Ionen 5; Warp-Theorie Energie 5
and Refraktionsfelder 5; all need the Scholarium. Proposal only.
"""
import os

from kit import I
from playtest_d1 import DH, DW, TOPBAR, chat, galaxy, stars_bg, topbar, window
from playtest_d2 import sheet_line

R = I + 'research/'
# key: (icon, name, level, state, col, row)
NODES = {'energy': ('energy_technology', 'Machina-Energetik', '8', 'ok', 0, 1), 'laser': ('laser_technology', 'Lichtlanzen-Lehre', '10', 'ok', 1, 0),
         'shield': ('shielding_technology', 'Refraktionsfelder', '8', 'ok', 1, 2), 'ion': ('ion_technology', 'Ionen-Lehre', '0 / 5', 'need', 2, 0),
         'hyper': ('hyperspace_technology', 'Warp-Theorie', '6', 'ok', 2, 2), 'plasma': ('plasma_technology', 'Plasma-Lehre', 'Ziel', 'goal', 3, 1)}
EDGES = [('energy', 'laser', True), ('energy', 'shield', False), ('laser', 'ion', True), ('energy', 'ion', True), ('ion', 'plasma', True),
         ('laser', 'plasma', True), ('energy', 'plasma', True), ('energy', 'hyper', False), ('shield', 'hyper', False)]


def tree(w, h, dx=210, dy=150, ox=50, oy=24, tile=58):
    pos = {k: (ox + c * dx, oy + r * dy) for k, (_, _, _, _, c, r) in NODES.items()}
    svg = [f'<svg class="k-abs" style="left: 0; top: 0" width="{w}" height="{h}">']
    for a, b, on in EDGES:
        (x1, y1), (x2, y2) = pos[a], pos[b]
        x1, y1, x2, y2 = x1 + tile, y1 + tile / 2, x2, y2 + tile / 2
        mx = (x1 + x2) / 2
        svg.append(f'<path d="M {x1:.0f} {y1:.0f} C {mx:.0f} {y1:.0f} {mx:.0f} {y2:.0f} {x2:.0f} {y2:.0f}" stroke="{"#f1d27a" if on else "#4b3c2c"}" '
                   f'stroke-width="{2.5 if on else 1.4}" fill="none"{"" if on else " stroke-dasharray=\"4 4\""} />')
    svg.append('</svg>')
    html = ''
    for k, (icon, name, lvl, st, c, r) in NODES.items():
        x, y = pos[k]
        col = {'ok': 'var(--green)', 'need': 'var(--orange)', 'goal': 'var(--gold-hi)'}[st]
        html += (f'<div class="k-abs" style="left: {x}px; top: {y}px; width: {tile}px">'
                 f'<div class="k-tile ok" style="width: {tile}px; height: {tile}px; {"outline: 3px solid var(--gold-hi); outline-offset: 2px" if st == "goal" else ""}"><img src="{R}{icon}.svg" alt="" /></div></div>'
                 f'<div class="k-abs" style="left: {x - 40}px; top: {y + tile + 4}px; width: {tile + 80}px; text-align: center; font-size: 12px; line-height: 1.25">'
                 f'<b>{name}</b><br /><span style="color: {col}">{lvl}</span></div>')
    lab = ('<div class="k-abs" style="left: 0; top: -2px; font-size: 11.5px" class="m-dim"><span class="m-dim">Scholarium ✓ (alle brauchen es)</span></div>')
    return f'<div style="position: relative; width: {w}px; height: {h}px">{"".join(svg)}{html}{lab}</div>'


def research_info(width=340):
    rows = [('Ziel', 'Plasma-Lehre 1 · schaltet Plasmabatterie frei'), ('fehlt', '<span style="color: var(--orange)">Ionen-Lehre 5</span>'),
            ('Kosten bis zum Ziel', '33.000 / 13.300 / 4.100'), ('nächster Schritt', 'Ionen-Lehre 1 · 1.000 / 300 / 100')]
    kv = ''.join(f'<span>{a}</span><b>{b}</b>' for a, b in rows)
    return (f'<div style="width: {width}px; font-size: 13px"><div class="m-kv">{kv}</div>'
            '<span class="m-btn big" style="display: block; margin-top: 10px; text-align: center">Ionen-Lehre 1 erforschen</span>'
            '<div class="m-dim" style="font-size: 12px; margin-top: 6px">Mehrere Schritte vormerken braucht die Forschung für Warteschlangen.</div></div>')


# ------------------------------------------------------------------ d4 research tree on the desktop
def d4a():
    body = (f'<div class="k-abs" style="left: 30px; top: {TOPBAR + 16}px; z-index: 2"><b style="font: 800 17px var(--head); color: var(--gold)">Forschung</b> '
            '<span class="m-dim" style="font-size: 12.5px">ganzer Baum · seitlich scrollen ›</span>'
            f'<div style="margin-top: 20px">{tree(820, 380)}</div></div>')
    right = (f'<div class="k-abs" style="right: 0; top: {TOPBAR}px; bottom: 46px; width: 380px; background: #17110d; border-left: 1px solid var(--gold); z-index: 3; padding: 16px 20px">'
             '<b style="font: 700 16px var(--head); color: var(--gold-hi)">Weg zur Plasma-Lehre</b>' + research_info() + '</div>')
    return stars_bg() + body + right + topbar(0, tabs=True) + sheet_line() + chat()


def d4b():
    tw = window(40, TOPBAR + 30, 860, 460, 'Forschungsbaum · Weg zur Plasma-Lehre', f'<div style="margin-top: 14px">{tree(820, 380)}</div>', 3)
    iw = window(880, TOPBAR + 120, 370, 300, 'Plasma-Lehre', research_info(340), 4)
    return stars_bg() + f'<div class="k-abs" style="left: 0; top: {TOPBAR}px">{galaxy(DW, DH - TOPBAR, tip=False)}</div>' + tw + iw + topbar(0, tabs=True) + sheet_line() + chat()


def d4c():
    sh = ('<div class="k-abs" style="left: 40px; right: 40px; bottom: 0; height: 470px; background: #17110d; border: 1px solid var(--gold); border-bottom: 0; '
          'border-radius: 16px 16px 0 0; box-shadow: 0 -10px 30px rgb(0 0 0 / 0.7); z-index: 4; padding: 6px 20px; display: flex; gap: 24px">'
          f'<div><div style="width: 46px; height: 4px; border-radius: 2px; background: var(--line); margin: 0 0 8px 400px"></div><b style="color: var(--gold-hi)">Forschungsbaum</b>'
          f'<div style="margin-top: 12px">{tree(820, 380)}</div></div><div style="padding-top: 30px">{research_info(300)}</div></div>')
    return stars_bg() + f'<div class="k-abs" style="left: 0; top: {TOPBAR}px">{galaxy(DW, DH - TOPBAR, tip=False)}</div>' + topbar(0, tabs=True) + sh + chat()


SITS = {'d4': {'a': d4a, 'b': d4b, 'c': d4c}}


# ------------------------------------------------------------------ d5 fleet with presets on the desktop
def presets(compact=False):
    from playtest_r3 import ship_rows
    cards = ''.join(f'<div style="border: 1px solid var(--{"gold" if on else "line"}); border-radius: 6px; padding: 6px 8px; margin: 4px 0;{" background: rgb(212 165 55 / 0.1)" if on else ""}">'
                    f'<b style="color: var(--{"gold-hi" if on else "txt"})">{t}</b> <span class="m-dim" style="font-size: 12px">{d}</span></div>'
                    for t, d, on in [('Raubzug', 'Kampfschiffe + 24 Lastbarken', True), ('Alles', '60 · 20 · 30', False), ('Nur Laderaum', '24 Lastbarken', False), ('+ Eigene Vorlage', 'speichern', False)])
    ships = '' if compact else ('<div style="font: 600 11.5px var(--head); letter-spacing: 0.1em; color: var(--gold); margin: 8px 0 2px">SCHIFFE</div>' + ship_rows())
    cargo = '<div class="m-kv" style="margin-top: 6px"><span>Laderaum</span><b style="color: var(--green)">619 k ≥ Beute 600 k ✓</b><span>an / zurück</span><b>14:05 / 14:50</b></div>'
    return cards + ships + cargo + '<span class="m-btn big" style="display: block; margin-top: 8px; text-align: center">Raubzug losschicken</span>'


def d5base():
    from playtest_d2 import S27, system_win
    w27 = window(40, TOPBAR + 70, 420, 330, 'System 1:27 · deine Welten', system_win(400, 280, S27, drag=8), 3)
    return stars_bg() + f'<div class="k-abs" style="left: 0; top: {TOPBAR}px">{galaxy(DW, DH - TOPBAR, tip=False)}</div>' + w27


def d5a():
    body = ('<div class="m-dim" style="font-size: 12px">Von Aurelia · Varn [1:44:4] · Krieg</div>'
            '<div style="display: flex; gap: 6px; margin: 6px 0"><span class="m-chip on">Sturmangriff</span><span class="m-chip">Auspex-Erkundung</span><span class="m-chip">Versorgungsflug</span></div>'
            + presets())
    return d5base() + window(760, TOPBAR + 20, 420, 560, 'Ziel: Varn · Sturmangriff', body, 4) + topbar(0, tabs=True) + sheet_line() + chat()


def d5b():
    tgt = ('<div class="m-dim" style="font-size: 12px">Von Aurelia · Ziel gewählt</div><b style="color: #ee7660">4 · Varn</b> <span class="m-dim">Haus Valcor · Krieg · aktiv</span>'
           '<div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px"><span class="m-chip on">Sturmangriff</span><span class="m-chip">Auspex-Erkundung</span><span class="m-chip">Versorgungsflug</span></div>')
    return (d5base() + window(500, TOPBAR + 40, 260, 260, 'Ziel in System 1:44', tgt, 4) + window(790, TOPBAR + 20, 440, 560, 'Flotte · Vorlagen', presets(), 5)
            + topbar(0, tabs=True) + sheet_line() + chat())


def d5c():
    from playtest_r3 import ship_rows
    sh = ('<div class="k-abs" style="left: 40px; right: 40px; bottom: 0; height: 300px; background: #17110d; border: 1px solid var(--gold); border-bottom: 0; '
          'border-radius: 16px 16px 0 0; box-shadow: 0 -10px 30px rgb(0 0 0 / 0.7); z-index: 4; padding: 8px 20px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px">'
          f'<div><b style="color: var(--gold-hi)">Aurelia → Varn · Sturmangriff</b><div style="margin-top: 6px">{presets(compact=True).split("<div class=\"m-kv\"")[0]}</div></div>'
          f'<div><div style="font: 600 11.5px var(--head); letter-spacing: 0.1em; color: var(--gold); margin-top: 4px">SCHIFFE</div>{ship_rows()}</div>'
          '<div><div class="m-kv" style="margin-top: 22px"><span>Laderaum</span><b style="color: var(--green)">619 k ≥ Beute 600 k ✓</b><span>an / zurück</span><b>14:05 / 14:50</b></div>'
          '<span class="m-btn big" style="display: block; margin-top: 12px; text-align: center">Raubzug losschicken</span></div></div>')
    return d5base() + topbar(0, tabs=True) + sh + chat()


SITS['d5'] = {'a': d5a, 'b': d5b, 'c': d5c}


# ------------------------------------------------------------------ d6 Herold and Börse on the desktop
# [E] s13: the Herold has its own newspaper page and a tab in the Lage sheet with the newest Kriegsbericht and „Durchstechen“.
# [E] s14: Börse: a map layer with the offers at the traders' systems; a tap on a world opens „Tauschen“; delivery time is an option.
def herold_body(width=380):
    from playtest_r4 import NEWS
    hero = ('<div style="border: 1px solid var(--gold); border-radius: 8px; overflow: hidden; margin: 6px 0">'
            '<div style="height: 110px; background: radial-gradient(circle at 70% 40%, #f0a050 0 6%, transparent 7%), radial-gradient(circle at 30% 60%, #6fb8ff 0 3%, transparent 4%), linear-gradient(160deg, #1a1210, #0b0806); position: relative">'
            '<span style="position: absolute; left: 10px; bottom: 6px; font-size: 22px">▶</span></div>'
            '<div style="padding: 6px 8px; font-size: 12.5px"><b style="color: var(--gold-hi)">Kriegsbericht: Varn</b> <span class="m-dim">nur für dich und Varn</span> · '
            '<span style="color: var(--gold-hi)">Durchstechen</span></div></div>')
    rows = ''.join(f'<div style="padding: 5px 0; border-bottom: 1px solid var(--line); font-size: 13px"><span class="m-dim" style="font-size: 11.5px">{t}</span><br /><b>{h}</b></div>' for t, h, c in NEWS)
    return f'<div style="width: {width}px">{hero}{rows}</div>'


def tausch_body():
    return ('<div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; align-items: center; margin: 6px 0">'
            '<div style="border: 1px solid var(--line); border-radius: 8px; padding: 6px; text-align: center; font-size: 12.5px"><span class="m-dim">du gibst</span><br /><b style="font-size: 16px">40.000</b><br />Psikristall</div>'
            '<b style="color: var(--gold-hi)">→</b><div style="border: 1px solid var(--green); border-radius: 8px; padding: 6px; text-align: center; font-size: 12.5px"><span class="m-dim">du bekommst</span><br />'
            '<b style="font-size: 16px; color: var(--green)">76.000</b><br />Adamant</div></div>'
            '<div class="m-kv"><span>Kurs</span><b>1,9 · Thalor</b><span>Lieferung</span><b>2 Lastbarken · 18 min · Treuhand</b></div>'
            '<label style="display: flex; gap: 6px; align-items: center; font-size: 12.5px; margin-top: 6px"><input type="checkbox" checked /> Lieferzeit beim besten Kurs mitzählen</label>'
            '<span class="m-btn big" style="display: block; margin-top: 8px; text-align: center">Tauschen</span>')


def market_layer():
    from playtest_d1 import SYSTEMS
    from playtest_r1m import GUILD, OTHER
    w, h = DW, DH - TOPBAR
    P = {n: (fx * w, fy * h + TOPBAR) for n, (fx, fy, _) in SYSTEMS.items()}
    out = ''
    for n, txt, t, c in [('1:44', 'Thalor kauft 120 k zu 1,9', '18 min', GUILD), ('1:27', 'Leander verkauft zu 2,2', '6 min', OTHER), ('1:24', 'kauft 60 k zu 1,8', '41 min', OTHER)]:
        x, y = P[n]
        out += (f'<div class="k-abs" style="left: {x + 14:.0f}px; top: {y + 10:.0f}px; z-index: 2; background: #17110d; border: 1px solid {c}; border-radius: 8px; '
                f'padding: 3px 8px; font-size: 12px"><b style="color: {c}">{txt}</b><br /><span class="m-dim">Lieferzeit {t}</span></div>')
    return out


def d6a():
    hw = window(30, TOPBAR + 20, 420, 470, 'Imperialer Herold', herold_body(390), 3)
    bw = window(820, TOPBAR + 90, 400, 330, 'Börse · Tauschen mit Thalor', tausch_body(), 4)
    return (stars_bg() + f'<div class="k-abs" style="left: 0; top: {TOPBAR}px">{galaxy(DW, DH - TOPBAR, tip=False, routes=False)}</div>' + market_layer()
            + hw + bw + topbar(0, tabs=True) + sheet_line() + chat())


def d6b():
    from playtest_r4 import NEWS
    ticker = (f'<div class="k-abs" style="left: 0; right: 0; top: {TOPBAR}px; height: 30px; z-index: 4; background: #0f0b08; border-bottom: 1px solid var(--line); '
              'display: flex; gap: 14px; align-items: center; padding: 0 14px; font-size: 13px; white-space: nowrap; overflow: hidden">'
              '<b style="font: 700 11.5px var(--head); color: var(--gold); letter-spacing: 0.08em">HEROLD</b>' + ' · '.join(h for _, h, _ in NEWS)
              + ' · <span style="color: var(--gold-hi)">Dein Kriegsbericht: Varn ▶</span></div>')
    bw = window(820, TOPBAR + 120, 400, 330, 'Thalor · 1:44:6', tausch_body(), 4)
    chips = (f'<div class="k-abs" style="left: 20px; top: {TOPBAR + 44}px; z-index: 3; display: flex; gap: 6px"><span class="m-chip">Besitz</span><span class="m-chip on">Börse: Psikristall</span></div>')
    return (stars_bg() + f'<div class="k-abs" style="left: 0; top: {TOPBAR}px">{galaxy(DW, DH - TOPBAR, tip=False, routes=False)}</div>' + market_layer()
            + chips + bw + ticker + topbar(0, tabs=True) + sheet_line() + chat())


def d6c():
    from playtest_r4 import BOOK_BUY, BOOK_SELL
    def side(rows, col, title):
        return (f'<div><div style="font: 600 11.5px var(--head); letter-spacing: 0.1em; color: var(--{col})">{title}</div>'
                + ''.join(f'<div style="display: grid; grid-template-columns: 40px 1fr auto; gap: 6px; font-size: 12.5px; padding: 3px 0; border-bottom: 1px solid var(--line)">'
                          f'<b style="color: var(--{col})">{p}</b><span>{q}</span><span class="m-dim">{w}</span></div>' for p, q, w in rows) + '</div>')
    tabs = ''.join(f'<span style="padding: 6px 12px; border-bottom: 2px solid var(--{"gold" if i >= 2 else "line"}); color: var(--{"gold-hi" if i >= 2 else "dim"})">{t}</span>'
                   for i, t in enumerate(['Zeitleiste', 'Funk', 'Herold', 'Börse']))
    sh = ('<div class="k-abs" style="left: 40px; right: 40px; bottom: 0; height: 380px; background: #17110d; border: 1px solid var(--gold); border-bottom: 0; '
          'border-radius: 16px 16px 0 0; box-shadow: 0 -10px 30px rgb(0 0 0 / 0.7); z-index: 4; padding: 8px 20px">'
          f'<div style="display: flex; gap: 4px; font-size: 13px; margin-bottom: 8px">{tabs}</div>'
          f'<div style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 28px">{herold_body(520)}'
          f'<div><b style="color: var(--gold-hi)">Börse · Psikristall ↔ Adamant</b><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 6px">'
          f'{side(BOOK_BUY, "green", "GEBOTE")}{side(BOOK_SELL, "red", "ANGEBOTE")}</div></div></div></div>')
    return stars_bg() + f'<div class="k-abs" style="left: 0; top: {TOPBAR}px">{galaxy(DW, DH - TOPBAR, tip=False)}</div>' + topbar(0, tabs=True) + sh + chat()


SITS['d6'] = {'a': d6a, 'b': d6b, 'c': d6c}


# ------------------------------------------------------------------ d7 reports on the desktop
# [E] s18: Berichte = a list by time with filters; a tap opens the report in its world's sheet; limit per player.
# [E] s8: a report is reached from the timeline, the list and the world. [E] s10: battle report as a table.
def report_list(width=360):
    from playtest_r7 import REPORTS
    chips = '<div class="m-chips">' + ''.join(f'<span class="m-chip{" on" if i == 0 else ""}">{t}</span>' for i, t in enumerate(['Alle', 'Kampf', 'Auspex', 'Flotte', 'Lieferung'])) + '</div>'
    rows = ''.join(f'<div style="display: grid; grid-template-columns: 8px 1fr auto; gap: 8px; align-items: center; padding: 7px 4px; border-bottom: 1px solid var(--line); font-size: 13px;'
                   f'{" background: rgb(212 165 55 / 0.1)" if "Varn" in t else ""}">'
                   f'<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--{c})"></span><span>{t}<br /><span class="m-dim" style="font-size: 11.5px">{k} · {w}</span></span>'
                   f'<span class="m-dim" style="font-size: 12px">{tm}</span></div>' for k, c, t, tm, w in sorted(REPORTS, key=lambda r: r[3], reverse=True))
    return f'<div style="width: {width}px">{chips}{rows}</div>'


def report_full():
    from playtest_r3 import report_body
    return f'<div style="width: 360px; font-size: 13px">{report_body()}</div>'


def d7a():
    lw = window(30, TOPBAR + 20, 400, 420, 'Berichte · 5 neu', report_list(370), 3)
    rw = window(460, TOPBAR + 60, 400, 420, 'Bericht · Varn [1:44:4]', report_full(), 4)
    return stars_bg() + f'<div class="k-abs" style="left: 0; top: {TOPBAR}px">{galaxy(DW, DH - TOPBAR, tip=False)}</div>' + lw + rw + topbar(0, tabs=True) + sheet_line() + chat()


def d7b():
    tabs = ''.join(f'<span style="padding: 6px 12px; border-bottom: 2px solid var(--{"gold" if t == "Berichte" else "line"}); color: var(--{"gold-hi" if t == "Berichte" else "dim"})">{t}</span>'
                   for t in ['Zeitleiste', 'Funk', 'Herold', 'Berichte'])
    sh = ('<div class="k-abs" style="left: 40px; width: 460px; bottom: 0; height: 430px; background: #17110d; border: 1px solid var(--gold); border-bottom: 0; '
          'border-radius: 16px 16px 0 0; box-shadow: 0 -10px 30px rgb(0 0 0 / 0.7); z-index: 4; padding: 8px 20px">'
          f'<div style="display: flex; gap: 4px; font-size: 13px; margin-bottom: 8px">{tabs}</div>{report_list(420)}</div>')
    rw = window(560, TOPBAR + 60, 400, 420, 'Bericht · Varn [1:44:4]', report_full(), 4)
    return stars_bg() + f'<div class="k-abs" style="left: 0; top: {TOPBAR}px">{galaxy(DW, DH - TOPBAR, tip=False)}</div>' + rw + topbar(0, tabs=True) + sh + chat()


def d7c():
    from playtest_d1 import SYSTEMS
    x, y = SYSTEMS['1:44'][0] * DW, SYSTEMS['1:44'][1] * (DH - TOPBAR) + TOPBAR
    pop = (f'<div class="k-abs" style="left: {x - 420:.0f}px; top: {y - 330:.0f}px; width: 380px; z-index: 5; background: #17110d; border: 1px solid var(--green); border-radius: 10px; '
           'padding: 10px 12px; box-shadow: 0 10px 30px rgb(0 0 0 / 0.7)">' + report_full() + '</div>'
           f'<svg class="k-abs" style="left: 0; top: 0; z-index: 4" width="{DW}" height="{DH}"><path d="M {x - 40:.0f} {y - 40:.0f} L {x - 6:.0f} {y - 6:.0f}" stroke="#7fd18b" stroke-width="2" /></svg>')
    lw = window(30, TOPBAR + 20, 400, 420, 'Berichte · 5 neu', report_list(370), 3)
    return stars_bg() + f'<div class="k-abs" style="left: 0; top: {TOPBAR}px">{galaxy(DW, DH - TOPBAR, tip=False)}</div>' + lw + pop + topbar(0, tabs=True) + sheet_line() + chat()


SITS['d7'] = {'a': d7a, 'b': d7b, 'c': d7c}


def build_sheet():
    parts = [f'<figure id="{sid}-{sid}-{e}" style="margin: 0"><div class="k-desk">{fn()}</div></figure>' for sid, vs in SITS.items() for e, fn in vs.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest d4</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-direction: column; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'd4-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/d4-sheet.html')
