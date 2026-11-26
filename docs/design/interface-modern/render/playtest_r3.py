"""Playtest round 3 – espionage and its report designed together.

[E] 2026-11-23 (s7 and the questions of round 2): espionage starts from
the system view in the sheet, the attack button sits right under the spy
button, and reports must be quick to reach; espionage and report belong
together. The three variants show where the report of the spy flight on
Varn appears. Names from the catalog (texts.de.ts); the loot is half the
resources (LOOT_SHARE 0.5). Proposal only.
"""
import os

from kit import ball, phone, tag
from playtest_r1m import GUILD, OTHER, WAR, header, sheet, tabs
from playtest_r1x import pulled

RES = [('Adamant', '640 k'), ('Psikristall', '380 k'), ('Promethium', '180 k')]
LOOT = '≈ 600 k (320 k / 190 k / 90 k)'
FLEET = '24 Abfangjäger · 6 Fregatten'
DEF = '40 Raketenbatterien · 12 Lichtlanzen'


def system(badge=False):
    s = ('<div class="k-stars" style="position: absolute; inset: 0"></div>'
         '<div class="k-abs" style="left: 10px; top: 104px"><span class="k-pill">Galaxie 1 › System 1:44</span></div>'
         + ''.join(f'<div class="k-abs" style="left: {x}px; top: {y}px; text-align: center; font-size: 11.5px">{ball(k, 1, sz)}<br /><b style="color: {c}">{n}</b></div>'
                   for k, x, y, sz, n, c in [('trocken', 90, 220, 46, '4 · Varn', WAR), ('wueste', 200, 290, 36, '6 · Kessra Prime', GUILD), ('gas', 120, 390, 34, '8 · Tarsis', OTHER)])
         + '<div class="k-abs" style="left: 78px; top: 208px; width: 70px; height: 70px; border-radius: 50%; border: 2px solid #f1d27a"></div>')
    if badge:
        s += ('<div class="k-abs" style="left: 150px; top: 190px; z-index: 2; background: #17110d; border: 1px solid var(--green); border-radius: 8px; padding: 5px 8px; font-size: 11.5px; line-height: 1.45">'
              '<b style="color: var(--green)">Bericht · gerade eben</b><br />640 k · 380 k · 180 k<br /><span class="m-dim">30 Schiffe · 52 Anlagen</span></div>')
    return s


def kv(rows):
    return '<div class="m-kv">' + ''.join(f'<span>{a}</span><b>{b}</b>' for a, b in rows) + '</div>'


def buttons():
    return ('<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; margin-top: 8px; font-size: 13px">'
            '<span class="m-btn" style="text-align: center; padding: 10px 4px; background: var(--red); color: #120d0a">Angreifen</span>'
            '<span class="m-btn" style="text-align: center; padding: 10px 4px; background: none; color: var(--gold-hi); border: 1px solid var(--gold)">Nochmal spionieren</span></div>')


def report_body(full=True):
    out = ('<b style="color: var(--gold-hi)">Varn [1:44:4]</b> ' + tag('red', 'KRIEG') + ' <span class="m-dim" style="font-size: 12px">· Bericht 13:24 · gerade eben</span>'
           + kv([(n, v) for n, v in RES] + [('Beute (die Hälfte)', f'<span style="color: var(--green)">{LOOT}</span>')]))
    if full:
        out += kv([('Flotte', FLEET), ('Abwehr', DEF), ('Aktivität', 'vor 2 h')])
    return out + buttons()


# ------------------------------------------------------------------ a: the report opens in the sheet of the world
def va():
    body = report_body() + '<div class="m-dim" style="font-size: 12px; margin-top: 8px">Der Bericht bleibt an Varn hängen: Varn antippen zeigt ihn wieder, mit Alter.</div>'
    return phone(system() + header() + pulled(400, body) + tabs())


# ------------------------------------------------------------------ b: the report sits on the world in the map
def vb():
    return phone(system(badge=True)
                 + '<div class="k-abs" style="left: 10px; right: 10px; top: 470px; font-size: 12px" class="m-dim">'
                 'Jede Welt mit Bericht zeigt ihn als Schild; antippen öffnet den ganzen Bericht mit „Angreifen“.</div>'
                 + header() + sheet() + tabs())


