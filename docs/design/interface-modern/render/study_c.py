"""Study C – mobile strategy (Clash of Clans, Rise of Kingdoms, EVE Echoes).

One base scene, two big corner buttons (Flotte, Bauen), timers on top,
a build menu that opens over the base, recipes for fleets. Designed for
the thumb first, the desktop is the same layout. Proposal only.
"""
from kit import (I, RES, ball, desk, g, galaxy_svg, grid, info, page, phone, report_card, steps, tag)

SKY = [('buildings/metal_mine.svg', 'Tiefbohrung', 14, 'ab 14:30', 'warn'), ('buildings/crystal_mine.svg', 'Steinbruch', 22, '22 min', 'run'),
       ('buildings/solar_plant.svg', 'Kathedrale', 32, '▲', 'ok'), ('buildings/research_lab.svg', 'Scholarium', 44, '3 h', 'run'),
       ('buildings/crystal_storage.svg', 'Reliquiar', 55, 'voll 1 h 40', 'warn'), ('buildings/shipyard.svg', 'Werft', 66, '1 h', 'run'),
       ('buildings/deuterium_synthesizer.svg', 'Raffinerie', 77, '▲', 'ok'), ('buildings/robotics_factory.svg', 'Servitoren', 86, '', '')]


def base(w=1280, h=720, scale=1.0):
    """Planet horizon with the buildings standing on it like a skyline."""
    big = int(w * 1.6)
    s = (f'<div class="k-stars" style="position: absolute; inset: 0"></div>'
         f'<div class="k-bigplanet" style="left: {(w - big) // 2}px; top: {int(h * 0.58)}px; width: {big}px; height: {big}px; background-image: url(/planets/normal-1-surface.svg); background-size: auto 40%"></div>')
    import math
    for icon, lab, pct, b, bc in SKY:
        x = w * pct / 100
        dx = (x - w / 2) / (big / 2)
        y = h * 0.58 + big / 2 - math.sqrt(max(0, 1 - dx * dx)) * big / 2
        sz = int(70 * scale)
        s += (f'<div class="k-abs" style="left: {x - sz / 2:.0f}px; top: {y - sz - 6:.0f}px; width: {sz}px; text-align: center">'
              f'<img src="{I}{icon}" alt="" style="width: {sz}px; height: {sz}px; border-radius: 10px; border: 2px solid var(--{"gold-hi" if bc == "run" else "orange" if bc == "warn" else "green" if bc == "ok" else "line"}); background: #120d0a" />'
              + (f'<span class="k-bubble {bc}" style="position: static; display: inline-block; margin-top: -6px">{b}</span>' if b else '') + '</div>')
    return s


