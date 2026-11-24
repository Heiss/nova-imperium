"""Playtest round 9 – „Soziales“ on the phone (owner, 2026-11-24).

[E] W13: the pages without a design get playtest rounds, first the phone,
then the desktop; the owner chose „Soziales“ next; small pages as one
proposal. Today's contents (#226 private messages, #227 friends, #163
guild ranks, #169 guild chat; src/client/views/Pm*.svelte, Friends.svelte,
Guilds.svelte, GuildMembers.svelte, GuildRanks.svelte): conversations
between two players without a subject, plain text up to 1,000 characters,
„Posteingang“ and „Gesendet“, „Antworten“, „Melden“, „Blockieren“,
„Unterhaltung löschen“, „Nur Freunde dürfen mir schreiben“, „Blockierte
Spieler“; friends see each other online or offline; ranks with the rights
of #163. [E] s12: the guild chat is the tab „Funk“ of the Lage sheet;
W4 (do private messages join it?) is open and tested here. [E] d10: guild
members always in their colour on the map, details in the layer „Gilde“.
The guild „Sternwacht [SW]“ and every number are examples. Proposal only.
"""
import os

from kit import ball, phone
from playtest_final import urgent_line as sheet
from playtest_r1m import header
from playtest_r1x import pulled
from playtest_r7 import page, tabs_on
from playtest_r8 import btn, dim_map, field, group, row, sw
from playtest_r6 import PALETTES, SHAPES, mark

PAL = PALETTES['c']


def at(n):
    """A system on the phone map (galaxy(390, 544) below the header at 96 px)."""
    from playtest_d1 import SYSTEMS
    fx, fy, _ = SYSTEMS[n]
    return fx * 390, fy * 544 + 96


def dot(on):
    return f'<i style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--{"green" if on else "line"}); margin-right: 4px"></i>'


def mk(k, size=12):
    return f'<svg width="{size}" height="{size}" viewBox="-6 -6 12 12" style="vertical-align: -1px">{mark(0, 0, PAL[k], SHAPES[k], 4)}</svg>'


def convo(name, kind, last, when, unread=0, sel=False):
    return (f'<div style="display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; padding: 9px 6px; border-bottom: 1px solid var(--line);{" background: rgb(212 165 55 / 0.1);" if sel else ""}">'
            f'<b style="font-size: 14px">{mk(kind)} {name}</b><span class="m-dim" style="font-size: 11.5px">{when}</span>'
            f'<span class="m-dim" style="font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{last}</span>'
            + (f'<span class="m-tag red">{unread}</span>' if unread else '<span></span>') + '</div>')


CONVOS = [('Gilde Sternwacht', 'g', 'Thalor: Valcor hat 3 Welten in 1:31.', '14:05', 2), ('Mira', 'f', 'Ich halte Nox bis 15:00.', '14:02', 1),
          ('Leander', 'o', 'Tausch gegen Psikristall?', 'gestern', 0), ('Thalor', 'g', 'Bericht kommt gleich.', 'Mo', 0)]


def lage_tabs(on='Funk', tabs=('Zeitleiste', 'Funk', 'Berichte')):
    return ('<div style="display: flex; font-size: 13px; margin-bottom: 6px">'
            + ''.join(f'<span style="flex: 1; text-align: center; padding: 5px 0; border-bottom: 2px solid var(--{"gold" if t == on else "line"}); '
                      f'color: var(--{"gold-hi" if t == on else "dim"})">{t}</span>' for t in tabs) + '</div>')


def seg(items, on):
    return ('<div style="display: flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; margin-bottom: 6px">'
            + ''.join(f'<span style="flex: 1; text-align: center; padding: 6px 0; font-size: 12.5px; {"background: rgb(212 165 55 / 0.18); color: var(--gold-hi);" if t == on else "color: var(--dim);"}">{t}</span>'
                      for t in items) + '</div>')


# ------------------------------------------------------------------ s20 Nachrichten (W4)
def s20a():
    body = (lage_tabs() + ''.join(convo(*c) for c in CONVOS)
            + '<div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 13px"><span style="color: var(--gold-hi)">+ Neue Nachricht</span>'
            '<span class="m-dim">Gilde oben, dann deine Gespräche</span></div>')
    return phone(dim_map() + header() + pulled(420, body) + tabs_on(0))


def s20b():
    body = (lage_tabs() + seg(['Gilde', 'Persönlich 1'], 'Persönlich 1') + ''.join(convo(*c) for c in CONVOS[1:])
            + '<div style="margin-top: 8px; font-size: 13px; color: var(--gold-hi)">+ Neue Nachricht</div>')
    return phone(dim_map() + header() + pulled(420, body) + tabs_on(0))


