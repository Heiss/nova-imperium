"""Playtest round 2 – research, defense before the attack, espionage.

Same frame as round 1 (header, Lage sheet [E], tab bar), so only the view
differs. Requirements and costs from the catalog (src/features/*/entry.ts);
times are examples for a speed-5 universe. Proposal only.
"""
import os

from kit import I, RES, ball, g, need, phone, pill, tag
from playtest_r1m import GUILD, OTHER, OWN, WAR, sheet, tabs
from playtest_r1x import pulled

R = I + 'research/'


def header(res=('184 k', '92 k', '41 k'), where='Aurelia'):
    return ('<div class="k-abs" style="left: 0; right: 0; top: 0; padding: 30px 10px 6px; display: flex; gap: 6px; align-items: center; '
            'background: rgb(18 13 10 / 0.92); border-bottom: 1px solid var(--line); z-index: 3">'
            + pill('metal', res[0]) + pill('crystal', res[1]) + pill('deuterium', res[2])
            + f'<span class="k-pill" style="margin-left: auto">{where} ▾</span></div>')


def body(inner, top=100):
    return f'<div class="k-stars" style="position: absolute; inset: 0"></div><div style="position: relative; padding: {top}px 10px 0">{inner}</div>'


def title(t, sub=''):
    return f'<div style="display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px"><b style="font: 800 17px var(--head); color: var(--gold)">{t}</b><span class="m-dim" style="font-size: 12.5px">{sub}</span></div>'


def tile(icon, lvl, state, st, sel=False, size=62):
    lv = f'<span class="k-lv">{lvl}</span>' if lvl != '' else ''
    return (f'<div class="k-tile {state}{" sel" if sel else ""}" style="width: {size}px; height: {size}px"><img src="{icon}" alt="" />{lv}'
            f'<span class="k-st">{st}</span></div>')


RESEARCH = [  # icon, level, state, status
    ('hyperspace_drive', 4, 'run', '3 h 12'), ('energy_technology', 8, 'ok', 'baubar'), ('laser_technology', 10, 'ok', 'baubar'),
    ('ion_technology', 0, 'ok', 'baubar'), ('plasma_technology', 0, 'lock', 'Ionen 5'), ('hyperspace_technology', 6, 'ok', 'baubar'),
    ('combustion_drive', 8, 'ok', 'baubar'), ('impulse_drive', 6, 'ok', 'baubar'), ('espionage_technology', 8, 'ok', 'baubar'),
    ('computer_technology', 9, 'ok', 'baubar'), ('weapons_technology', 10, 'soon', '14:50'), ('shielding_technology', 8, 'ok', 'baubar'),
    ('armour_technology', 9, 'ok', 'baubar'), ('graviton_technology', 0, 'lock', 'Energie 12'), ('intergalactic_research_network', 0, 'lock', 'Scholarium 10')]


