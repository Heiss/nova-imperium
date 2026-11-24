"""Playtest desktop d11–d22 – the pages „Welt und Konto“ on the desktop (owner, 2026-11-24).

[E] W13: first the phone, then the desktop; small pages as one proposal.
The phone winners of round 8 [E]: Optionen a grouped list with sub-pages
(w1), a world managed from ⋯ (w2), login with the passkey first and the
galaxy chosen on the map at the registration (w3), admin as an overview of
tiles with counters (w4), Zurückbauen in the info sheet, also in the
compact mode (w5), the small pages as shown (w6–w12). The desktop pattern
[E]: windows over the map, the Lage sheet at the bottom, the worlds on the
left, the Lexikon on the right, the menu at the top (d1–d10, gv). Built
from the components of anim_desk.py (Imperium frame). Every number is an
example except the catalogue values of round 8. Proposal only.
"""
import os

from anim_desk import (DH, DW, LEFT, LEXW, MX0, MY0, RACES, SH_LO, TB, TOPBAR, Path, galaxy_svg, icon, lage, left_strip, lexikon_tab, line_alert, map_chips,
                       surface_body, topbar, window)
from playtest_d2 import S27, system_win
import playtest_r8 as r8

R, RACE, T = RACES['imperium'], 'imperium', 0.5


def frame(*parts, dim=False, menu=False):
    m = f'<div class="k-abs" style="left: {MX0}px; top: {MY0}px;{" opacity: 0.4" if dim else ""}">{galaxy_svg()}</div>'
    return (m + map_chips(R) + lage(R, RACE, T, SH_LO, line_alert(), border='var(--red)') + left_strip(R, RACE, T) + lexikon_tab(R)
            + topbar(R, RACE, T, '13:20', area=4 if menu else 0) + ''.join(parts))


def win(x, y, w, h, title, body, z=24, seed=3):
    return window(R, RACE, T, x, y, w, h, title, body, z, 1.0, seed=seed)


def shade(z=22):
    return f'<div class="k-abs" style="left: 0; top: 0; width: {DW}px; height: {DH}px; background: rgb(0 0 0 / 0.5); z-index: {z}"></div>'


def popover(x, y, w, body, z=40):
    return (f'<div class="k-abs" style="left: {x}px; top: {y}px; width: {w}px; z-index: {z}; background: #1c1510; border: 1px solid var(--gold); border-radius: 10px; '
            f'box-shadow: 0 12px 30px rgb(0 0 0 / 0.8); padding: 4px 12px">{body}</div>')


# ------------------------------------------------------------------ d11 Optionen
def opt_list(sel='Karte und Anzeige'):
    def r(label, value='', right=None):
        on = label == sel
        row = r8.row(label, value, right=right)
        return row.replace('padding: 10px 12px;', f'padding: 10px 12px;{" background: rgb(212 165 55 / 0.14);" if on else ""}', 1)
    return (r8.group('SPIEL', r('Spähschädel pro Auspex-Erkundung', '3') + r('(?)-Symbol', 'als Symbol') + r('Stufenübersicht', 'als Symbol'))
            + r8.group('KARTE UND ANZEIGE', r('Karte und Anzeige', 'Farbset, Formen, Wischen'))
            + r8.group('RUNDE', r('Urlaubsmodus', 'aus') + r('Meine Aktivität &amp; Spielzeit', 'heute 1 h 12') + r('Rundenarchiv'))
            + r8.group('GERÄT UND KONTO', r('Benachrichtigungen', '11 von 13') + r('Konto', 'Passkeys, Passwort')) + r8.group('', r('Problem melden')))


