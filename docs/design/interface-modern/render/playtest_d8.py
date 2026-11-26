"""Playtest desktop d8–d10 – Welten, Menü and Gilde on the desktop.

[E] so far (the chat is no longer a bubble at the bottom right, s12): windows over the map, independent, pinnable; the Lage sheet sits
in the middle with a fixed width (about 400 px) and two heights; the chat is
the tab „Funk“ of the sheet; the Herold is in the sheet; the Börse has an
icon on the map and an entry in the top menu (list); Welten = cards with
picture (s17); the menu has Lexikon, Soziales, Optionen, Admin (s19).
Example world as everywhere. Proposal only.
"""
import os

from kit import ball, g
from playtest_d1 import DH, DW, TOPBAR, galaxy, legend, stars_bg, topbar, window

WORLDS = [('wasser', 0, 'Nox', '1:27:4', 'red', 'Angriff 14:32 · Bauplatz leer', 0), ('normal', 1, 'Aurelia', '1:27:8', 'orange', 'Steinbruch 16 · 22 min', 64),
          ('dschungel', 2, 'Vesper', '1:27:11', 'dim', 'Tiefbohrung · 1 h', 80)]
MENU = [('Lexikon', 'Gebäude, Forschung, Regeln'), ('Soziales', 'Freunde und Gilde'), ('Börse', 'Angebote als Liste'), ('Optionen', 'Anzeige, Farben, keine Animationen'), ('Admin', 'Runde, Universum, Börse-Modus')]


def mapbg():
    return stars_bg() + f'<div class="k-abs" style="left: 0; top: {TOPBAR}px">{galaxy(DW, DH - TOPBAR, tip=False)}</div>'


def lage(height=46, body='', tabs=('Zeitleiste', 'Funk', 'Herold', 'Berichte'), on='Zeitleiste'):
    """The centred Lage sheet with a fixed width [E] (d7)."""
    w = 440
    t = ''.join(f'<span style="flex: 1; text-align: center; padding: 5px 0; border-bottom: 2px solid var(--{"gold" if x == on else "line"}); color: var(--{"gold-hi" if x == on else "dim"})">{x}</span>' for x in tabs)
    line = ('<div style="display: flex; gap: 8px; align-items: center; font-size: 12.5px"><b style="font: 600 12px var(--head); color: var(--gold-hi)">LAGE ▴</b>'
            '<span style="color: var(--red)">⚠ Angriff auf Nox 14:32</span><span class="m-dim">noch 1 h 12</span></div>')
    inner = line if height <= 50 else f'<div style="display: flex; font-size: 13px; margin-bottom: 8px">{t}</div>{body}'
    return (f'<div class="k-abs" style="left: {(DW - w) / 2:.0f}px; width: {w}px; bottom: 0; height: {height}px; background: #17110d; border: 1px solid var(--gold); border-bottom: 0; '
            f'border-radius: 14px 14px 0 0; box-shadow: 0 -10px 30px rgb(0 0 0 / 0.7); z-index: 4; padding: 6px 16px">{inner}</div>')


def world_cards(small=False):
    out = ''
    for k, n, nm, co, c, st, p in WORLDS:
        sz = 40 if small else 52
        out += (f'<div style="border: 1px solid var(--{"red" if c == "red" else "line"}); border-radius: 10px; padding: 8px; margin: 6px 0; display: grid; grid-template-columns: {sz + 4}px 1fr; gap: 10px; font-size: 12.5px">'
                f'{ball(k, n, sz)}<div><b style="color: var(--gold-hi)">{nm}</b> <span class="m-dim">{co}</span><div style="color: var(--{c if c != "dim" else "txt"})">{st}</div>'
                f'<div class="m-prog" style="height: 4px; margin-top: 4px"><i style="width: {p}%"></i></div></div></div>')
    return out


# ------------------------------------------------------------------ d8 Welten
def d8a():
    return mapbg() + window(30, TOPBAR + 20, 360, 340, 'Welten · 3 von 6', world_cards(), 3) + topbar(0, tabs=True) + lage()


