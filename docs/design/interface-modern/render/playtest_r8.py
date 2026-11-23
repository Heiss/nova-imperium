"""Playtest round 8 – the pages „Welt und Konto“ on the phone (owner, 2026-11-23).

[E] W13: the existing pages without a „Modern“ design get playtest rounds;
first the phone, then the desktop; the first group is „Welt und Konto“;
small pages come as one proposal to approve, larger ones with three
variants. The contents are today's (src/client/views/Options.svelte, Auth,
Admin, logic/demolition.ts, logic/abandon.ts, features/rename.ts,
logic/own-activity.ts, logic/push-options.ts). Catalogue values: the
Sonnenkathedrale costs [75, 30] · 1.5^(L − 1) and gives 20 · L · 1.1^L
energy (src/features/solar, src/core/rates.ts). Every other number is an
example. Proposal only.
"""
import os

from kit import I, ball, g, phone
from playtest_final import urgent_line as sheet
from playtest_r1m import header
from playtest_r1x import pulled
from playtest_r7 import page, tabs_on


def sw(on=True):
    return (f'<span style="display: inline-block; width: 38px; height: 22px; border-radius: 11px; background: {"var(--gold)" if on else "#3b2f22"}; position: relative; flex: none">'
            f'<i style="position: absolute; top: 3px; {"right" if on else "left"}: 3px; width: 16px; height: 16px; border-radius: 50%; background: #f4ecd8"></i></span>')


def row(label, value='', more=True, col='txt', right=None):
    r = right if right is not None else (f'<span class="m-dim" style="font-size: 12.5px">{value}</span>' + ('<span style="color: var(--gold-hi)"> ›</span>' if more else ''))
    return (f'<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--line); font-size: 13.5px">'
            f'<span style="color: var(--{col})">{label}</span><span style="display: flex; gap: 4px; align-items: center">{r}</span></div>')


def group(title, rows):
    return (f'<div style="font: 600 11.5px var(--head); letter-spacing: 0.1em; color: var(--gold); margin: 12px 4px 4px">{title}</div>'
            f'<div style="border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: #140f0b">{rows}</div>')


def btn(text, kind='gold', block=True):
    style = {'gold': '', 'red': 'background: var(--red); color: #120d0a; border-color: var(--red);',
             'ghost': 'background: none; color: var(--gold-hi); border: 1px solid var(--gold);', 'dis': 'opacity: 0.45;'}[kind]
    return f'<span class="m-btn big" style="{"display: block; " if block else ""}text-align: center; margin-top: 8px; {style}">{text}</span>'


def field(label, value='', pw=False):
    v = '•' * 10 if pw and value else value
    return (f'<div style="margin: 6px 0"><div class="m-dim" style="font-size: 12px; margin-bottom: 3px">{label}</div>'
            f'<div style="border: 1px solid var(--line); border-radius: 8px; padding: 9px 10px; font-size: 14px; background: #0f0b08">{v or "&nbsp;"}</div></div>')


def stars():
    return '<div class="k-stars" style="position: absolute; inset: 0"></div>'


def dim_map():
    from playtest_d1 import galaxy
    return stars() + f'<div class="k-abs" style="left: 0; top: 96px; opacity: 0.45">{galaxy(390, 544, tip=False)}</div>'


# ------------------------------------------------------------------ w1 Optionen
def w1a():
    body = (group('SPIEL', row('Spähschädel pro Auspex-Erkundung', '3') + row('(?)-Symbol', 'als Symbol') + row('Stufenübersicht', 'als Symbol') + row('Hauptplanet', 'Nox'))
            + group('KARTE UND ANZEIGE', row('Farbset', 'Standard') + row('Formen der Gruppen', right=sw(True)) + row('Galaxien wechseln', 'Auswahl und Wischen') + row('Animationen', right=sw(True)))
            + group('RUNDE', row('Urlaubsmodus', 'aus') + row('Meine Aktivität &amp; Spielzeit', 'heute 1 h 12') + row('Rundenarchiv', '')))
    return phone(page('Optionen', 'Menü › Optionen', f'<div style="height: 520px; overflow: hidden">{body}</div>') + header() + sheet() + tabs_on(4))