# ------------------------------------------------------------------ s5 research
def s5(e):
    if e == 'a':
        grid = ''.join(tile(R + i + '.svg', lv, s, st, i == 'ion_technology') for i, lv, s, st in RESEARCH)
        info = ('<div class="k-info" style="margin-top: 10px; padding: 10px"><div class="k-ih"><img src="' + R + 'ion_technology.svg" alt="" style="width: 56px; height: 56px" />'
                '<div><h2 style="font-size: 16px">Ionen-Lehre 1</h2><span class="m-dim">nötig für Plasma-Lehre (Stufe 5)</span></div></div>'
                + need('metal', '1.000') + need('crystal', '300') + need('deuterium', '100')
                + '<div class="m-kv"><span>Dauer</span><b>≈ 2 min</b><span>startet</span><b>nach Warp-Antrieb 5 · 16:32</b></div>'
                '<span class="m-btn big" style="display: block">In die Forschungsschlange</span></div>')
        inner = title('Forschung', 'Warp-Antrieb 5 läuft · 3 h 12') + f'<div class="k-grid" style="grid-template-columns: repeat(5, 62px); gap: 8px">{grid}</div>' + info
    elif e == 'b':
        # a small tree around the plasma goal: energy, laser → ion → plasma; hyper → hdrive
        nodes = {'energy_technology': (0, 40, 'Machina-Energetik 8', 'ok'), 'laser_technology': (0, 150, 'Lichtlanzen-Lehre 10', 'ok'),
                 'ion_technology': (130, 95, 'Ionen-Lehre 0 → 5', 'soon'), 'plasma_technology': (260, 95, 'Plasma-Lehre', 'lock'),
                 'hyperspace_technology': (0, 270, 'Warp-Theorie 6', 'ok'), 'hyperspace_drive': (130, 270, 'Warp-Antrieb 4 → 5', 'run'),
                 'graviton_technology': (260, 270, 'Gravitonen-Mysterium', 'lock')}
        edges = [('energy_technology', 'ion_technology'), ('laser_technology', 'ion_technology'), ('ion_technology', 'plasma_technology'),
                 ('energy_technology', 'plasma_technology'), ('laser_technology', 'plasma_technology'), ('hyperspace_technology', 'hyperspace_drive')]
        svg = '<svg width="370" height="360" style="position: absolute; left: 0; top: 0">' + ''.join(
            f'<line x1="{nodes[a][0] + 45}" y1="{nodes[a][1] + 26}" x2="{nodes[b][0] + 45}" y2="{nodes[b][1] + 26}" stroke="{"#f1d27a" if "plasma" in b or "ion" in b else "#3b2f22"}" stroke-width="2" />'
            for a, b in edges) + '</svg>'
        col = {'ok': 'green', 'soon': 'orange', 'lock': 'line', 'run': 'gold-hi'}
        nd = ''.join(f'<div class="k-abs" style="left: {x}px; top: {y}px; width: 90px; text-align: center"><img src="{R}{k}.svg" alt="" style="width: 52px; height: 52px; border: 2px solid var(--{col[s]}); border-radius: 8px; background: #120d0a" />'
                     f'<div style="font-size: 10.5px; line-height: 1.15; margin-top: 2px">{t}</div></div>' for k, (x, y, t, s) in nodes.items())
        inner = (title('Forschung · Baum', 'Weg zu Plasma-Lehre hervorgehoben')
                 + f'<div style="position: relative; height: 360px">{svg}{nd}</div>'
                 + '<div class="m-dim" style="font-size: 12.5px">Ziehen zum Verschieben, Antippen öffnet die Infoseite.</div>')
    else:
        steps = ''.join(f'<div style="display: grid; grid-template-columns: 22px 44px 1fr auto; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--line)">'
                        f'<b class="m-dim">{n}</b><img src="{R}{ic}.svg" alt="" style="width: 44px; height: 44px; border-radius: 6px; border: 1px solid var(--line)" />'
                        f'<div><b>{t}</b><br /><span class="m-dim" style="font-size: 12px">{c}</span></div><span class="m-num">{d}</span></div>'
                        for n, ic, t, c, d in [(1, 'ion_technology', 'Ionen-Lehre 1–5', '31.000 / 9.300 / 3.100', '≈ 48 min'),
                                               (2, 'plasma_technology', 'Plasma-Lehre 1', '2.000 / 4.000 / 1.000', '≈ 7 min')])
        inner = (title('Forschungsziel', '')
                 + '<div class="k-panel" style="padding: 8px 10px; margin-bottom: 8px"><span class="m-dim" style="font-size: 12.5px">Ziel</span><br />'
                 '<b style="font: 600 16px var(--head); color: var(--gold-hi)">Plasma-Lehre 1</b> <span class="m-dim">· schaltet Plasmabatterie frei</span></div>'
                 '<div class="m-dim" style="font-size: 12.5px">Machina-Energetik 8 ✓ · Lichtlanzen-Lehre 10 ✓ · Ionen-Lehre 5 fehlt</div>'
                 + steps + '<div class="m-kv"><span>Gesamt</span><b>≈ 55 min</b><span>startet</span><b>nach Warp-Antrieb 5 · 16:32</b><span>fertig</span><b>≈ 17:27</b></div>'
                 '<span class="m-btn big" style="display: block">Ziel in die Schlange (6 Schritte)</span>')
    return phone(body(inner) + header() + sheet() + tabs())