# ------------------------------------------------------------------ c: the report arrives in the Lage timeline
def vc():
    def row(t, txt, c='dim', past=True):
        return (f'<div style="position: relative; display: grid; grid-template-columns: 44px 1fr; gap: 6px; font-size: 13px; margin: 5px 0;{" opacity: 0.8" if past else ""}">'
                f'<span style="position: absolute; left: -17px; top: 5px; width: 9px; height: 9px; border-radius: 50%; background: var(--{c})"></span>'
                f'<b class="m-num" style="color: var(--{"dim" if past else "txt"})">{t}</b><span>{txt}</span></div>')
    card = ('<div style="border: 1px solid var(--green); border-radius: 8px; padding: 8px; margin: 4px 0 8px">' + report_body(full=False)
            + '<div class="m-dim" style="font-size: 12px; margin-top: 6px">' + FLEET + ' · ' + DEF + '</div></div>')
    body = ('<b style="color: var(--gold-hi)">Lage · Zeitleiste</b>'
            '<div style="margin: 6px 0 0 20px; border-left: 2px solid var(--line); padding-left: 10px">'
            + row('12:58', '<span class="m-dim">Leander</span> gründet Kolonie in 1:44') + row('13:20', 'Spähschädel nach Varn gestartet')
            + row('13:24', '<b style="color: var(--green)">Bericht Varn</b> · aufgeklappt', 'green') + card
            + row('13:42', 'Psikristall-Steinbruch 16 fertig', 'gold', False) + '</div>')
    return phone(system() + header() + pulled(520, body) + tabs())


SITS = {'s8': {'a': va, 'b': vb, 'c': vc}}


# ------------------------------------------------------------------ s9 send the fleet (from „Angreifen“ on Varn)
# Own fleet on Aurelia [1:27:8]: 60 Abfangjäger, 20 Fregatten, 30 Lastbarken.
# Cargo from the catalog: Abfangjäger 50, Fregatte 800, Lastbarke 25.000;
# 60·50 + 20·800 + 24·25.000 = 619.000 ≥ loot 600.000. Times are examples.
SHIPS = [('Abfangjäger', 60, 60), ('Fregatte', 20, 20), ('Lastbarke', 24, 30)]


def ship_rows(step=True):
    out = ''
    for n, take, have in SHIPS:
        ctl = (f'<span class="m-stepper"><span>−</span><b>{take}</b><span>+</span></span>' if step else f'<b>{take}</b>')
        out += (f'<div style="display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; padding: 4px 0; font-size: 13.5px">'
                f'<span>{n}</span><span class="m-dim" style="font-size: 12px">von {have}</span>{ctl}</div>')
    return out


CARGO = '<div class="m-kv"><span>Laderaum</span><b style="color: var(--green)">619 k ≥ Beute 600 k ✓</b><span>Ankunft</span><b>14:05</b><span>zurück</span><b>14:50</b></div>'


def s9a():
    step = lambda n, t, on: (f'<span style="display: inline-flex; gap: 6px; align-items: center; font-size: 12.5px; color: var(--{"gold-hi" if on else "dim"})">'
                             f'<b style="display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; border: 1px solid currentColor">{n}</b>{t}</span>')
    body = ('<b style="color: var(--gold-hi)">Angriff auf Varn [1:44:4]</b> <span class="m-dim" style="font-size: 12px">von Aurelia [1:27:8]</span>'
            '<div style="display: flex; gap: 14px; margin: 8px 0">' + step(1, 'Ziel ✓', False) + step(2, 'Schiffe', True) + step(3, 'Abflug', False) + '</div>'
            + ship_rows() + '<div class="m-dim" style="font-size: 12px; margin: 4px 0">Lastbarken passend zur Beute vorgeschlagen.</div>' + CARGO
            + '<span class="m-btn big" style="display: block; margin-top: 8px; text-align: center">Weiter zu Abflug</span>')
    return phone(system() + header() + pulled(460, body) + tabs())


def s9b():
    from playtest_d1 import galaxy
    def attack(P):
        (x0, y0), (xs, ys) = P['1:27'], P['1:44']
        return (f'<path d="M {x0 + 10:.0f} {y0 + 10:.0f} Q {(x0 + xs) / 2 + 40:.0f} {(y0 + ys) / 2 - 50:.0f} {xs - 6:.0f} {ys - 6:.0f}" stroke="{WAR}" stroke-width="4" fill="none" />'
                f'<circle cx="{xs:.0f}" cy="{ys:.0f}" r="16" fill="none" stroke="{WAR}" stroke-width="2.5" />'
                f'<circle cx="{xs - 6:.0f}" cy="{ys - 6:.0f}" r="9" fill="#f1d27a" opacity="0.85" />')
    m = (f'<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="left: 0; top: 96px">{galaxy(390, 420, tip=False, routes=attack)}</div>'
         '<div class="k-abs" style="left: 10px; top: 104px; z-index: 2"><span class="k-pill">Ziehe von deiner Welt zum Ziel</span></div>'
         '<div class="k-abs" style="left: 196px; top: 466px; z-index: 2; background: #17110d; border: 1px solid var(--red); border-radius: 8px; padding: 4px 8px; font-size: 12px">'
         '<b style="color: var(--red)">Angriff Varn [1:44:4]</b><br />an 14:05 · zurück 14:50</div>')
    body = ('<b style="color: var(--gold-hi)">Aurelia → Varn</b> <span class="m-dim" style="font-size: 12px">Angriff</span>'
            '<div class="m-chips" style="margin: 6px 0"><span class="m-chip on">60 Abfangjäger</span><span class="m-chip on">20 Fregatten</span><span class="m-chip on">24 Lastbarken</span><span class="m-chip">+ Schiffe</span></div>'
            '<div style="font-size: 12.5px; color: var(--green)">Laderaum 619 k ≥ Beute 600 k ✓</div>'
            '<span class="m-btn big" style="display: block; margin-top: 8px; text-align: center">Losschicken</span>')
    return phone(m + header() + pulled(200, body) + tabs())