def s20c():
    chips = ''.join(f'<span class="m-chip{" on" if t.startswith("Posteingang") else ""}">{t}</span>' for t in ['Posteingang (1)', 'Gesendet', 'Einstellungen'])
    body = (f'<div class="m-chips" style="margin-bottom: 6px">{chips}</div>' + ''.join(convo(*c) for c in CONVOS[1:])
            + btn('Neue Nachricht', 'ghost') + '<div class="m-dim" style="font-size: 12px; margin-top: 6px">Der Gilden-Chat bleibt der Reiter „Funk“ im Lage-Blatt.</div>')
    return phone(page('Nachrichten', 'Menü › Nachrichten', body) + header() + sheet() + tabs_on(4))


# ------------------------------------------------------------------ s22 Freunde
FRIENDS = [('Mira', True, 'SW', '1:26'), ('Leander', False, '', '1:44'), ('Orin', True, 'VAL', '1:12')]


def friend_rows():
    return ''.join(f'<div style="display: grid; grid-template-columns: 1fr auto; padding: 9px 6px; border-bottom: 1px solid var(--line); font-size: 13.5px">'
                   f'<span>{dot(on)}<b>{n}</b> <span class="m-dim" style="font-size: 12px">{f"[{t}] · " if t else ""}{p}</span></span>'
                   f'<span style="color: var(--gold-hi); font-size: 12.5px">Nachricht · Karte ›</span></div>' for n, on, t, p in FRIENDS)


def requests():
    return ('<div style="border: 1px solid var(--gold); border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; background: #140f0b; font-size: 13px">'
            '<b style="color: var(--gold-hi)">Anfrage von Kael</b> <span class="m-dim">[VAL] · 1:31</span>'
            '<div style="display: flex; gap: 8px; margin-top: 6px"><span class="m-btn">Annehmen</span><span class="m-btn" style="background: none; color: var(--gold-hi)">Ablehnen</span></div></div>')


def s22a():
    body = (requests() + friend_rows() + field('Freundschaft anfragen', '<span class="m-dim">Name des Spielers</span>') + btn('Anfragen', 'ghost'))
    return phone(page('Freunde', '3 · 2 online', body) + header() + sheet() + tabs_on(4))


def s22b():
    from playtest_d1 import galaxy
    m = '<div class="k-stars" style="position: absolute; inset: 0"></div>' + f'<div class="k-abs" style="left: 0; top: 96px">{galaxy(390, 544, tip=False, routes=False)}</div>'
    chips = ('<div class="k-abs" style="left: 10px; top: 104px; z-index: 2; display: flex; gap: 6px"><span class="m-chip">Gilde</span><span class="m-chip on">Freunde</span>'
             '<span class="m-chip">⚖ Börse</span></div>')
    rings = ''.join(f'<div class="k-abs" style="left: {x}px; top: {y}px; width: 34px; height: 34px; border-radius: 50%; border: 2px solid {PAL["f"]}; z-index: 2"></div>'
                    f'<div class="k-abs" style="left: {x + 38}px; top: {y + 8}px; z-index: 2; font-size: 12px; background: rgb(15 11 8 / 0.85); padding: 1px 6px; border-radius: 8px">'
                    f'{dot(on)}{n}</div>' for x, y, n, on in [(at('1:26')[0] - 17, at('1:26')[1] - 17, 'Mira', True), (at('1:44')[0] - 17, at('1:44')[1] - 17, 'Leander', False), (at('1:12')[0] - 17, at('1:12')[1] - 17, 'Orin', True)])
    body = '<b style="font: 700 15px var(--head); color: var(--gold-hi)">Freunde</b> <span class="m-dim" style="font-size: 12px">· Ebene auf der Karte</span>' + friend_rows()
    return phone(m + chips + rings + header() + pulled(230, body) + tabs_on(0))


def s22c():
    body = (seg(['Freunde', 'Gilde', 'Blockiert'], 'Freunde') + requests() + friend_rows() + btn('+ Freundschaft anfragen', 'ghost'))
    return phone(page('Soziales', '', body) + header() + sheet() + tabs_on(4))


# ------------------------------------------------------------------ s23 Gilde
MEMBERS = [('Mira', 'Leitung', True), ('Thalor', 'Offizier', False), ('du', 'Mitglied', True), ('Kessra', 'Mitglied', False)]


def guild_head():
    return ('<div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px"><div style="width: 46px; height: 46px; border-radius: 10px; border: 1px solid var(--gold); '
            'display: grid; place-items: center; font: 800 15px var(--head); color: var(--gold-hi)">SW</div><div><b style="font: 700 16px var(--head); color: var(--gold-hi)">Sternwacht</b>'
            '<br /><span class="m-dim" style="font-size: 12px">4 Mitglieder · Platz 2 · 61.200 Punkte</span></div></div>')