def w1b():
    chips = ''.join(f'<span class="m-chip{" on" if c == "Anzeige" else ""}">{c}</span>' for c in ['Spiel', 'Anzeige', 'Runde', 'Gerät', 'Konto'])
    pal = ''.join(f'<div style="border: 1px solid var(--{"gold" if i == 0 else "line"}); border-radius: 8px; padding: 6px 8px; flex: 1; text-align: center; font-size: 12px">'
                  f'<div style="display: flex; gap: 3px; justify-content: center; margin-bottom: 4px">{"".join(f"<i style=\'width: 10px; height: 10px; border-radius: 50%; background: {c}\'></i>" for c in cs)}</div>{n}</div>'
                  for i, (n, cs) in enumerate([('Standard', ['#6fb8ff', '#e070c8', '#6fe0a8', '#ee7660']), ('Rot-Grün', ['#f4f0e6', '#4fd1c5', '#9be15d', '#ee7660']),
                                               ('Kontrast', ['#ffffff', '#ffd400', '#00e5ff', '#ff3d7f'])]))
    seg = ''.join(f'<span style="flex: 1; text-align: center; padding: 6px 0; font-size: 12px; {"background: rgb(212 165 55 / 0.18); color: var(--gold-hi);" if i == 1 else "color: var(--dim);"}">{t}</span>'
                  for i, t in enumerate(['nur Auswahl', 'Auswahl + Wischen', 'nur Wischen']))
    card = lambda t, inner: (f'<div style="border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin: 8px 0; background: #140f0b">'
                             f'<b style="font-size: 13.5px">{t}</b><div style="margin-top: 6px">{inner}</div></div>')
    body = (f'<div class="m-chips" style="margin-bottom: 6px">{chips}</div>'
            + card('Farbset der Gruppen', f'<div style="display: flex; gap: 6px">{pal}</div>')
            + card('Formen', '<div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px"><span class="m-dim">Kreis, Raute, Quadrat, Dreieck – sonst nur Kreise</span>' + sw(True) + '</div>')
            + card('Galaxien und Welten wechseln', f'<div style="display: flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden">{seg}</div>')
            + card('Animationen', '<div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px"><span class="m-dim">Rahmen, Planeten, Wolken; gilt für dieses Gerät</span>' + sw(True) + '</div>'))
    return phone(page('Optionen', '', body) + header() + sheet() + tabs_on(4))


def w1c():
    acc = lambda t, sub, open_=False, inner='': (f'<div style="border-bottom: 1px solid var(--line); padding: 10px 2px"><div style="display: flex; justify-content: space-between; font-size: 14px">'
                                                f'<b style="color: var(--{"gold-hi" if open_ else "txt"})">{t}</b><span class="m-dim" style="font-size: 12px">{sub} {"▾" if open_ else "▸"}</span></div>{inner}</div>')
    spiel = ('<div style="margin-top: 8px; font-size: 13px; display: grid; grid-template-columns: 1fr auto; gap: 8px 10px; align-items: center">'
             '<span>Spähschädel pro Auspex-Erkundung</span><span class="m-stepper"><span>−</span><b>3</b><span>+</span></span>'
             '<span>(?)-Symbol</span><span class="m-chip on">als Symbol ▾</span><span>Stufenübersicht</span><span class="m-chip on">als Symbol ▾</span>'
             '<span>Hauptplanet</span><span class="m-chip on">Nox ▾</span></div>')
    body = ('<div style="border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font-size: 13.5px; color: var(--dim); margin-bottom: 4px">⌕ Option suchen …</div>'
            + acc('Spiel', '4', True, spiel) + acc('Karte und Anzeige', 'Farbset, Formen, Wischen, Animationen') + acc('Runde', 'Urlaubsmodus, Spielzeit, Archiv')
            + acc('Gerät', 'App, Benachrichtigungen') + acc('Konto', 'Passwort, Passkeys, löschen') + acc('Problem melden', ''))
    return phone(dim_map() + header() + pulled(520, '<b style="font: 700 16px var(--head); color: var(--gold-hi)">Optionen</b>' + body) + tabs_on(4))