def s9c():
    def card(t, d, on=False):
        return (f'<div style="border: 1px solid var(--{"gold" if on else "line"}); border-radius: 8px; padding: 8px; margin: 6px 0;{" background: rgb(212 165 55 / 0.08)" if on else ""}">'
                f'<b style="color: var(--{"gold-hi" if on else "txt"})">{t}</b><div class="m-dim" style="font-size: 12.5px">{d}</div></div>')
    body = ('<b style="color: var(--gold-hi)">Angriff auf Varn</b> <span class="m-dim" style="font-size: 12px">von Aurelia · Vorlage wählen</span>'
            + card('Raubzug', 'alle Kampfschiffe + Lastbarken passend zur Beute (24)', True)
            + card('Alles', 'jedes Schiff auf Aurelia (60 · 20 · 30)')
            + card('Nur Laderaum', '24 Lastbarken, ohne Schutz')
            + card('+ Eigene Vorlage', 'aus der jetzigen Auswahl speichern')
            + CARGO + '<span class="m-btn big" style="display: block; margin-top: 8px; text-align: center">Raubzug losschicken</span>')
    return phone(system() + header() + pulled(520, body) + tabs())


SITS['s9'] = {'a': s9a, 'b': s9b, 'c': s9c}


# ------------------------------------------------------------------ s10 space battle and report
# Attack 60 Abfangjäger, 20 Fregatten, 24 Lastbarken on Varn (24 Abfangjäger,
# 6 Fregatten, 40 Raketenbatterien, 12 Lichtlanzen). Example outcome: victory
# after 4 of at most 6 rounds (MAX_ROUNDS). Own losses 14 Abfangjäger,
# 2 Fregatten. Debris 30 % (DEBRIS_SHARE) of the destroyed ships' Adamant and
# Psikristall, no Promethium: ships lost 274 k / 94 k → ≈ 82 k / 28 k;
# Bergungsbarke 20.000 cargo → 6. Defense: 70 % rebuilt (REBUILD_SHARE) →
# 28 Raketenbatterien, 8 Lichtlanzen.
SIDES = [('Abfangjäger', '60 → 46', '24 → 0'), ('Fregatte', '20 → 18', '6 → 0'), ('Lastbarke', '24 → 24', '–'),
         ('Raketenbatterie', '–', '40 → 0 (28 wieder auf)'), ('Lichtlanze', '–', '12 → 0 (8 wieder auf)')]


def sides_table():
    rows = ''.join(f'<span>{n}</span><b>{a}</b><b style="color: var(--red)">{d}</b>' for n, a, d in SIDES)
    return ('<div style="display: grid; grid-template-columns: 1fr auto auto; gap: 3px 10px; font-size: 12.5px; margin: 6px 0">'
            '<span class="m-dim">Einheit</span><span class="m-dim">du</span><span class="m-dim">Varn</span>' + rows + '</div>')


def result_head():
    return ('<b style="color: var(--green)">Sieg über Varn</b> <span class="m-dim" style="font-size: 12px">· 4 von 6 Runden · 14:05</span>')


def loot_debris(btn=True):
    out = ('<div class="m-kv"><span>Beute</span><b style="color: var(--green)">600 k (320 k / 190 k / 90 k)</b>'
           '<span>Trümmerfeld 1:44:4</span><b>≈ 82 k / 28 k</b><span>zum Bergen</span><b>6 Bergungsbarken</b></div>')
    if btn:
        out += ('<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; margin-top: 8px; font-size: 13px">'
                '<span class="m-btn" style="text-align: center; padding: 10px 4px">Trümmer bergen</span>'
                '<span class="m-btn" style="text-align: center; padding: 10px 4px; background: none; color: var(--gold-hi); border: 1px solid var(--gold)">▶ Wiederholung</span></div>')
    return out