def opt_detail():
    pal = ''.join(f'<div style="border: 1px solid var(--{"gold" if i == 0 else "line"}); border-radius: 8px; padding: 6px 8px; flex: 1; text-align: center; font-size: 12px">'
                  f'<div style="display: flex; gap: 3px; justify-content: center; margin-bottom: 4px">'
                  + ''.join(f'<i style="width: 10px; height: 10px; border-radius: 50%; background: {c}"></i>' for c in cs) + f'</div>{n}</div>'
                  for i, (n, cs) in enumerate([('Standard', ['#6fb8ff', '#e070c8', '#6fe0a8', '#ee7660']), ('Rot-Grün', ['#f4f0e6', '#4fd1c5', '#9be15d', '#ee7660']),
                                               ('Kontrast', ['#ffffff', '#ffd400', '#00e5ff', '#ff3d7f'])]))
    seg = ''.join(f'<span style="flex: 1; text-align: center; padding: 6px 0; font-size: 12px; {"background: rgb(212 165 55 / 0.18); color: var(--gold-hi);" if i == 1 else "color: var(--dim);"}">{t}</span>'
                  for i, t in enumerate(['nur Auswahl', 'Auswahl + Wischen', 'nur Wischen']))

    def card(t, inner, note=''):
        return (f'<div style="border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin: 8px 0; background: #140f0b">'
                f'<b style="font-size: 13.5px">{t}</b>{f"<span class=m-dim style=font-size:11.5px> · {note}</span>" if note else ""}<div style="margin-top: 6px">{inner}</div></div>')
    return (card('Farbset der Gruppen', f'<div style="display: flex; gap: 6px">{pal}</div>', 'für dein Konto')
            + card('Formen', '<div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px"><span class="m-dim">sonst nur Kreise</span>' + r8.sw(True) + '</div>', 'für dein Konto')
            + card('Galaxien und Welten wechseln', f'<div style="display: flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden">{seg}</div>', 'für dein Konto')
            + card('Animationen', '<div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px"><span class="m-dim">Rahmen, Planeten, Wolken</span>' + r8.sw(True) + '</div>', 'nur dieses Gerät'))


def d11a():
    body = (f'<div style="display: grid; grid-template-columns: 330px 1fr; gap: 16px"><div style="height: 470px; overflow: hidden">{opt_list()}</div>'
            f'<div><b style="font: 700 15px var(--head); color: var(--gold-hi)">Karte und Anzeige</b>{opt_detail()}</div></div>')
    return frame(win(150, 64, 800, 540, 'Optionen', body), menu=True)


def d11b():
    return frame(win(130, 64, 380, 560, 'Optionen', f'<div style="height: 500px; overflow: hidden">{opt_list()}</div>'),
                 win(530, 96, 430, 420, 'Optionen › Karte und Anzeige', opt_detail(), z=25, seed=5), menu=True)


def d11c():
    x = DW - LEXW - 400
    panel = (f'<div class="k-abs" style="left: {x}px; top: {TOPBAR}px; width: 400px; height: {DH - TOPBAR}px; z-index: 18; background: {R["panel"]}; border-left: 1px solid var(--gold); '
             'box-shadow: -12px 0 30px rgb(0 0 0 / 0.7); padding: 12px 16px; overflow: hidden">'
             '<div style="display: flex; gap: 8px; align-items: baseline"><span style="color: var(--gold-hi)">‹ Optionen</span>'
             '<b style="font: 700 15px var(--head); color: var(--gold-hi)">Karte und Anzeige</b><span class="m-dim" style="margin-left: auto">📌 ✕</span></div>' + opt_detail() + '</div>')
    return frame(panel.replace('📌 ✕', f'{icon("pin")} {icon("close")}'), menu=True)


# ------------------------------------------------------------------ d12 Welt verwalten
def d12a():
    dots = f'<div class="k-abs" style="left: {LEFT - 22}px; top: 172px; z-index: 14; color: var(--gold-hi); font-size: 18px">⋯</div>'
    ring = f'<div class="k-abs" style="left: 4px; top: 166px; width: {LEFT - 8}px; height: 104px; z-index: 14; border: 1px solid var(--gold); border-radius: 8px"></div>'
    return frame(dots, ring, popover(LEFT + 8, 168, 280, '<b style="font: 700 14px var(--head); color: var(--gold-hi); display: block; padding: 8px 6px 2px">Aurelia · 1:27:8</b>' + r8.actions_list(r8.ACTS)))


def d12b():
    x, y, w = 124, 64, 520
    w1 = win(x, y, w, 500, 'Aurelia · Oberfläche · 102 / 163 Felder', surface_body(T, False, False, False, False))
    dots = f'<div class="k-abs" style="left: {x + w - 118}px; top: {y + 6}px; z-index: 30; color: var(--gold-hi); font-size: 16px; border: 1px solid var(--gold); border-radius: 6px; padding: 0 6px">⋯</div>'
    return frame(w1, dots, popover(x + w - 290, y + TB + 4, 280, r8.actions_list(r8.ACTS), z=41))


def d12c():
    WX, WY, WW, WH = 150, 80, 430, 320
    aur = (WX + 1 + 12 + 107.6, WY + 1 + TB + 6 + 106)
    w1 = win(WX, WY, WW, WH, 'System 1:27 · deine Welten', system_win(WW - 30, WH - TB - 30, S27))
    menu = popover(aur[0] + 14, aur[1] + 10, 270, '<div class="m-dim" style="font-size: 11.5px; padding: 6px 6px 0">Rechtsklick auf Aurelia</div>' + r8.actions_list(r8.ACTS))
    return frame(w1, menu, Path(*aur).html(0))


