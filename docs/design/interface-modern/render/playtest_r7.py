"""Playtest round 7 – the tabs not tested yet: Welten, Berichte, Menü.

[E] s8: reports are reached three ways; the list answers „what do I know“.
[E] owner (study D): a small menu for Lexikon, Soziales (friends and guild)
and Optionen (+ Admin). [E] sc: own colour and shape per group. Example
world as everywhere (Nox, Aurelia, Vesper in 1:27). Values are examples.
Proposal only.
"""
import os

from kit import ball, g, phone
from playtest_r1m import header, sheet

WORLDS = [('wasser', 0, 'Nox', '1:27:4', 'red', 'Angriff 14:32 · Bauplatz leer', 0, 'Lager 40 %'),
          ('normal', 1, 'Aurelia', '1:27:8', 'orange', 'Psikristall-Steinbruch 16 · 22 min', 64, 'Psikristall-Lager voll in 1 h 40'),
          ('dschungel', 2, 'Vesper', '1:27:11', 'dim', 'Adamant-Tiefbohrung · 1 h', 80, 'Transport kommt 13:50')]


def tabs_on(i):
    return ('<div class="k-abs" style="left: 0; right: 0; bottom: 0; height: 62px; display: grid; grid-template-columns: repeat(5, 1fr); background: #110c09; border-top: 1px solid var(--line); z-index: 3">'
            + ''.join(f'<span style="display: grid; place-items: center; color: var(--{"gold-hi" if k == i else "dim"})">{g(n, 24)}</span>'
                      for k, n in enumerate(['map', 'planet', 'fleet', 'reports', 'menu'])) + '</div>')


def page(title, sub, inner):
    return ('<div class="k-stars" style="position: absolute; inset: 0"></div><div style="position: relative; padding: 100px 10px 0">'
            f'<div style="display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px"><b style="font: 800 17px var(--head); color: var(--gold)">{title}</b>'
            f'<span class="m-dim" style="font-size: 12.5px">{sub}</span></div>{inner}</div>')


# ------------------------------------------------------------------ s17 Welten
def s17a():
    cards = ''.join(f'<div style="border: 1px solid var(--{"red" if c == "red" else "line"}); border-radius: 10px; padding: 8px; margin: 8px 0; display: grid; grid-template-columns: 54px 1fr; gap: 10px">'
                    f'{ball(k, n, 52)}<div><b style="color: var(--gold-hi)">{nm}</b> <span class="m-dim" style="font-size: 12px">{co}</span>'
                    f'<div style="font-size: 12.5px; color: var(--{c if c != "dim" else "txt"})">{st}</div><div class="m-prog" style="height: 4px; margin: 4px 0"><i style="width: {p}%"></i></div>'
                    f'<div class="m-dim" style="font-size: 12px">{ex}</div></div></div>' for k, n, nm, co, c, st, p, ex in WORLDS)
    return phone(page('Welten', '3 von 6', cards) + header() + sheet() + tabs_on(1))


def s17b():
    head = '<tr><th>Welt</th><th class="n">Bau</th><th class="n">Lager</th><th class="n">!</th></tr>'
    rows = ''.join(f'<tr><td><b>{nm}</b><br /><span class="m-dim" style="font-size: 11.5px">{co}</span></td><td class="n" style="font-size: 12px">{"leer" if p == 0 else str(p) + " %"}</td>'
                   f'<td class="n" style="font-size: 12px">{ {"Nox": "40 %", "Aurelia": "voll in 1 h 40", "Vesper": "–"}[nm] }</td>'
                   f'<td class="n" style="color: var(--{c})">{"●" if c != "dim" else ""}</td></tr>' for k, n, nm, co, c, st, p, ex in WORLDS)
    inner = (f'<table class="m-mini" style="width: 100%">{head}{rows}</table>'
             '<div class="m-dim" style="font-size: 12px; margin-top: 8px">Antippen öffnet die Welt; lange drücken wechselt dorthin, ohne die Seite zu verlassen.</div>')
    return phone(page('Welten', '3 von 6 · Tabelle', inner) + header() + sheet() + tabs_on(1))


def s17c():
    k, n, nm, co, c, st, p, ex = WORLDS[1]
    big = (f'<div style="text-align: center; margin-top: 10px">{ball(k, n, 170)}</div>'
           f'<div style="text-align: center; margin-top: 8px"><b style="font: 800 20px var(--head); color: var(--gold-hi)">{nm}</b> <span class="m-dim">{co}</span></div>'
           f'<div style="text-align: center; font-size: 13px; color: var(--orange)">{st}</div><div style="text-align: center" class="m-dim">{ex}</div>'
           '<div style="display: flex; justify-content: center; gap: 8px; margin-top: 10px">'
           + ''.join(f'<span style="width: 9px; height: 9px; border-radius: 50%; background: var(--{"gold" if i == 1 else "line"})"></span>' for i in range(3)) + '</div>'
           '<div class="m-dim" style="text-align: center; font-size: 12px; margin-top: 6px">‹ Nox · wischen · Vesper ›</div>')
    return phone(page('Welten', '2 von 3', big) + header() + sheet() + tabs_on(1))


# ------------------------------------------------------------------ s18 Berichte
REPORTS = [('Kampf', 'red', 'Feindkontakt! Nox verteidigt · Sieg', '03:12', 'Nox'), ('Auspex', 'orange', 'Auspex-Aktivität bei Aurelia', '04:40', 'Aurelia'),
           ('Auspex', 'green', 'Bericht Varn [1:44:4] · 640 k / 380 k / 180 k', '13:24', 'Varn'), ('Flotte', 'dim', '2 Lastbarken zurück mit Beute', '07:02', 'Vesper'),
           ('Lieferung', 'green', 'Lieferung von Mira · 20 k Promethium', '06:10', 'Nox')]