def hud(phone_mode=False):
    if phone_mode:
        timers = ''.join(f'<span class="k-pill" style="font-size: 12px">{g(gl, 14)} {t}</span>' for gl, t in [('build', '22m'), ('research', '3h'), ('fleet', '1h')])
        res = ''.join(f'<div style="display: flex; gap: 4px; align-items: center; font-size: 12.5px"><img src="{RES}{i}.svg" alt="" style="width: 15px" /><b>{v}</b>'
                      f'<div class="m-prog" style="width: 40px; height: 5px"><i style="width: {p}%; background: var(--{"orange" if p > 80 else "gold"})"></i></div></div>'
                      for i, v, p in [('metal', '184k', 71), ('crystal', '92k', 88), ('deuterium', '41k', 34)])
        return (f'<div class="k-abs" style="left: 10px; right: 10px; top: 32px; display: flex; justify-content: space-between">{res}</div>'
                f'<div class="k-abs" style="left: 10px; top: 60px; display: flex; gap: 6px">{timers}</div>')
    player = ('<div class="k-abs" style="left: 12px; top: 12px; display: flex; gap: 8px; align-items: center; background: rgb(15 11 8 / 0.85); border: 1px solid var(--gold); border-radius: 30px; padding: 4px 14px 4px 4px">'
              + ball('normal', 1, 44) + '<div><b style="font: 600 15px var(--head); color: var(--gold-hi)">Aurelia</b><br /><span class="m-dim" style="font-size: 12px">Platz 7 · ▲ 1 · 3 Welten ▾</span></div></div>')
    timers = ''.join(f'<div class="k-pill" style="font-size: 13px">{g(gl, 16)} <b>{n}</b> {t}</div>'
                     for gl, n, t in [('build', 'Bauplatz 1/1', '22 min'), ('research', 'Forschung', '3 h 12'), ('fleet', 'Werft', '1 h 05')])
    res = ''.join(f'<div style="display: grid; grid-template-columns: 18px 70px; gap: 4px; align-items: center; font-size: 13px"><img src="{RES}{i}.svg" alt="" style="width: 18px; grid-row: span 2" />'
                  f'<b class="m-num">{v}</b><div class="m-prog" style="height: 6px"><i style="width: {p}%; background: var(--{"orange" if p > 80 else "gold"})"></i></div></div>'
                  for i, v, p in [('metal', '184.003', 71), ('crystal', '92.001', 88), ('deuterium', '41.000', 34)])
    side = ''.join(f'<div class="k-iconbtn" style="width: 48px; height: 48px; border-radius: 50%">{g(gl, 22)}{f"<i>{c}</i>" if c else ""}</div>'
                   for gl, c in [('reports', '7'), ('people', '3'), ('bell', ''), ('gear', '')])
    return (player + f'<div class="k-abs" style="left: 330px; top: 18px; display: flex; gap: 8px">{timers}</div>'
            f'<div class="k-abs" style="right: 12px; top: 10px; display: flex; gap: 12px; background: rgb(15 11 8 / 0.85); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px">{res}</div>'
            f'<div class="k-abs" style="right: 14px; top: 90px; display: flex; flex-direction: column; gap: 10px">{side}</div>'
            '<div class="k-abs" style="left: 0; top: 220px; writing-mode: vertical-rl; background: rgb(15 11 8 / 0.9); border: 1px solid var(--line); border-left: 0; border-radius: 0 6px 6px 0; padding: 10px 4px; font-size: 12.5px; color: var(--gold-hi)">Gilde-Chat · 3</div>')


def corners(w=1280, h=720, size=92):
    return (f'<div class="k-corner" style="left: 18px; top: {h - size - 18}px; width: {size}px; height: {size}px">{g("fleet")}FLOTTE</div>'
            f'<div class="k-corner" style="left: {w - size - 18}px; top: {h - size - 18}px; width: {size}px; height: {size}px">{g("build")}BAUEN</div>'
            f'<div class="k-corner" style="left: {w // 2 - 32}px; top: {h - 82}px; width: 64px; height: 64px; font-size: 11px">{g("map")}KARTE</div>')


def c1():
    card = ('<div class="k-info k-abs" style="left: 390px; top: 150px; width: 500px; text-align: center">'
            '<div style="font: 800 20px var(--head); color: var(--gold-hi); margin-bottom: 4px">Während du weg warst</div><div class="m-dim" style="margin-bottom: 10px">seit gestern 22:14</div>'
            '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 10px">'
            + ''.join(f'<div style="border: 1px solid var(--{c}); border-radius: 6px; padding: 8px"><div style="font: 800 22px var(--head); color: var(--{c})">{n}</div><div style="font-size: 13px">{t}</div></div>'
                      for n, t, c in [('Sieg', 'Nox verteidigt gegen Haus Valcor', 'green'), ('+11', 'Waffensegnung fertig', 'c'), ('3', 'Spionageberichte', 'gold')])
            + '</div><div style="font-size: 13.5px; margin-bottom: 10px">8 Raketenbatterien verloren · 6 werden wieder aufgebaut · Trümmer 200 k</div>'
            '<div style="display: flex; gap: 8px; justify-content: center"><span class="m-btn ghost big">Bericht ansehen</span><span class="m-btn big">Weiter</span></div></div>')
    return desk(base() + hud() + corners() + '<div class="k-abs" style="inset: 0; background: rgb(0 0 0 / 0.45)"></div>' + card)


