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