# ------------------------------------------------------------------ w2 Welt verwalten
def world_card(dim=False):
    return (f'<div style="border: 1px solid var(--line); border-radius: 10px; padding: 8px; display: grid; grid-template-columns: 54px 1fr auto; gap: 10px; align-items: center;{" opacity: 0.5" if dim else ""}">'
            f'{ball("normal", 1, 52)}<div><b style="color: var(--gold-hi)">Aurelia</b> <span class="m-dim" style="font-size: 12px">1:27:8 · Kolonie</span>'
            '<div style="font-size: 12.5px; color: var(--orange)">Psikristall-Lager voll in 1 h 40</div></div><span style="font-size: 20px; color: var(--gold-hi)">⋯</span></div>')


def actions_list(items):
    return ''.join(f'<div style="padding: 12px 6px; border-bottom: 1px solid var(--line); font-size: 14px; color: var(--{c})"><b>{t}</b><div class="m-dim" style="font-size: 12px">{d}</div></div>'
                   for t, d, c in items)


ACTS = [('Umbenennen', 'Name der Welt ändern', 'txt'), ('Als Hauptplanet festlegen', 'heute: Nox', 'txt'), ('Kolonie aufgeben', 'nicht rückgängig zu machen', 'red')]


def w2a():
    body = '<b style="font: 700 15px var(--head); color: var(--gold-hi)">Aurelia</b> <span class="m-dim" style="font-size: 12px">· verwalten</span>' + actions_list(ACTS) + btn('Schließen', 'ghost')
    return phone(page('Welten', '3 von 6', world_card()) + header() + pulled(300, body) + tabs_on(1))


def w2b():
    chips = ''.join(f'<span class="m-chip{" on" if c == "Verwalten" else ""}">{c}</span>' for c in ['Oberfläche', 'Infos', 'Verwalten'])
    body = (f'<div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px">{ball("normal", 1, 48)}<div><b style="font: 700 16px var(--head); color: var(--gold-hi)">Aurelia</b><br />'
            '<span class="m-dim" style="font-size: 12px">1:27:8 · Kolonie · 102 / 163 Felder</span></div></div>'
            f'<div class="m-chips" style="margin-bottom: 8px">{chips}</div>'
            + field('Name', 'Aurelia') + btn('Namen speichern', 'ghost')
            + group('HAUPTPLANET', row('Aurelia als Hauptplanet', right=sw(False)) + '<div class="m-dim" style="font-size: 12px; padding: 6px 12px">Heute: Nox</div>')
            + '<div style="border: 1px solid var(--red); border-radius: 10px; padding: 10px 12px; margin-top: 12px"><b style="color: var(--red)">Kolonie aufgeben</b>'
            '<div class="m-dim" style="font-size: 12px">Alles auf Aurelia und ihrem Mond geht verloren.</div>' + btn('Kolonie aufgeben …', 'red') + '</div>')
    return phone(page('', '', body) + header() + sheet() + tabs_on(1))


def w2c():
    menu = ('<div class="k-abs" style="left: 60px; top: 220px; width: 270px; z-index: 5; background: #1c1510; border: 1px solid var(--gold); border-radius: 12px; '
            'box-shadow: 0 12px 30px rgb(0 0 0 / 0.8); padding: 4px 10px">' + actions_list(ACTS) + '</div>')
    others = (world_card(True).replace('Aurelia', 'Nox').replace('1:27:8 · Kolonie', '1:27:4 · Hauptplanet').replace('color: var(--orange)">Psikristall-Lager voll in 1 h 40', 'color: var(--red)">Angriff 14:32')
              + '<div style="height: 8px"></div>')
    hint = '<div class="m-dim" style="font-size: 12px; margin-top: 8px; text-align: center">lange drücken: verwalten</div>'
    return phone(page('Welten', '3 von 6', others + world_card() + hint) + menu + header() + sheet() + tabs_on(1))