def c2():
    menu = ('<div class="k-panel k-abs" style="right: 0; bottom: 0; width: 760px; height: 430px; border-radius: 14px 0 0 0"><div class="k-ph" style="font-size: 15px">BAUEN'
            '<span class="k-x">✕</span></div><div class="k-pb"><div class="m-tabs"><span class="on">Gebäude</span><span>Forschung</span><span>Werft</span><span>Abwehr</span></div>'
            '<div class="m-chips"><span class="m-chip on">Leistbar zuerst</span><span class="m-chip">Produktion</span><span class="m-chip">Lager</span><span class="m-chip">Energie</span></div>'
            '<div style="display: grid; grid-template-columns: 1fr 330px; gap: 12px"><div>' + grid(6, 62) + '</div>' + info(330, True) + '</div></div></div>')
    return desk(base() + hud() + corners() + menu)


def c3():
    recipes = ''.join(
        f'<div class="k-panel" style="padding: 10px{"; outline: 2px solid var(--gold-hi)" if s else ""}"><div style="font: 600 15px var(--head); color: var(--gold-hi)">{n}</div>'
        f'<div style="display: flex; gap: 4px; margin: 6px 0">' + ''.join(f'<img src="{I}ships/{ic}" alt="" style="width: 40px; height: 40px; border-radius: 6px; border: 1px solid var(--line)" />' for ic in ics)
        + f'</div><div class="m-dim" style="font-size: 13px">{d}</div></div>'
        for n, ics, d, s in [('Transport', ['large_cargo.svg'], '8 Lastbarken · alles gleichmäßig', True), ('Expedition', ['cruiser.svg', 'large_cargo.svg'], '12 Fregatten, 4 Lastbarken', False),
                             ('Spionage', ['espionage_probe.svg'], '3 Spähschädel', False), ('Schlag', ['battleship.svg', 'cruiser.svg', 'light_fighter.svg'], '40 Kathedralschiffe, 25 Fregatten, 140 Jäger', False)])
    targets = ''.join(f'<div style="display: grid; grid-template-columns: 40px 1fr auto; gap: 10px; align-items: center; padding: 8px; border: 1px solid var(--{"gold-hi" if s else "line"}); border-radius: 8px; margin-bottom: 8px">'
                      f'{ball(k, 1, 40)}<div><b>{n}</b><br /><span class="m-dim" style="font-size: 12.5px">{d}</span></div><b class="m-num">{t}</b></div>'
                      for k, n, d, t, s in [('dschungel', 'Vesper [1:44:9]', 'deine Kolonie · Lager Psikristall 38 k frei', '1 h 12', True),
                                            ('wasser', 'Nox [1:31:4]', 'deine Kolonie · wird angegriffen', '0 h 40', False), ('wueste', 'Kessra Prime', 'Gilde', '1 h 20', False)])
    body = ('<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="left: 24px; top: 20px; font: 800 24px var(--head); color: var(--gold)">Flotte</div>'
            '<div class="k-abs" style="left: 24px; top: 70px; width: 560px"><div class="m-group">1 · REZEPT WÄHLEN</div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">' + recipes + '</div></div>'
            '<div class="k-abs" style="left: 620px; top: 70px; width: 420px"><div class="m-group">2 · ZIEL WÄHLEN</div>' + targets + '<div class="m-dim" style="font-size: 13px">Andere Ziele: Karte öffnen oder [g:s:p] tippen.</div></div>'
            '<div class="k-abs" style="right: 24px; bottom: 24px; display: flex; gap: 14px; align-items: center"><div style="text-align: right; font-size: 14px">Ankunft <b class="up">14:32</b> · Rückkehr 15:44<br /><span class="m-dim">Treibstoff 1.240 · Fracht 160 k</span></div>'
            '<div class="k-corner" style="position: relative; width: 110px; height: 110px; font-size: 15px">STARTEN</div></div>')
    return desk(body)