def member_rows(menu=False):
    return ''.join(f'<div style="display: grid; grid-template-columns: 1fr auto; padding: 8px 6px; border-bottom: 1px solid var(--line); font-size: 13.5px">'
                   f'<span>{dot(on)}<b>{n}</b></span><span style="display: flex; gap: 8px; align-items: center"><span class="m-chip" style="padding: 1px 8px">{r}</span>'
                   + ('<span style="color: var(--gold-hi)">⋯</span>' if menu and n != 'du' else '') + '</span></div>' for n, r, on in MEMBERS)


def s23a():
    chips = ''.join(f'<span class="m-chip{" on" if t == "Mitglieder" else ""}">{t}</span>' for t in ['Übersicht', 'Mitglieder', 'Ränge', 'Bewerbungen 1'])
    body = guild_head() + f'<div class="m-chips" style="margin-bottom: 6px">{chips}</div>' + member_rows() + btn('Gilde verlassen', 'ghost')
    return phone(page('', '', body) + header() + sheet() + tabs_on(4))


def s23b():
    apply = ('<div style="border: 1px solid var(--gold); border-radius: 10px; padding: 8px 10px; margin: 8px 0; background: #140f0b; font-size: 13px">'
             '<b style="color: var(--gold-hi)">Bewerbung von Orin</b><div style="display: flex; gap: 8px; margin-top: 6px"><span class="m-btn">Annehmen</span>'
             '<span class="m-btn" style="background: none; color: var(--gold-hi)">Ablehnen</span></div></div>')
    menu = ('<div class="k-abs" style="left: 160px; top: 380px; width: 210px; z-index: 5; background: #1c1510; border: 1px solid var(--gold); border-radius: 10px; padding: 4px 10px; '
            'box-shadow: 0 12px 30px rgb(0 0 0 / 0.8); font-size: 13.5px">' + ''.join(f'<div style="padding: 8px 2px; border-bottom: 1px solid var(--line); color: var(--{c})">{t}</div>'
                                                                                    for t, c in [('Rang ändern', 'txt'), ('Nachricht', 'txt'), ('Leitung übergeben', 'txt'), ('Entfernen', 'red')]) + '</div>')
    body = guild_head() + apply + group('MITGLIEDER', member_rows(True)) + '<div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 8px; color: var(--gold-hi)"><span>Ränge ›</span><span>Profil ›</span><span>Verlassen</span></div>'
    return phone(page('', '', body) + menu + header() + sheet() + tabs_on(4))


def s23c():
    from playtest_d1 import galaxy
    m = '<div class="k-stars" style="position: absolute; inset: 0"></div>' + f'<div class="k-abs" style="left: 0; top: 96px">{galaxy(390, 544, tip=False, routes=False)}</div>'
    chips = '<div class="k-abs" style="left: 10px; top: 104px; z-index: 2; display: flex; gap: 6px"><span class="m-chip on">Gilde</span><span class="m-chip">Freunde</span></div>'
    tags = ''.join(f'<div class="k-abs" style="left: {x}px; top: {y}px; z-index: 2; font-size: 12px; background: rgb(15 11 8 / 0.85); border: 1px solid {PAL["g"]}; padding: 2px 7px; border-radius: 8px">'
                   f'{dot(on)}{n} <span class="m-dim">· {r}</span></div>' for x, y, n, on, r in [(at('1:26')[0] + 20, at('1:26')[1] - 10, 'Mira', True, 'Leitung'), (at('1:44')[0] - 170, at('1:44')[1] - 84, 'Thalor ↘ 1:44', False, 'Offizier'), (at('1:27')[0] + 26, at('1:27')[1] + 14, 'du', True, '')])
    body = guild_head() + member_rows(True)
    return phone(m + chips + tags + header() + pulled(236, body) + tabs_on(0))


# ------------------------------------------------------------------ small pages: one proposal each
def s24_body():
    def bub(me, t, when, report=False):
        return (f'<div style="display: flex; justify-content: {"flex-end" if me else "flex-start"}; margin: 6px 0"><div style="max-width: 78%; padding: 7px 10px; border-radius: 12px; '
                f'font-size: 13.5px; background: {"rgb(212 165 55 / 0.18)" if me else "#211812"}; border: 1px solid var(--{"gold" if me else "line"})">{t}'
                f'<div class="m-dim" style="font-size: 11px; margin-top: 2px">{when}{" · Melden" if report else ""}</div></div></div>')
    return ('<div style="display: flex; justify-content: space-between; align-items: center"><b style="font-size: 15px">‹ ' + mk('f') + ' Mira</b><span style="color: var(--gold-hi)">⋯</span></div>'
            + bub(False, 'Ich halte Nox bis 15:00.', '14:02', True) + bub(True, 'Danke! Abwehr läuft.', '14:04') + bub(False, 'Brauchst du Lastbarken?', '14:06', True)
            + '<div style="display: flex; gap: 6px; margin-top: 10px"><div style="flex: 1; border: 1px solid var(--line); border-radius: 18px; padding: 8px 12px; font-size: 13.5px; color: var(--dim)">Antworten …</div>'
            '<span class="m-btn" style="border-radius: 18px">Senden</span></div><div class="m-dim" style="font-size: 11.5px; margin-top: 6px">⋯ : Unterhaltung löschen · Blockieren</div>')