# ------------------------------------------------------------------ d13 Login (Passkey first)
def login_col():
    return (r8.btn('Mit Passkey anmelden') + '<div class="m-dim" style="font-size: 12px; text-align: center; margin: 6px 0 14px">Fingerabdruck, Gesicht oder Geräte-PIN</div>'
            + '<div style="display: flex; align-items: center; gap: 8px; color: var(--dim); font-size: 12px"><i style="flex: 1; height: 1px; background: var(--line)"></i>oder'
            '<i style="flex: 1; height: 1px; background: var(--line)"></i></div>' + r8.btn('Mit Name und Passwort', 'ghost') + r8.btn('Code per E-Mail', 'ghost')
            + '<div class="m-dim" style="font-size: 12px; text-align: center; margin-top: 14px">Neu hier? Nur mit Einladung.</div>')


def logo(size=28):
    return (f'<div style="text-align: center; margin-bottom: 14px"><b style="font: 800 {size}px var(--head); color: var(--gold); letter-spacing: 0.08em">NOVA IMPERIUM</b>'
            '<div class="m-dim" style="font-size: 13px">Runde 4 · Tag 9</div></div>')


def gal_bg(op=0.4):
    from playtest_d1 import galaxy
    return f'<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="left: 0; top: 0; opacity: {op}">{galaxy(DW, DH, tip=False, routes=False)}</div>'


def d13a():
    card = (f'<div class="k-abs" style="left: {(DW - 400) // 2}px; top: 120px; width: 400px; z-index: 5; background: rgb(23 17 13 / 0.94); border: 1px solid var(--gold); '
            f'border-radius: 14px; padding: 22px 26px">{logo()}{login_col()}</div>')
    return gal_bg() + card


def d13b():
    info = ('<div class="k-abs" style="left: 60px; top: 230px; z-index: 5; font-size: 15px; line-height: 1.7"><b style="font: 800 34px var(--head); color: var(--gold); letter-spacing: 0.08em">NOVA IMPERIUM</b>'
            '<div>Runde 4 · Tag 9 · 2 Galaxien · 12 Spieler</div><div class="m-dim">Ein Spiel für eine Gruppe von Freunden.</div></div>')
    col = (f'<div class="k-abs" style="left: {DW - 480}px; top: 0; width: 480px; height: {DH}px; z-index: 6; background: {R["panel"]}; border-left: 1px solid var(--gold); padding: 170px 60px 0">'
           '<b style="font: 700 20px var(--head); color: var(--gold-hi)">Anmelden</b><div style="height: 12px"></div>' + login_col() + '</div>')
    return gal_bg(0.55) + info + col


def d13c():
    bar = (f'<div class="k-abs" style="left: 0; right: 0; top: 0; height: {TOPBAR}px; z-index: 6; background: {R["panel"]}; border-bottom: 1px solid var(--line); display: flex; align-items: center; padding: 0 16px">'
           '<b style="font: 800 15px var(--head); color: var(--gold-hi); letter-spacing: 0.06em">NOVA IMPERIUM</b><span class="m-dim" style="margin-left: 14px">Runde 4 · Tag 9</span>'
           '<span class="m-btn" style="margin-left: auto">Anmelden</span></div>')
    pop = popover(DW - 400, TOPBAR + 8, 380, f'<div style="padding: 14px 8px">{login_col()}</div>', z=8)
    return gal_bg(0.7) + bar + pop


# ------------------------------------------------------------------ d14 Admin (tiles with counters)
def tiles(cols=4, sel='Fehler'):
    return (f'<div style="display: grid; grid-template-columns: repeat({cols}, 1fr); gap: 8px">'
            + ''.join(f'<div style="border: 1px solid var(--{"gold" if t == sel else ("red" if t in ("Fehler", "Gemeldete Nachrichten") else "line")}); border-radius: 10px; padding: 10px; '
                      f'background: {"rgb(212 165 55 / 0.12)" if t == sel else "#140f0b"}"><b style="font-size: 13px">{t}</b>'
                      f'<div style="font-size: 12.5px; color: var(--{"red" if t in ("Fehler", "Gemeldete Nachrichten") else "dim"})">{d}</div></div>' for t, d in r8.ADMIN) + '</div>')