def c4():
    radial = ('<div class="k-abs" style="left: 30px; bottom: 30px; width: 170px; height: 170px; border-radius: 50%; border: 1px solid var(--gold); background: rgb(15 11 8 / 0.85)">'
              + ''.join(f'<span class="k-pill" style="position: absolute; left: {x}px; top: {y}px; {"border-color: var(--gold-hi); color: var(--gold-hi)" if o else ""}">{t}</span>'
                        for t, x, y, o in [('Universum', 40, 8, False), ('Galaxie', 98, 60, True), ('System', 60, 118, False), ('Welt', 6, 64, False)])
              + '<div class="k-corner" style="left: 55px; top: 55px; width: 60px; height: 60px; font-size: 10px">HEIM</div></div>')
    return desk('<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="inset: 0">' + galaxy_svg(1280, 720) + '</div>' + hud() + radial
                + '<div class="k-panel k-abs" style="left: 700px; top: 250px; width: 230px"><div class="k-pb"><b>Vesper</b> · deine Kolonie<br /><span class="m-dim">Transport kommt 13:50</span><div style="margin-top: 6px; display: flex; gap: 6px"><span class="m-btn">Öffnen</span><span class="m-btn ghost">Flotte hin</span></div></div></div>')


def c5():
    cards = ''.join(f'<div class="k-panel" style="padding: 10px; margin-bottom: 10px; display: grid; grid-template-columns: 90px 1fr auto; gap: 12px; align-items: center">'
                    f'<div style="font: 800 18px var(--head); color: var(--{c}); text-align: center">{big}</div><div><b>{h}</b><br /><span class="m-dim" style="font-size: 13px">{d}</span></div>'
                    f'<div style="display: flex; gap: 6px">{btn}</div></div>'
                    for big, c, h, d, btn in [('SIEG', 'green', 'Haus Valcor griff Nox an · 03:12', '148 Schiffe zerstört · du: 8 Batterien, 6 kommen wieder',
                                               '<span class="m-btn ghost">Replay</span><span class="m-btn">Vergeltung</span>'),
                                              ('SPION', 'gold', 'Tarsis [1:44:8] · 08:30', '310 k Rohstoffe · 42 Schiffe · 180 Anlagen', '<span class="m-btn">Angreifen</span>'),
                                              ('SPION', 'gold', 'Varn [1:44:4] · Mond · 08:12', '1,2 Mio. · 0 Schiffe', '<span class="m-btn">Angreifen</span>')])
    return desk('<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="left: 24px; top: 20px; font: 800 24px var(--head); color: var(--gold)">Kampf-Log</div>'
                '<div class="k-abs" style="left: 24px; top: 64px; width: 640px"><div class="m-tabs"><span class="on">Verteidigung</span><span>Angriff</span><span>Spionage</span><span>Nachrichten</span></div>' + cards + '</div>'
                '<div class="k-abs" style="left: 690px; top: 64px">' + report_card(560) + '</div>')