def d8b():
    strip = (f'<div class="k-abs" style="left: 0; top: {TOPBAR}px; bottom: 0; width: 86px; z-index: 3; background: #110c09; border-right: 1px solid var(--line); padding-top: 10px">'
             + ''.join(f'<div style="text-align: center; margin: 8px 0 14px; font-size: 11.5px"><div style="display: inline-block; border-radius: 50%; '
                       f'{"box-shadow: 0 0 0 2px var(--red);" if c == "red" else ""}">{ball(k, n, 48)}</div><br /><b>{nm}</b><br />'
                       f'<span style="color: var(--{c if c != "dim" else "dim"}); font-size: 10.5px">{st.split(" · ")[0]}</span></div>' for k, n, nm, co, c, st, p in WORLDS)
             + '</div>')
    return mapbg() + strip + topbar(0, tabs=True) + lage()


def d8c():
    drop = (f'<div class="k-abs" style="left: 380px; top: {TOPBAR}px; width: 560px; z-index: 5; background: #17110d; border: 1px solid var(--gold); border-top: 0; border-radius: 0 0 12px 12px; '
            'padding: 10px 14px; box-shadow: 0 10px 30px rgb(0 0 0 / 0.7)"><div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px">'
            + ''.join(f'<div style="border: 1px solid var(--{"red" if c == "red" else "line"}); border-radius: 10px; padding: 8px; text-align: center; font-size: 12px">{ball(k, n, 64)}'
                      f'<br /><b style="color: var(--gold-hi)">{nm}</b><br /><span style="color: var(--{c if c != "dim" else "txt"})">{st}</span></div>' for k, n, nm, co, c, st, p in WORLDS)
            + '</div></div>')
    tb = topbar(0, tabs=True).replace('color: var(--gold-hi); border-bottom: 2px solid var(--gold); ', 'color: var(--dim); ', 1)
    tb = tb.replace('color: var(--dim); padding: 14px 4px 12px">' + g('planet', 18), 'color: var(--gold-hi); border-bottom: 2px solid var(--gold); padding: 14px 4px 12px">' + g('planet', 18), 1)
    return mapbg() + drop + tb + lage()


# ------------------------------------------------------------------ d9 Menü
def menu_rows(width=300):
    return ''.join(f'<div style="display: flex; justify-content: space-between; align-items: center; padding: 9px 4px; border-bottom: 1px solid var(--line); width: {width}px">'
                   f'<div><b style="color: var(--{"orange" if t == "Admin" else "gold-hi"})">{t}</b><br /><span class="m-dim" style="font-size: 12px">{d}</span></div><span>›</span></div>' for t, d in MENU)


def d9a():
    dd = (f'<div class="k-abs" style="left: 700px; top: {TOPBAR}px; z-index: 5; background: #17110d; border: 1px solid var(--gold); border-top: 0; border-radius: 0 0 12px 12px; '
          f'padding: 6px 14px; box-shadow: 0 10px 30px rgb(0 0 0 / 0.7)">{menu_rows()}</div>')
    return mapbg() + dd + topbar(0, tabs=True) + lage()


def d9b():
    body = menu_rows(400)
    return mapbg() + topbar(0, tabs=True) + lage(height=380, body=body, tabs=('Zeitleiste', 'Funk', 'Herold', 'Menü'), on='Menü')


def d9c():
    tb = topbar(0, tabs=True).replace(legend(), '')
    tb = tb.replace(f'{g("menu", 18)} Menü', 'Lexikon · Soziales · Börse · Optionen')
    lex = window(820, TOPBAR + 30, 420, 360, 'Lexikon · Sonnenkathedrale', '<div style="font-size: 13px; line-height: 1.5">Liefert Energie für die Minen. Kosten wachsen je Stufe um das 1,5-Fache; '
                 'Energie 20 · Stufe · 1,1<sup>Stufe</sup>.<div class="m-dim" style="margin-top: 8px">Verwandt: Fusionssanktum · Machina-Energetik</div></div>', 4)
    return mapbg() + lex + tb + lage()