# ------------------------------------------------------------------ w3 Login
def logo():
    return ('<div style="text-align: center; margin: 0 0 14px"><b style="font: 800 24px var(--head); color: var(--gold); letter-spacing: 0.08em">NOVA IMPERIUM</b>'
            '<div class="m-dim" style="font-size: 12.5px">Runde 4 · Tag 9</div></div>')


def auth(inner):
    from playtest_d1 import galaxy
    bg = stars() + f'<div class="k-abs" style="left: 0; top: 0; opacity: 0.35">{galaxy(390, 780, tip=False, routes=False)}</div>'
    return phone(bg + f'<div style="position: relative; padding: 110px 22px 0">{logo()}{inner}</div>')


def w3a():
    card = ('<div style="background: rgb(23 17 13 / 0.92); border: 1px solid var(--gold); border-radius: 14px; padding: 14px 16px">'
            + field('Name', 'Leander') + field('Passwort', 'x', pw=True)
            + '<div style="display: flex; gap: 8px; align-items: center; font-size: 13px; margin: 8px 0">' + sw(True) + 'Gerät speichern</div>'
            + btn('Einloggen') + '<div style="display: flex; justify-content: space-between; font-size: 12.5px; margin-top: 10px; color: var(--gold-hi)">'
            '<span>Passwort vergessen?</span><span>Code per E-Mail</span></div></div>'
            + btn('Mit Passkey anmelden', 'ghost'))
    return auth(card)


def w3b():
    inner = (btn('🔑 Mit Passkey anmelden').replace('🔑 ', '') + '<div class="m-dim" style="font-size: 12px; text-align: center; margin: 6px 0 16px">Fingerabdruck, Gesicht oder Geräte-PIN</div>'
             + '<div style="display: flex; align-items: center; gap: 8px; color: var(--dim); font-size: 12px"><i style="flex: 1; height: 1px; background: var(--line)"></i>oder<i style="flex: 1; height: 1px; background: var(--line)"></i></div>'
             + btn('Mit Name und Passwort', 'ghost') + btn('Code per E-Mail', 'ghost')
             + '<div class="m-dim" style="font-size: 12px; text-align: center; margin-top: 18px">Neu hier? Nur mit Einladung.</div>')
    return auth(inner)


def w3c():
    steps = '<div style="display: flex; gap: 6px; margin-bottom: 10px">' + ''.join(f'<i style="flex: 1; height: 4px; border-radius: 2px; background: var(--{"gold" if i < 2 else "line"})"></i>' for i in range(3)) + '</div>'
    meth = ''.join(f'<div style="border: 1px solid var(--{"gold" if i == 0 else "line"}); border-radius: 12px; padding: 12px 14px; margin: 8px 0; background: rgb(23 17 13 / 0.92)">'
                   f'<b style="color: var(--{"gold-hi" if i == 0 else "txt"})">{t}</b><div class="m-dim" style="font-size: 12px">{d}</div></div>'
                   for i, (t, d) in enumerate([('Passkey', 'auf diesem Gerät gespeichert'), ('Passwort', ''), ('Code per E-Mail', 'an die hinterlegte Adresse')]))
    inner = (steps + '<div style="font-size: 15px; margin-bottom: 4px">Willkommen zurück, <b style="color: var(--gold-hi)">Leander</b>.</div>'
             '<div class="m-dim" style="font-size: 12.5px">Wie willst du dich anmelden?</div>' + meth
             + '<div style="font-size: 12.5px; color: var(--gold-hi); margin-top: 8px">‹ anderer Name</div>')
    return auth(inner)


# ------------------------------------------------------------------ w4 Admin
ADMIN = [('Ereignisprotokoll', '214 heute'), ('Spieler', '12 · 2 im Urlaub'), ('Aufträge', '38 laufen'), ('Fehler', '3 neu'),
         ('Gemeldete Nachrichten', '1 neu'), ('Einladungen', '2 offen'), ('Universum', 'Runde 4 · Tag 9'), ('Servernachricht', 'keine')]