# ------------------------------------------------------------- phone
def phones():
    def p(inner, buttons=True):
        cb = ''
        if buttons:
            cb = (f'<div class="k-corner" style="left: 14px; top: 680px; width: 78px; height: 78px; font-size: 11px">{g("fleet")}FLOTTE</div>'
                  f'<div class="k-corner" style="left: 298px; top: 680px; width: 78px; height: 78px; font-size: 11px">{g("build")}BAUEN</div>'
                  f'<div class="k-corner" style="left: 166px; top: 700px; width: 58px; height: 58px; font-size: 10px">{g("map")}KARTE</div>')
        return phone(inner + cb)
    p1 = p(base(390, 780, 0.6) + hud(True) + '<div class="k-abs" style="inset: 0; background: rgb(0 0 0 / 0.45)"></div>'
           '<div class="k-info k-abs" style="left: 16px; right: 16px; top: 180px; text-align: center"><b style="font: 800 18px var(--head); color: var(--gold-hi)">Während du weg warst</b>'
           '<div style="font-size: 14px; margin: 8px 0">Sieg auf Nox · Waffensegnung 11 · 3 Spionageberichte</div><span class="m-btn big">Weiter</span></div>')
    p2 = p(base(390, 780, 0.6) + hud(True) + '<div class="m-sheet" style="height: 520px"><b style="color: var(--gold-hi)">BAUEN</b>'
           '<div class="m-chips" style="margin-top: 6px"><span class="m-chip on">Gebäude</span><span class="m-chip">Forschung</span><span class="m-chip">Werft</span></div>' + grid(5, 62) + '</div>', False)
    p3 = p('<div class="k-stars" style="position: absolute; inset: 0"></div><div style="position: relative; padding: 36px 12px"><b style="font: 800 20px var(--head); color: var(--gold)">Flotte</b>'
           + ''.join(f'<div class="k-panel" style="padding: 8px; margin-top: 8px{"; outline: 2px solid var(--gold-hi)" if s else ""}"><b style="color: var(--gold-hi)">{n}</b><div class="m-dim" style="font-size: 12.5px">{d}</div></div>'
                     for n, d, s in [('Transport', '8 Lastbarken → Vesper · 1 h 12', True), ('Expedition', '12 Fregatten, 4 LB', False), ('Spionage', '3 Spähschädel', False)])
           + '</div><div class="k-corner" style="left: 270px; top: 650px; width: 100px; height: 100px">STARTEN</div>', False)
    p4 = p('<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="left: -440px; top: 80px">' + galaxy_svg(1280, 620) + '</div>' + hud(True), True)
    p5 = p('<div class="k-stars" style="position: absolute; inset: 0"></div><div style="position: relative; padding: 36px 10px"><b style="font: 800 20px var(--head); color: var(--gold)">Kampf-Log</b>'
           '<div style="margin-top: 8px">' + report_card(368) + '</div></div>', False)
    return [(p1, 'Einstieg: Basis mit Skyline der Gebäude; „Während du weg warst“ zuerst.'), (p2, 'Bauen: Menü über der Basis, kompakt [E], leistbar zuerst.'),
            (p3, 'Flotte: Rezept wählen, Ziel, „Starten“.'), (p4, 'Karte mit Zoom-Stufen.'), (p5, 'Kampf-Log.')]


def build():
    intro = ('<div class="k-intro"><div><b>Schwerpunkt: Mobile Strategie.</b> Vorbild Clash of Clans (Umbau 2026), Rise of Kingdoms, EVE Echoes. '
             'Eine Basis-Ansicht, zwei große Knöpfe für den Daumen (Flotte links, Bauen rechts), Zeiten der Bauplätze oben, „Während du weg warst“ beim Öffnen. '
             'Der Desktop hat dieselbe Anordnung, nur größer.</div>'
             '<div><ul><li>Bauen: Menü öffnet über der Basis, kompakt [E], leistbar zuerst sortiert.</li><li>Flotte: Rezepte (Clash of Clans „Army Recipes“) + Ziel + Starten.</li>'
             '<li>Karte: Zoom-Stufen über ein Rad (Rise of Kingdoms).</li><li>Berichte: Kampf-Log mit Replay und Vergeltung.</li></ul></div></div>')
    desks = [('c1', '1 · Einstieg – Basis und „Während du weg warst“', c1(), 'Zusammenfassung zuerst (Clash of Clans Verteidigungs-Log), dann die Basis.'),
             ('c2', '2 · Bauen – Menü über der Basis', c2(), 'Bauen rechts unten öffnet das Menü; kompakt [E] mit Infoseite.'),
             ('c3', '3 · Flotte – Rezept, Ziel, Starten', c3(), 'Rezepte statt Schiff-für-Schiff; Ziele vorgeschlagen aus eigenen Welten und letzten Zielen.'),
             ('c4', '4 · Karte – Zoom-Rad', c4(), 'Universum · Galaxie · System · Welt über ein Rad; „Heim“ springt zurück.'),
             ('c5', '5 · Berichte – Kampf-Log', c5(), 'Große Ergebniskarten; „Vergeltung“ füllt die Flotte mit dem Angreifer als Ziel.')]
    return page('Studie C – Mobile Strategie', 'Studie C [V] · Schwerpunkt Mobile Strategie · Styling bleibt [E] · Werte sind Beispiele',
                '<h2 class="m-h">Studie C · Basis und Daumen</h2>' + intro + steps(desks, phones()))