def s18a():
    chips = '<div class="m-chips">' + ''.join(f'<span class="m-chip{" on" if i == 0 else ""}">{t}</span>' for i, t in enumerate(['Alle', 'Kampf', 'Auspex', 'Flotte', 'Lieferung'])) + '</div>'
    rows = ''.join(f'<div style="display: grid; grid-template-columns: 8px 1fr auto; gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 13px">'
                   f'<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--{c})"></span><span>{t}<br /><span class="m-dim" style="font-size: 11.5px">{kind} · {w}</span></span>'
                   f'<span class="m-dim" style="font-size: 12px">{tm}</span></div>' for kind, c, t, tm, w in REPORTS)
    return phone(page('Berichte', '5 neu', chips + rows) + header() + sheet() + tabs_on(3))


def s18b():
    groups = {}
    for kind, c, t, tm, w in REPORTS:
        groups.setdefault(w, []).append((kind, c, t, tm))
    out = ''
    for w, rs in groups.items():
        out += (f'<div style="font: 600 11.5px var(--head); letter-spacing: 0.1em; color: var(--gold); margin: 10px 0 2px">{w.upper()}</div>'
                + ''.join(f'<div style="display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; border-bottom: 1px solid var(--line)"><span style="color: var(--{c if c != "dim" else "txt"})">{t}</span>'
                          f'<span class="m-dim" style="font-size: 12px">{tm}</span></div>' for kind, c, t, tm in rs))
    return phone(page('Berichte', 'nach Welt', out) + header() + sheet() + tabs_on(3))


def s18c():
    tiles = ''.join(f'<div style="border: 1px solid var(--{c if c != "dim" else "line"}); border-radius: 10px; padding: 8px; font-size: 12.5px">'
                    f'<b style="color: var(--{c if c != "dim" else "txt"})">{kind}</b><br />{t}<div class="m-dim" style="font-size: 11.5px; margin-top: 4px">{w} · {tm}</div></div>'
                    for kind, c, t, tm, w in REPORTS[:4])
    inner = (f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">{tiles}</div>'
             '<div class="m-dim" style="font-size: 12px; margin-top: 8px">Antippen öffnet den Bericht im Blatt seiner Welt.</div>')
    return phone(page('Berichte', 'Kacheln', inner) + header() + sheet() + tabs_on(3))


# ------------------------------------------------------------------ s19 Menü
MENU = [('Lexikon', 'Gebäude, Forschung, Regeln'), ('Soziales', 'Freunde und Gilde'), ('Optionen', 'Anzeige, Farben, Benachrichtigungen'), ('Admin', 'Runde, Universum, Börse')]


def s19a():
    from playtest_r1x import pulled
    from playtest_d1 import galaxy
    rows = ''.join(f'<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 4px; border-bottom: 1px solid var(--line)">'
                   f'<div><b style="color: var(--{"orange" if t == "Admin" else "gold-hi"})">{t}</b><br /><span class="m-dim" style="font-size: 12px">{d}</span></div><span>›</span></div>' for t, d in MENU)
    m = f'<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="left: 0; top: 96px; opacity: 0.5">{galaxy(390, 544, tip=False)}</div>'
    return phone(m + header() + pulled(330, rows) + tabs_on(4))


def s19b():
    tiles = ''.join(f'<div style="border: 1px solid var(--{"orange" if t == "Admin" else "gold"}); border-radius: 12px; padding: 14px 10px; text-align: center">'
                    f'<b style="font: 700 16px var(--head); color: var(--{"orange" if t == "Admin" else "gold-hi"})">{t}</b><div class="m-dim" style="font-size: 12px; margin-top: 4px">{d}</div></div>' for t, d in MENU)
    return phone(page('Menü', '', f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">{tiles}</div>') + header() + sheet() + tabs_on(4))


def s19c():
    from playtest_d1 import galaxy
    rows = ''.join(f'<div style="padding: 12px 14px; border-bottom: 1px solid var(--line)"><b style="color: var(--{"orange" if t == "Admin" else "gold-hi"})">{t}</b><br />'
                   f'<span class="m-dim" style="font-size: 12px">{d}</span></div>' for t, d in MENU)
    drawer = (f'<div class="k-abs" style="left: 0; top: 0; bottom: 0; width: 280px; z-index: 6; background: #17110d; border-right: 1px solid var(--gold); padding-top: 40px; box-shadow: 10px 0 30px rgb(0 0 0 / 0.7)">'
              '<div style="padding: 0 14px 10px; font: 800 17px var(--head); color: var(--gold)">Nova Imperium</div>' + rows + '</div>')
    m = f'<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="left: 0; top: 96px; opacity: 0.4">{galaxy(390, 544, tip=False)}</div>'
    return phone(m + header() + sheet() + tabs_on(4) + drawer)


SITS = {'s17': {'a': s17a, 'b': s17b, 'c': s17c}, 's18': {'a': s18a, 'b': s18b, 'c': s18c}, 's19': {'a': s19a, 'b': s19b, 'c': s19c}}


def build_sheet():
    parts = [f'<figure id="r7-{sid}-{e}" style="margin: 0; display: inline-block">{fn()}</figure>' for sid, vs in SITS.items() for e, fn in vs.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest r7</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-wrap: wrap; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'r7-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/r7-sheet.html')