def errors():
    return (''.join(f'<div style="padding: 9px 4px; border-bottom: 1px solid var(--line); font-size: 13px"><div style="display: flex; justify-content: space-between">'
                    f'<b style="color: var(--{c})">{t}</b><span class="m-dim" style="font-size: 11.5px">{w}</span></div><span class="m-dim" style="font-size: 12px">{d}</span></div>'
                    for t, w, d, c in [('Browser · Flotten-Formular', 'vor 12 min', 'Thalor · Handy · 2×', 'red'), ('Server · Bergung', 'vor 2 h', 'Runde 4 · 1×', 'red'),
                                       ('Problemmeldung', 'vor 5 h', 'Mira: „Die Zeitleiste springt“', 'orange'), ('Browser · Sternenkarte', 'gestern', 'Thalor · 1× · erledigt', 'dim')])
            + r8.btn('Fehler herunterladen', 'ghost'))


def d14a():
    return frame(win(130, 64, 600, 250, 'Admin', tiles(4)), win(760, 64, 420, 380, 'Admin › Fehler', errors(), z=25, seed=5), menu=True)


def d14b():
    page = (f'<div class="k-abs" style="left: {MX0}px; top: {MY0}px; width: {DW - MX0 - LEXW}px; height: {DH - MY0}px; z-index: 12; background: #0d0a08; padding: 16px 20px; '
            'display: grid; grid-template-columns: 300px 1fr; gap: 20px">'
            f'<div><b style="font: 800 18px var(--head); color: var(--gold)">Admin</b><div style="height: 10px"></div>{tiles(2)}</div>'
            f'<div><b style="font: 700 15px var(--head); color: var(--gold-hi)">Fehler</b>{errors()}</div></div>')
    return frame(page, menu=True)


def d14c():
    menu = popover(DW - 470, TOPBAR + 4, 440, '<div style="padding: 8px 4px">' + ''.join(f'<div style="padding: 8px 6px; border-bottom: 1px solid var(--line); font-size: 14px"><b>{t}</b> '
                                                                                         f'<span class="m-dim" style="font-size: 12px">{d}</span></div>' for t, d in [('Lexikon', 'Gebäude, Forschung, Regeln'), ('Soziales', 'Freunde und Gilde'), ('Optionen', '')])
                   + '<div style="font: 600 11.5px var(--head); letter-spacing: 0.1em; color: var(--orange); margin: 10px 6px 6px">ADMIN</div>' + tiles(2) + '</div>', z=42)
    return frame(menu, win(150, 80, 420, 380, 'Admin › Fehler', errors()), menu=True)


# ------------------------------------------------------------------ small pages: the phone content in a window
def d15():
    return frame(win(150, 64, 430, 480, 'Adamant-Tiefbohrung', r8.w5_body()))


def d16():
    return frame(win(150, 64, 430, 470, 'Optionen › Urlaubsmodus', r8.w6_body()), menu=True)


def d17():
    return frame(shade(), win((DW - 430) // 2, 70, 430, 560, 'Kolonie aufgeben', r8.w7_body(), z=26))


def d18():
    return frame(win(150, 64, 450, 470, 'Optionen › Meine Aktivität &amp; Spielzeit', r8.w8_body()), menu=True)


def d19():
    return frame(win(150, 64, 450, 600, 'Optionen › Benachrichtigungen', f'<div style="height: 540px; overflow: hidden">{r8.w9_body()}</div>'), menu=True)


def d20():
    return frame(win(150, 64, 430, 360, 'Problem melden', r8.w10_body()), menu=True)


def d21():
    return frame(win(150, 64, 450, 600, 'Optionen › Konto', f'<div style="height: 540px; overflow: hidden">{r8.w11_body()}</div>'), menu=True)


def d22():
    return frame(win(150, 64, 520, 470, 'Sonnenkathedrale', r8.w12_body()))


SITS = {'d11': {'a': d11a, 'b': d11b, 'c': d11c}, 'd12': {'a': d12a, 'b': d12b, 'c': d12c}, 'd13': {'a': d13a, 'b': d13b, 'c': d13c}, 'd14': {'a': d14a, 'b': d14b, 'c': d14c},
        'd15': {'a': d15}, 'd16': {'a': d16}, 'd17': {'a': d17}, 'd18': {'a': d18}, 'd19': {'a': d19}, 'd20': {'a': d20}, 'd21': {'a': d21}, 'd22': {'a': d22}}


def build_sheet():
    parts = [f'<figure id="d11-{sid}-{e}" style="margin: 0; display: inline-block"><div class="k-desk">{fn()}</div></figure>' for sid, vs in SITS.items() for e, fn in vs.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest d11</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-wrap: wrap; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'd11-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/d11-sheet.html')