# ------------------------------------------------------------------ s6 defense on Nox before the attack at 14:32
NOX = ('61 k', '33 k', '12 k')


def s6(e):
    if e == 'a':
        defs = [('rocket_launcher', 120, 'ok'), ('light_laser', 80, 'ok'), ('heavy_laser', 20, 'ok'), ('gauss_cannon', 6, 'ok'),
                ('ion_cannon', 0, 'lock'), ('plasma_turret', 0, 'lock'), ('small_shield_dome', 1, 'have'), ('large_shield_dome', 0, 'no')]
        grid = ''.join(f'<div class="k-tile {s}{" sel" if i == 0 else ""}" style="width: 62px; height: 62px"><img src="{I}defense/{d}.svg" alt="" />'
                       f'<span class="k-lv">{n}</span><span class="k-st">{"" if s == "ok" else "gesperrt" if s == "lock" else "vorhanden" if s == "have" else "fehlt"}</span></div>'
                       for i, (d, n, s) in enumerate(defs))
        sh = ('<b style="color: var(--gold-hi)">Raketenbatterie</b> <span class="m-dim">· 120 auf Nox</span>'
              '<div style="display: flex; gap: 8px; align-items: center; margin: 8px 0"><span class="m-stepper"><span>−</span><b>30</b><span>+</span></span><span class="m-chip">max 30</span></div>'
              + need('metal', '60.000 (von 61.000)')
              + '<div class="m-kv"><span>fertig</span><b class="up">14:18 · vor dem Angriff</b></div><span class="m-btn big" style="display: block">30 bauen</span>')
        inner = title('Abwehr · Nox', 'Angriff 14:32') + f'<div class="k-grid" style="grid-template-columns: repeat(5, 62px); gap: 8px">{grid}</div>'
        return phone(body(inner) + header(NOX, 'Nox') + pulled(300, sh) + tabs())
    if e == 'b':
        bars = ''.join(f'<div style="display: grid; grid-template-columns: 16px 1fr 90px; gap: 6px; align-items: center; font-size: 13px; margin: 4px 0"><img src="{RES}{i}.svg" alt="" style="width: 16px" />'
                       f'<div class="m-prog" style="height: 8px"><i style="width: {p}%; background: var(--{c})"></i></div><span class="m-num">{t}</span></div>'
                       for i, p, c, t in [('metal', 98, 'gold', '60 k / 61 k'), ('crystal', 0, 'gold', '0 / 33 k'), ('deuterium', 0, 'gold', '0 / 12 k')])
        tl = ('<div style="position: relative; height: 46px; margin: 10px 0 4px; border-bottom: 1px solid var(--line)">'
              '<div class="k-abs" style="left: 0; top: 18px; width: 82%; height: 12px; border-radius: 3px; background: var(--gold)"></div>'
              '<div class="k-abs" style="left: 88%; top: 4px; bottom: 0; border-left: 2px dashed var(--red)"></div>'
              '<span class="k-abs" style="left: 0; top: 32px; font-size: 11px" class="m-dim">13:20</span>'
              '<span class="k-abs" style="left: 70%; top: 32px; font-size: 11px">14:18</span>'
              '<span class="k-abs" style="right: 0; top: -14px; font-size: 11px; color: var(--red)">Angriff 14:32</span></div>')
        inner = (title('Abwehr · Nox', 'Raketenbatterie')
                 + '<div style="display: flex; gap: 10px; align-items: center"><img src="' + I + 'defense/rocket_launcher.svg" alt="" style="width: 70px; height: 70px; border: 1px solid var(--gold); border-radius: 8px" />'
                 '<div style="flex: 1"><div style="font: 800 28px var(--head); color: var(--gold-hi)">30</div><div class="m-prog" style="height: 10px"><i style="width: 100%"></i></div>'
                 '<div class="m-dim" style="font-size: 12px">Menge ziehen · max 30</div></div></div>'
                 + bars + tl + '<div style="font-size: 13px">Die letzte Batterie ist <b class="up">14 min vor dem Angriff</b> fertig.</div>'
                 '<span class="m-btn big" style="display: block; margin-top: 8px">30 bauen</span>')
        return phone(body(inner) + header(NOX, 'Nox') + sheet() + tabs())
    opts = ''.join(f'<div class="k-panel" style="padding: 8px 10px; margin-bottom: 8px{"; outline: 2px solid var(--gold-hi)" if s else ""}">'
                   f'<div style="display: flex; gap: 8px; align-items: center"><img src="{I}defense/{d}.svg" alt="" style="width: 44px; height: 44px; border-radius: 6px" />'
                   f'<div style="flex: 1"><b>{t}</b><br /><span class="m-dim" style="font-size: 12px">{c}</span></div><b class="up">{f}</b></div></div>'
                   for d, t, c, f, s in [('rocket_launcher', '30 Raketenbatterien', '60.000 Adamant', '14:18', True),
                                         ('light_laser', '20 Lichtlanzen', '30.000 / 10.000', '13:58', False),
                                         ('gauss_cannon', '1 Massebeschleuniger', '20.000 / 15.000 / 2.000', '13:54', False)])
    inner = (title('Was schaffst du bis 14:32?', 'Nox')
             + '<div class="m-dim" style="font-size: 12.5px; margin-bottom: 8px">Vorschläge mit den Rohstoffen auf Nox, die vor dem Angriff fertig werden. Mira hält mit 40 Abfangjägern.</div>'
             + opts + '<div class="m-dim" style="font-size: 12.5px">Kombinieren möglich, solange die Rohstoffe reichen.</div>'
             '<span class="m-btn big" style="display: block; margin-top: 8px">30 Raketenbatterien bauen</span>')
    return phone(body(inner) + header(NOX, 'Nox') + sheet() + tabs())