def s10a():
    body = result_head() + sides_table() + loot_debris()
    return phone(system() + header() + pulled(470, body) + tabs())


def s10b():
    import random
    rnd = random.Random(3)
    w, h = 370, 250
    svg = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="background: #0b0806; border: 1px solid var(--line); border-radius: 8px">']
    own = [(rnd.uniform(20, 120), rnd.uniform(20, 230)) for _ in range(26)]
    foe = [(rnd.uniform(240, 350), rnd.uniform(20, 230)) for _ in range(14)]
    for i in range(10):
        (x1, y1), (x2, y2) = own[i], foe[i]
        svg.append(f'<line x1="{x1:.0f}" y1="{y1:.0f}" x2="{x2:.0f}" y2="{y2:.0f}" stroke="#f1d27a" stroke-width="1" opacity="0.5" />')
    svg += [f'<path d="M {x:.0f} {y - 4:.0f} L {x + 7:.0f} {y:.0f} L {x:.0f} {y + 4:.0f} Z" fill="#6fb8ff" />' for x, y in own]
    svg += [f'<path d="M {x:.0f} {y - 4:.0f} L {x - 7:.0f} {y:.0f} L {x:.0f} {y + 4:.0f} Z" fill="{WAR}" />' for x, y in foe]
    svg += [f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" fill="#f0a050" opacity="0.6" />' for x, y, r in [(300, 80, 9), (270, 170, 7), (320, 200, 6)]]
    svg.append('</svg>')
    scrub = ('<div style="display: flex; gap: 6px; align-items: center; margin: 8px 0; font-size: 12.5px">▶ '
             + ''.join(f'<span style="flex: 1; height: 6px; border-radius: 3px; background: var(--{"gold" if i <= 2 else "line"})"></span>' for i in range(1, 5))
             + '<span class="m-dim">Runde 2 von 4</span></div>')
    inner = ('<div style="position: relative; padding: 100px 10px 0"><div style="margin-bottom: 6px">' + result_head() + '</div>' + ''.join(svg) + scrub
             + '<div style="font-size: 12.5px">Runde 2: 9 Abfangjäger und 4 Raketenbatterien von Varn zerstört.</div>' + loot_debris() + '</div>')
    return phone('<div class="k-stars" style="position: absolute; inset: 0"></div>' + inner + header() + sheet() + tabs())


def s10c():
    def row(t, txt, c='dim', past=True):
        return (f'<div style="position: relative; display: grid; grid-template-columns: 44px 1fr; gap: 6px; font-size: 13px; margin: 5px 0;{" opacity: 0.8" if past else ""}">'
                f'<span style="position: absolute; left: -17px; top: 5px; width: 9px; height: 9px; border-radius: 50%; background: var(--{c})"></span>'
                f'<b class="m-num" style="color: var(--{"dim" if past else "txt"})">{t}</b><span>{txt}</span></div>')
    card = ('<div style="border: 1px solid var(--green); border-radius: 8px; padding: 8px; margin: 4px 0 8px">' + result_head()
            + '<div style="font-size: 12.5px; margin: 4px 0">Verluste: du 14 Abfangjäger, 2 Fregatten · Varn alles</div>' + loot_debris()
            + '<div class="m-dim" style="font-size: 12px; margin-top: 6px">Wischen: Runde 1 · 2 · 3 · 4</div></div>')
    body = ('<b style="color: var(--gold-hi)">Lage · Zeitleiste</b>'
            '<div style="margin: 6px 0 0 20px; border-left: 2px solid var(--line); padding-left: 10px">'
            + row('13:24', 'Bericht Varn') + row('13:26', 'Flotte nach Varn gestartet')
            + row('14:05', '<b style="color: var(--green)">Schlacht um Varn</b> · aufgeklappt', 'green') + card
            + row('14:32', '<b style="color: var(--red)">Angriff Haus Valcor auf Nox</b>', 'red', False) + row('14:50', 'Flotte zurück mit Beute', 'gold', False) + '</div>')
    return phone(system() + header() + pulled(560, body) + tabs())


SITS['s10'] = {'a': s10a, 'b': s10b, 'c': s10c}


def build_sheet():
    parts = [f'<figure id="r3-{sid}-{e}" style="margin: 0; display: inline-block">{fn()}</figure>' for sid, vs in SITS.items() for e, fn in vs.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest r3</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-wrap: wrap; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'r3-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/r3-sheet.html')