def w4a():
    chips = ''.join(f'<span class="m-chip{" on" if t == "Fehler" else ""}" style="white-space: nowrap">{t}</span>' for t, _ in ADMIN)
    errs = ''.join(f'<div style="padding: 9px 4px; border-bottom: 1px solid var(--line); font-size: 13px"><div style="display: flex; justify-content: space-between">'
                   f'<b style="color: var(--{c})">{t}</b><span class="m-dim" style="font-size: 11.5px">{w}</span></div><span class="m-dim" style="font-size: 12px">{d}</span></div>'
                   for t, w, d, c in [('Browser · Flotten-Formular', 'vor 12 min', 'Thalor · Handy · 2×', 'red'), ('Server · Bergung', 'vor 2 h', 'Runde 4 · 1×', 'red'),
                                      ('Problemmeldung', 'vor 5 h', 'Mira: „Die Zeitleiste springt“', 'orange'), ('Browser · Sternenkarte', 'gestern', 'Thalor · 1× · erledigt', 'dim')])
    body = f'<div style="display: flex; gap: 6px; overflow: hidden; margin-bottom: 8px">{chips}</div>' + errs + btn('Fehler herunterladen', 'ghost')
    return phone(page('Admin', 'nur für dich', body) + header() + sheet() + tabs_on(4))