# ------------------------------------------------------------------ s7 espionage
def s7(e):
    if e == 'a':
        sys = ('<div class="k-stars" style="position: absolute; inset: 0"></div>'
               '<div class="k-abs" style="left: 10px; top: 104px"><span class="k-pill">Galaxie 1 › System 1:44</span></div>'
               + ''.join(f'<div class="k-abs" style="left: {x}px; top: {y}px; text-align: center; font-size: 11.5px">{ball(k, 1, sz)}<br /><b style="color: {c}">{n}</b></div>'
                         for k, x, y, sz, n, c in [('trocken', 90, 220, 46, '4 · Varn', WAR), ('wueste', 200, 290, 36, '6 · Kessra Prime', GUILD), ('gas', 120, 390, 34, '8 · Tarsis', OTHER)])
               + '<div class="k-abs" style="left: 78px; top: 208px; width: 70px; height: 70px; border-radius: 50%; border: 2px solid #f1d27a"></div>')
        sh = ('<b style="color: var(--gold-hi)">Varn [1:44:4]</b> ' + tag('red', 'KRIEG') + '<div class="m-kv"><span>dein letzter Bericht</span><b style="color: var(--orange)">vor 26 h · veraltet</b>'
              '<span>Aktivität</span><b>vor 2 h</b></div><div style="display: flex; gap: 8px; align-items: center"><span class="m-stepper"><span>−</span><b>3</b><span>+</span></span><span class="m-dim" style="font-size: 12.5px">Spähschädel · 4 min</span></div>'
              '<span class="m-btn big" style="display: block; margin-top: 8px">Spionieren</span>')
        return phone(sys + header() + pulled(250, sh) + tabs())
    if e == 'b':
        rows = ''.join(f'<div style="display: grid; grid-template-columns: 22px 30px 1fr auto; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--line)">'
                       f'<span>{"☑" if chk else "☐"}</span>{ball(k, 1, 28)}<div><b>{n}</b> <span class="m-dim" style="font-size: 12px">{co}</span><br /><span style="font-size: 12px; color: var(--{c})">{age}</span></div>'
                       f'<span class="m-dim" style="font-size: 12px">{loot}</span></div>'
                       for chk, k, n, co, c, age, loot in [(True, 'trocken', 'Varn', '1:44:4 · Krieg', 'orange', 'Bericht 26 h alt', '≈ 600 k'),
                                                           (True, 'gas', 'Tarsis', '1:44:8', 'green', 'Bericht 4 h alt', '≈ 155 k'),
                                                           (False, 'wueste', 'Ödwacht', '1:31:5 · Krieg', 'red', 'kein Bericht', '?'),
                                                           (False, 'eis', 'Frostgrab', '1:29:3', 'dim', 'Bericht 3 Tage alt', '?')])
        inner = (title('Ziele', 'Spionage') + '<div class="m-chips"><span class="m-chip on">Alle</span><span class="m-chip">Krieg</span><span class="m-chip">veraltet</span></div>'
                 + rows + '<span class="m-btn big" style="display: block; margin-top: 10px">2 ausspionieren · je 3 Spähschädel</span>'
                 '<div class="m-dim" style="font-size: 12px; margin-top: 6px">Beute: geschätzt aus deinem letzten Bericht.</div>')
        return phone(body(inner) + header() + sheet() + tabs())
    lay = ('<div class="k-stars" style="position: absolute; inset: 0"></div>'
           '<div class="k-abs" style="left: 10px; top: 104px; display: flex; gap: 6px"><span class="m-chip">Besitz</span><span class="m-chip on">Alter der Berichte</span><span class="m-chip">Aktivität</span></div>'
           + ''.join(f'<div class="k-abs" style="left: {x}px; top: {y}px; text-align: center; font-size: 11px">'
                     f'<div style="width: 38px; height: 38px; margin: 0 auto; border-radius: 50%; border: 3px solid var(--{c}); display: grid; place-items: center; background: #120d0a; font-weight: 700">{a}</div>{n}</div>'
                     for x, y, c, a, n in [(60, 200, 'orange', '26h', 'Varn'), (170, 260, 'green', '4h', 'Tarsis'), (280, 190, 'red', '–', 'Ödwacht'),
                                           (110, 360, 'dim', '3T', 'Frostgrab'), (250, 400, 'green', '1h', 'Kessra')])
           + '<div class="k-abs" style="left: 10px; top: 470px; right: 10px; font-size: 12px" class="m-dim">'
           '<span style="color: var(--green)">●</span> frisch &lt; 6 h <span style="color: var(--orange)">●</span> veraltet <span style="color: var(--red)">●</span> nie · Antippen = Spähschädel los</div>')
    return phone(lay + header() + sheet() + tabs())


SITS = {'s5': s5, 's6': s6, 's7': s7}


def build_sheet():
    parts = [f'<figure id="r2-{sid}-{e}" style="margin: 0; display: inline-block">{fn(e)}</figure>' for sid, fn in SITS.items() for e in 'abc']
    return ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<title>Playtest r2</title>\n'
            '<link rel="stylesheet" href="/style.css" />\n<link rel="stylesheet" href="../modern.css" />\n<link rel="stylesheet" href="../studies.css" />\n</head>\n'
            '<body style="background: #070504; padding: 10px; display: flex; flex-wrap: wrap; gap: 14px">\n' + '\n'.join(parts) + '\n</body>\n</html>\n')


if __name__ == '__main__':
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'playtest')
    with open(os.path.join(out, 'r2-sheet.html'), 'w', encoding='utf-8') as f:
        f.write(build_sheet())
    print('wrote playtest/r2-sheet.html')