# ------------------------------------------------------------------ d10 Gilde
GUILD_MEMBERS = [('Mira', '1:26', 'online', 'hält Nox bis 15:00'), ('Thalor', '1:44', 'vor 5 min', 'spioniert 1:31'), ('du', '1:27', 'online', '')]
MSGS = [('Mira', '14:02', 'Ich halte Nox mit 40 Abfangjägern bis 15:00.'), ('Thalor', '14:05', 'Valcor hat 3 Welten in 1:31, Bericht kommt.'), ('du', '14:06', 'Danke! Abwehr auf Nox läuft.')]


def members():
    return ''.join(f'<div style="display: grid; grid-template-columns: 10px 1fr; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px solid var(--line); font-size: 13px">'
                   f'<span style="width: 8px; height: 8px; border-radius: 50%; background: var(--{"green" if st == "online" else "dim"})"></span>'
                   f'<div><b style="color: {"#6fb8ff" if n == "du" else "#6fe0a8"}">{n}</b> <span class="m-dim" style="font-size: 12px">{c} · {st}</span><br /><span style="font-size: 12px">{d}</span></div></div>'
                   for n, c, st, d in GUILD_MEMBERS)


def msgs():
    return ''.join(f'<div style="display: flex; justify-content: {"flex-end" if w == "du" else "flex-start"}; margin: 5px 0"><div style="max-width: 80%; background: {"rgb(111 184 255 / 0.15)" if w == "du" else "#211812"}; '
                   f'border: 1px solid {"#6fb8ff" if w == "du" else "#6fe0a8"}; border-radius: 10px; padding: 4px 8px; font-size: 12.5px"><b style="color: {"#6fb8ff" if w == "du" else "#6fe0a8"}; font-size: 11.5px">{w}</b> '
                   f'<span class="m-dim" style="font-size: 11px">{t}</span><br />{m}</div></div>' for w, t, m in MSGS)


def d10a():
    body = f'<div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 14px"><div>{members()}</div><div>{msgs()}</div></div>'
    return mapbg() + window(30, TOPBAR + 20, 640, 330, 'Gilde · 3 Mitglieder · Krieg mit Haus Valcor', body, 3) + topbar(0, tabs=True) + lage()


def d10b():
    mw = window(30, TOPBAR + 20, 300, 240, 'Gilde · Mitglieder', members(), 3)
    return mapbg() + mw + topbar(0, tabs=True) + lage(height=330, body=msgs() + '<div class="m-dim" style="border: 1px solid var(--line); border-radius: 16px; padding: 5px 10px; font-size: 12.5px; margin-top: 8px">Nachricht an die Gilde …</div>', on='Funk')


def d10c():
    from playtest_d1 import SYSTEMS
    w, h = DW, DH - TOPBAR
    tags = ''
    for n, sysname, st, d in GUILD_MEMBERS[:2]:
        fx, fy, _ = SYSTEMS[sysname]
        x, y = fx * w, fy * h + TOPBAR
        tags += (f'<div class="k-abs" style="left: {x + 16:.0f}px; top: {y - 34:.0f}px; z-index: 3; background: #17110d; border: 1px solid #6fe0a8; border-radius: 8px; padding: 2px 8px; font-size: 12px">'
                 f'<b style="color: #6fe0a8">{n}</b> <span class="m-dim">{st}</span><br />{d}</div>')
    chips = f'<div class="k-abs" style="left: 20px; top: {TOPBAR + 14}px; z-index: 3; display: flex; gap: 6px"><span class="m-chip">Besitz</span><span class="m-chip on">Gilde</span><span class="m-chip">Börse</span></div>'
    return mapbg() + chips + tags + topbar(0, tabs=True) + lage(height=300, body=msgs(), on='Funk')


SITS = {'d8': {'a': d8a, 'b': d8b, 'c': d8c}, 'd9': {'a': d9a, 'b': d9b, 'c': d9c}, 'd10': {'a': d10a, 'b': d10b, 'c': d10c}}


def build_sheet():
    parts = [f'<figure id="{sid}-{sid}-{e}" style="margin: 0"><div class="k-desk">{fn()}</div></figure>' for sid, vs in SITS.items() for e, fn in vs.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest d8</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-direction: column; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'd8-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/d8-sheet.html')