def w4b():
    cards = ''.join(f'<div style="border: 1px solid var(--{"red" if t in ("Fehler", "Gemeldete Nachrichten") else "line"}); border-radius: 10px; padding: 10px; background: #140f0b">'
                    f'<b style="font-size: 13px">{t}</b><div style="font-size: 12.5px; color: var(--{"red" if t in ("Fehler", "Gemeldete Nachrichten") else "dim"})">{d}</div></div>' for t, d in ADMIN)
    return phone(page('Admin', 'Übersicht', f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">{cards}</div>') + header() + sheet() + tabs_on(4))


def w4c():
    from playtest_d1 import row as trow, now_line
    tab = ''.join(f'<span style="flex: 1; text-align: center; padding: 5px 0; border-bottom: 2px solid var(--{"gold" if t == "Admin" else "line"}); color: var(--{"gold-hi" if t == "Admin" else "dim"})">{t}</span>'
                  for t in ['Zeitleiste', 'Funk', 'Berichte', 'Admin'])
    rows = (trow('12:58', '<b style="color: var(--red)">Fehler</b> · Flotten-Formular · Thalor', 'red') + trow('11:40', 'Einladung angenommen · Leander', 'green')
            + trow('09:15', '<b style="color: var(--orange)">Gemeldet</b> · Nachricht von Thalor', 'orange') + trow('07:00', 'Tagesbericht · 12 Spieler aktiv', ''))
    body = (f'<div style="display: flex; font-size: 13px; margin-bottom: 6px">{tab}</div>'
            + f'<div style="margin: 6px 0 0 20px; border-left: 2px solid var(--line); padding-left: 10px">{rows}</div>'
            + '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px">' + ''.join(f'<span class="m-chip" style="text-align: center">{t}</span>' for t in ['Universum', 'Einladungen', 'Spieler', 'Servernachricht']) + '</div>')
    return phone(dim_map() + header() + pulled(400, body) + tabs_on(0))


# ------------------------------------------------------------------ small pages: one proposal each
def solar_costs(level):
    f = 1.5 ** (level - 1)
    return round(75 * f), round(30 * f)


def energy(level):
    return round(20 * level * 1.1 ** level)


def de(n):
    return f'{n:,}'.replace(',', '.')


def w5():
    body = ('<div style="display: flex; gap: 10px; align-items: center"><div class="k-tile ok" style="width: 54px; height: 54px"><img src="' + I + 'buildings/metal_mine.svg" alt="" /></div>'
            '<div><b style="font: 700 16px var(--head); color: var(--gold-hi)">Adamant-Tiefbohrung 18</b><br /><span class="m-dim" style="font-size: 12.5px">Fördert Adamant.</span></div></div>'
            + btn('Ausbauen auf 19') + '<div style="text-align: center; font-size: 13px; color: var(--gold-hi); margin-top: 10px">Zurückbauen auf 17 …</div>'
            + '<div style="border: 1px solid var(--red); border-radius: 10px; padding: 10px 12px; margin-top: 14px; background: rgb(238 118 96 / 0.06)">'
            '<b style="color: var(--red)">Zurückbauen: 18 → 17</b><div class="m-kv" style="margin-top: 6px"><span>Erstattung</span><b>50 % der Kosten von Stufe 18</b>'
            '<span>Dauer</span><b>die Hälfte der Bauzeit</b><span>Felder</span><b>gibt 1 Feld frei</b></div>' + btn('Zurückbauen', 'red') + '</div>'
            '<div class="m-dim" style="font-size: 11.5px; margin-top: 6px">Erstattung und Dauer stellt der Admin je Runde ein (−100 % bis +100 %).</div>')
    return phone(dim_map() + header() + pulled(470, body) + tabs_on(1))


def w6():
    checks = ''.join(f'<div style="display: flex; gap: 8px; font-size: 13px; padding: 4px 0"><b style="color: var(--{"green" if ok else "red"})">{"✓" if ok else "✗"}</b><span>{t}</span></div>'
                     for ok, t in [(True, 'Keine eigenen Flotten unterwegs'), (False, 'Aurelia baut: Psikristall-Steinbruch 16 · 22 min'), (True, 'Keine Forschung läuft'), (True, 'Die Schiffsschmiede ist frei')])
    body = ('<div style="border: 1px solid var(--line); border-radius: 10px; padding: 12px; background: #140f0b; font-size: 13px; line-height: 1.5">'
            'Im Urlaubsmodus steht die Produktion still, und alle deine Planeten und Monde sind geschützt. Er dauert mindestens <b>48 h</b>.</div>'
            + group('VORAUSSETZUNGEN', f'<div style="padding: 6px 12px">{checks}</div>') + btn('Urlaubsmodus aktivieren', 'dis')
            + '<div class="m-dim" style="font-size: 12px; text-align: center; margin-top: 6px">Frei in 22 min, wenn Aurelia fertig ist</div>')
    return phone(page('Urlaubsmodus', 'Optionen › Runde', body) + header() + sheet() + tabs_on(4))


def w7():
    loss = ''.join(f'<li style="margin: 2px 0">{t}</li>' for t in ['alle Gebäude und die Verteidigung', 'die Schiffe vor Ort', 'die Rohstoffe im Lager', 'der Mond mit allem darauf'])
    body = (f'<div style="display: flex; gap: 10px; align-items: center">{ball("normal", 1, 48)}<div><b style="font: 700 16px var(--head); color: var(--red)">Kolonie aufgeben</b><br />'
            '<span style="font-size: 13px">Aurelia [1:27:8]</span></div></div>'
            f'<div style="font-size: 13px; margin-top: 8px">Dabei geht verloren:</div><ul style="font-size: 13px; margin: 4px 0 8px 18px; padding: 0">{loss}</ul>'
            '<div style="font-size: 13px">Die Position 1:27:8 ist danach <b>24 Stunden</b> gesperrt.</div>'
            '<div style="font-size: 13px; color: var(--red); font-weight: 700; margin: 8px 0">Das kann nicht rückgängig gemacht werden.</div>'
            + field('Passwort zur Bestätigung', 'x', pw=True) + btn('Kolonie aufgeben', 'red') + btn('Abbrechen', 'ghost'))
    return phone(dim_map() + header() + pulled(520, body) + tabs_on(1))


def w8():
    days = [('Mo', 52, 40), ('Di', 75, 61), ('Mi', 20, 12), ('Do', 0, 0), ('Fr', 95, 88), ('Sa', 64, 47), ('heute', 72, 55)]
    bars = ''.join(f'<div style="flex: 1; text-align: center; font-size: 11px"><div style="height: 110px; display: flex; align-items: flex-end; justify-content: center">'
                   f'<i style="width: 22px; height: {h}%; background: var(--{"gold" if d == "heute" else "line"}); border-radius: 4px 4px 0 0"></i></div>'
                   f'<span class="m-dim">{d}</span><br /><span>{a}</span></div>' for d, h, a in days)
    kpi = ''.join(f'<div style="border: 1px solid var(--line); border-radius: 10px; padding: 8px; text-align: center; background: #140f0b"><b style="font-size: 16px; color: var(--gold-hi)">{v}</b>'
                  f'<div class="m-dim" style="font-size: 11.5px">{t}</div></div>' for t, v in [('heute', '1 h 12'), ('7 Tage', '6 h 40'), ('diese Runde', '31 h'), ('alle Runden', '112 h')])
    body = (f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">{kpi}</div>'
            + group('GESCHÄTZTE AKTIVE SPIELZEIT · SPIELAKTIONEN', f'<div style="display: flex; padding: 10px 6px">{bars}</div>')
            + '<div class="m-dim" style="font-size: 12px; margin-top: 8px">Alle Angaben sind Schätzungen (UTC); während der Runde siehst nur du sie. Zuletzt aktiv: gerade eben.</div>')
    return phone(page('Meine Aktivität &amp; Spielzeit', 'Optionen › Runde', body) + header() + sheet() + tabs_on(4))


PUSH = [('BAU', ['Gebäude fertig', 'Forschung abgeschlossen', 'Auftrag der Schiffsschmiede abgeschlossen']),
        ('FLOTTEN', ['Eigene Flotten: Ankunft, Bericht und Rückkehr', 'Sturmangriff auf deine Planeten', 'Auspex-Aktivität bei deinen Planeten', 'Lieferung eines anderen Spielers']),
        ('GILDE UND NACHRICHTEN', ['Gildenereignisse', 'Nachrichten im Gilden-Chat', 'Persönliche Nachrichten']), ('SERVER', ['Servernachrichten', 'Neue Version'])]


def w9():
    top = ('<div style="border: 1px solid var(--gold); border-radius: 10px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; background: #140f0b">'
           '<div><b>Auf diesem Gerät</b><div class="m-dim" style="font-size: 12px">Browser-Benachrichtigungen an</div></div>' + sw(True) + '</div>'
           '<div style="border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin-top: 8px; display: flex; justify-content: space-between; align-items: center">'
           '<div><b>App installieren</b><div class="m-dim" style="font-size: 12px">auf den Startbildschirm</div></div><span class="m-btn">Installieren</span></div>')
    groups = ''.join(group(t, ''.join(row(x, right=sw(x not in ('Neue Version', 'Gildenereignisse'))) for x in xs[:3])) for t, xs in PUSH[:2])
    return phone(page('Benachrichtigungen', 'Optionen › Gerät', f'<div style="height: 520px; overflow: hidden">{top}{groups}</div>') + header() + sheet() + tabs_on(4))


def w10():
    body = ('<b style="font: 700 16px var(--head); color: var(--gold-hi)">Problem melden</b>'
            '<div class="m-dim" style="font-size: 12px; margin: 4px 0 8px">Wird mitgeschickt: Seite „Flotten“, Gerät Handy, Version 26.11.25, 13:20</div>'
            '<div class="m-dim" style="font-size: 12px; margin-bottom: 3px">Was ist passiert?</div>'
            '<div style="border: 1px solid var(--gold); border-radius: 8px; padding: 9px 10px; height: 120px; font-size: 14px; background: #0f0b08">Beim Losschicken springt die Zeitleiste nach oben.</div>'
            + btn('Senden') + '<div class="m-dim" style="font-size: 12px; text-align: center; margin-top: 6px">Der Admin sieht die Meldung im Reiter „Fehler“.</div>')
    return phone(dim_map() + header() + pulled(380, body) + tabs_on(4))


def w11():
    keys = ''.join(row(t, d, more=False, right=f'<span class="m-dim" style="font-size: 12px">{d}</span><span style="color: var(--red); margin-left: 8px">✕</span>') for t, d in [('Laptop', 'seit 12.11.'), ('Handy', 'seit 20.11.')])
    body = (group('PASSKEYS', keys + row('Passkey hinzufügen', '', col='gold-hi'))
            + group('PASSWORT', '<div style="padding: 4px 12px 10px">' + field('Bisheriges Passwort', 'x', True) + field('Neues Passwort') + field('Neues Passwort wiederholen') + btn('Passwort ändern', 'ghost') + '</div>')
            + '<div style="border: 1px solid var(--red); border-radius: 10px; padding: 10px 12px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center">'
            '<b style="color: var(--red)">Account löschen</b><span style="color: var(--red)">›</span></div>')
    return phone(page('Konto', 'Optionen › Konto', f'<div style="height: 520px; overflow: hidden">{body}</div>') + header() + sheet() + tabs_on(4))


def w12():
    tabs = ''.join(f'<span style="padding: 6px 10px; border-bottom: 2px solid var(--{"gold" if t == "Stufen" else "line"}); color: var(--{"gold-hi" if t == "Stufen" else "dim"})">{t}</span>'
                   for t in ['Übersicht', 'Stufen', 'Schaltet frei'])
    rows = ''
    for L in range(19, 24):
        a, c = solar_costs(L)
        rows += (f'<tr style="border-bottom: 1px solid var(--line){"; background: rgb(212 165 55 / 0.1)" if L == 19 else ""}"><td style="padding: 6px 4px"><b>{L}</b></td>'
                 f'<td style="padding: 6px 4px; text-align: right">{de(a)}<br />{de(c)}</td><td style="padding: 6px 4px; text-align: right">{de(energy(L))}</td>'
                 f'<td style="padding: 6px 4px; text-align: right; color: var(--green)">+{de(energy(L) - energy(18))}</td></tr>')
    table = ('<table style="width: 100%; border-collapse: collapse; font-size: 12.5px"><tr class="m-dim" style="font-size: 11.5px"><td>Stufe</td><td style="text-align: right">Adamant<br />Psikristall</td>'
             f'<td style="text-align: right">Energie</td><td style="text-align: right">mehr als heute</td></tr>{rows}</table>')
    body = ('<div style="display: flex; gap: 10px; align-items: center; margin-bottom: 6px"><div class="k-tile ok" style="width: 54px; height: 54px"><img src="' + I + 'buildings/solar_plant.svg" alt="" /></div>'
            '<div><b style="font: 700 16px var(--head); color: var(--gold-hi)">Sonnenkathedrale 18</b><br /><span class="m-dim" style="font-size: 12.5px">Liefert Energie für die Minen.</span></div></div>'
            f'<div style="display: flex; font-size: 13px; margin-bottom: 8px">{tabs}</div>{table}'
            '<div class="m-dim" style="font-size: 12px; margin-top: 6px">Energie bei 100 %; die Bauzeit-Spalte wie heute.</div>')
    return phone(page('', '', body) + header() + sheet() + tabs_on(1))


SITS = {'w1': {'a': w1a, 'b': w1b, 'c': w1c}, 'w2': {'a': w2a, 'b': w2b, 'c': w2c}, 'w3': {'a': w3a, 'b': w3b, 'c': w3c}, 'w4': {'a': w4a, 'b': w4b, 'c': w4c},
        'w5': {'a': w5}, 'w6': {'a': w6}, 'w7': {'a': w7}, 'w8': {'a': w8}, 'w9': {'a': w9}, 'w10': {'a': w10}, 'w11': {'a': w11}, 'w12': {'a': w12}}


def build_sheet():
    parts = [f'<figure id="r8-{sid}-{e}" style="margin: 0; display: inline-block">{fn()}</figure>' for sid, vs in SITS.items() for e, fn in vs.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest r8</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-wrap: wrap; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'r8-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/r8-sheet.html')