def s24():
    return phone(dim_map() + header() + pulled(420, s24_body()) + tabs_on(0))


RIGHTS = ['Bewerbungen annehmen und ablehnen', 'Mitglieder entfernen', 'Ränge an Mitglieder vergeben', 'Gildenname, Kürzel und Text ändern', 'Ränge verwalten',
          'Chat lesen', 'Chat schreiben', 'Chatnachrichten löschen']


def s25_body():
    on = {'Chat lesen', 'Chat schreiben', 'Bewerbungen annehmen und ablehnen', 'Ränge an Mitglieder vergeben'}
    ranks = ''.join(f'<div style="display: flex; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid var(--line); font-size: 13.5px;{" background: rgb(212 165 55 / 0.12)" if r == "Offizier" else ""}">'
                    f'<span>{i + 1}. <b>{r}</b>{" <span class=m-dim>· Standardrang</span>" if r == "Mitglied" else ""}</span><span class="m-dim">↑ ↓</span></div>'
                    for i, r in enumerate(['Leitung', 'Offizier', 'Mitglied']))
    rights = ''.join(row(x, right=sw(x in on)) for x in RIGHTS)
    return (group('RÄNGE', ranks + row('Rang anlegen', '', col='gold-hi')) + group('RECHTE VON „OFFIZIER“', rights)
            + '<div class="m-dim" style="font-size: 12px; margin-top: 6px">Die Leitung hat immer alle Rechte; Auflösen und Leitung übergeben bleiben bei ihr.</div>')


def s25():
    return phone(page('Ränge', 'Gilde › Ränge', f'<div style="height: 520px; overflow: hidden">{s25_body()}</div>') + header() + sheet() + tabs_on(4))


def s26_body():
    gl = ''.join(f'<div style="display: grid; grid-template-columns: 1fr auto; align-items: center; padding: 9px 6px; border-bottom: 1px solid var(--line); font-size: 13.5px">'
                 f'<span><b>{n}</b> <span class="m-dim" style="font-size: 12px">[{t}] · {m} Mitglieder · Platz {p}</span></span><span class="m-btn">Bewerben</span></div>'
                 for n, t, m, p in [('Haus Valcor', 'VAL', 5, 1), ('Sternwacht', 'SW', 4, 2), ('Die Treuen', 'TRE', 2, 3)])
    return ('<div class="m-dim" style="font-size: 12.5px; margin-bottom: 6px">Du bist in keiner Gilde. Bewirb dich oder gründe eine.</div>' + gl
            + group('NEUE GILDE', '<div style="padding: 4px 12px 10px">' + field('Name') + field('Kürzel') + btn('Gilde gründen', 'ghost') + '</div>'))


def s26():
    return phone(page('Gilden', 'ohne Gilde', s26_body()) + header() + sheet() + tabs_on(4))


def s27_body():
    blocked = ''.join(row(n, right='<span style="color: var(--gold-hi); font-size: 12.5px">freigeben</span>') for n in ['Kael'])
    return (group('WER DIR SCHREIBEN DARF', row('Nur Freunde dürfen mir schreiben', right=sw(False)))
            + group('BLOCKIERTE SPIELER', blocked) + '<div class="m-dim" style="font-size: 12px; margin-top: 6px">Wer blockiert ist, kann dir nicht schreiben; die Ablehnung verrät nicht, warum.</div>')


def s27():
    return phone(page('Nachrichten', 'Einstellungen', s27_body()) + header() + sheet() + tabs_on(4))


SITS = {'s20': {'a': s20a, 'b': s20b, 'c': s20c}, 's22': {'a': s22a, 'b': s22b, 'c': s22c}, 's23': {'a': s23a, 'b': s23b, 'c': s23c},
        's24': {'a': s24}, 's25': {'a': s25}, 's26': {'a': s26}, 's27': {'a': s27}}


def build_sheet():
    parts = [f'<figure id="r9-{sid}-{e}" style="margin: 0; display: inline-block">{fn()}</figure>' for sid, vs in SITS.items() for e, fn in vs.items()]
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest r9</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-wrap: wrap; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'r9-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/r9-sheet.html')
