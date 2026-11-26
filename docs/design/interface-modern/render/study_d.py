"""Study D – dashboard and star map instead of a menu (owner's idea, 2026-11-23).

[E] The dashboard is the entry point and shows what the others do; the star
map replaces the classic menu; only a small menu stays for Lexikon, Soziales
(friends and guild) and Optionen (+ Admin); messages are a chat at the bottom
right; a tracker at the bottom shows the newest events, which the dashboard
shows large. Everything else is a proposal.
"""
from kit import (EVENTS, I, RES, ball, desk, feed, g, galaxy_svg, grid, info, page, phone, pill,
                 report_card, resline, steps, system_svg, tag)

TRACK = [('red', 'FREMD', 'Haus Valcor → Nox · 14:32'), ('gold', 'BAU', 'Steinbruch 16 · 13:42'), ('green', 'FLOTTE', 'Transport → Vesper · 13:50'),
         ('blue', 'GILDE', 'Mira hält Nox mit 40 Jägern'), ('gold', 'HEROLD', 'Schlacht über Gorgonis III')]


def tracker():
    return ('<div class="k-tracker"><span class="k-tl">TRACKER</span>'
            + ''.join(f'<span>{tag(c, t)} {d}</span>' for c, t, d in TRACK) + '<span class="m-dim">alle im Dashboard ▸</span></div>')


def smallmenu():
    return ('<div class="k-abs" style="right: 12px; top: 10px; display: flex; gap: 8px; align-items: center">'
            + ''.join(f'<div class="k-iconbtn" title="{n}" style="width: 36px; height: 36px">{g(gl, 18)}{f"<i>{c}</i>" if c else ""}</div>' for gl, n, c in
                      [('book', 'Lexikon', ''), ('people', 'Soziales', '3'), ('gear', 'Optionen + Admin', '')])
            + '<span class="m-mode" style="margin-left: 4px"><span class="on">Modern</span><span>Classic</span></span></div>')


def topline(where):
    return ('<div class="k-abs" style="left: 12px; top: 10px; display: flex; gap: 10px; align-items: center">'
            f'<b style="font: 800 14px var(--head); letter-spacing: 0.12em; color: var(--gold-hi)">NOVA IMPERIUM</b><span class="k-pill">{where}</span>'
            + resline() + '</div>')


def chat(open_=False):
    if not open_:
        return ('<div class="k-abs" style="right: 14px; bottom: 44px; display: flex; gap: 8px; align-items: center; background: rgb(15 11 8 / 0.95); border: 1px solid var(--gold); border-radius: 18px; padding: 6px 14px">'
                + g('chat', 18) + '<b style="font-size: 13.5px">Chat</b><span class="m-tag red">3</span><span class="m-dim" style="font-size: 12.5px">Mira: „Ich schicke Jäger …“</span></div>')
    return ('<div class="k-panel k-chat" style="width: 340px"><div class="k-ph">Chat<span class="k-x">— ✕</span></div>'
            '<div class="k-pb"><div class="m-chips"><span class="m-chip on">Gilde 3</span><span class="m-chip">Leander 1</span><span class="m-chip">Mira</span><span class="m-chip">+</span></div>'
            '<div class="k-msg"><b>Mira</b> Valcor fliegt auf Nox, 14:32.</div><div class="k-msg"><b>Tamas</b> Ich hab nur Fregatten frei.</div>'
            '<div class="k-msg"><b>Mira</b> Ich schicke 40 Abfangjäger zum Halten.</div><div class="k-msg me"><span>Danke! Ich baue Batterien nach.</span></div>'
            '<div style="font-size: 12.5px; margin: 6px 0; padding: 6px; border: 1px dashed var(--line); border-radius: 4px">⚔ Bericht geteilt: Nox verteidigt · Sieg ▸</div>'
            '<span class="m-input" style="display: block">Nachricht an Gilde …</span></div></div>')


def frame(where, body, chat_open=False, bg=None):
    return desk((bg or '<div class="k-stars" style="position: absolute; inset: 0"></div>') + body + topline(where) + smallmenu() + chat(chat_open) + tracker())


def d1():
    own = ''.join(f'<div style="display: flex; gap: 8px; align-items: center; margin: 5px 0">{ball(k, n, 30)}<div style="font-size: 13px"><b>{nm}</b> '
                  f'<span style="color: var(--{c})">{t}</span></div></div>'
                  for k, n, nm, c, t in [('normal', 1, 'Aurelia', 'orange', 'Lager fast voll · baut'), ('wasser', 0, 'Nox', 'red', 'Angriff 14:32 · Bau leer'), ('dschungel', 2, 'Vesper', 'green', 'Transport 13:50')])
    body = ('<div class="k-abs" style="left: 16px; top: 56px; font: 800 24px var(--head); color: var(--gold)">Lage im Imperium</div>'
            '<div class="k-panel k-abs" style="left: 16px; top: 96px; width: 600px; height: 380px"><div class="k-ph">Was die anderen tun<span class="k-x">Nachbarn · Gilde · Krieg · Herold</span></div><div class="k-pb">'
            + feed() + '</div></div>'
            '<div class="k-panel k-abs" style="left: 630px; top: 96px; width: 300px; height: 220px"><div class="k-ph">Deine Welten</div><div class="k-pb">' + own + '</div></div>'
            '<div class="k-panel k-abs" style="left: 630px; top: 330px; width: 300px; height: 146px"><div class="k-ph">Seit deinem Besuch</div><div class="k-pb" style="line-height: 1.7">'
            + tag('red', 'KAMPF') + ' Nox verteidigt · Sieg<br />' + tag('blue', 'FORSCHUNG') + ' Waffensegnung 11<br />' + tag('gold', 'SPIONAGE') + ' 3 Berichte</div></div>'
            '<div class="k-abs" style="left: 950px; top: 96px; width: 310px; height: 380px; border: 1px solid var(--gold); border-radius: 8px; overflow: hidden">'
            + galaxy_svg(310, 380) + '<div class="k-abs" style="left: 0; right: 0; bottom: 0; padding: 10px; background: linear-gradient(transparent, rgb(0 0 0 / 0.85)); text-align: center">'
            '<span class="m-btn big">Zur Sternenkarte ▸</span></div></div>'
            '<div class="k-panel k-abs" style="left: 16px; top: 490px; width: 914px"><div class="k-ph">Rangliste heute<span class="k-x">Platz 7 · ▲ 1</span></div><div class="k-pb" style="display: flex; gap: 22px; font-size: 13.5px">'
            '<span>1 Haus Valcor <span class="up">▲2</span></span><span>2 Brüderschaft Ashkar <span class="down">▼1</span></span><span>3 Orden von Kessra —</span><span><b>7 Du</b> <span class="up">▲1</span></span><span>8 Leander <span class="down">▼1</span></span></div></div>')
    return frame('Dashboard', body)


def d2():
    hint = ('<div class="k-panel k-abs" style="left: 16px; top: 60px; width: 290px"><div class="k-ph">Sternenkarte = Menü</div><div class="k-pb" style="font-size: 13px; line-height: 1.6">'
            'Klick auf <b>eigene Welt</b> → hineinzoomen und bauen<br />Ziehen von Welt zu Ziel → Flotte<br />Klick auf <b>fremde Welt</b> → Inspektor<br />Mausrad: Universum ⇄ Galaxie ⇄ System ⇄ Welt (#160)</div></div>'
            '<div class="k-abs" style="left: 460px; top: 430px">' + tag('gold', 'BAUT') + '</div><div class="k-abs" style="left: 560px; top: 470px">' + tag('red', 'ANGRIFF 14:32') + '</div>')
    return frame('Galaxie 1', hint, bg='<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="inset: 0">' + galaxy_svg(1280, 720) + '</div>')


def d3():
    surf = ('<div class="k-abs" style="inset: 0; background: url(/planets/normal-1-surface.svg) center / 1400px auto; filter: brightness(0.55)"></div>'
            '<div class="k-abs" style="inset: 0; background: radial-gradient(ellipse at 40% 50%, transparent 30%, rgb(0 0 0 / 0.7))"></div>')
    blds = ''.join(f'<div class="k-slot {st}" style="left: {x}px; top: {y}px; width: 76px"><img src="{I}{ic}" alt="" style="width: 64px; height: 64px; border-radius: 10px" /><span>{lb}</span></div>'
                   for ic, lb, x, y, st in [('buildings/metal_mine.svg', 'Tiefbohrung 18', 120, 150, ''), ('buildings/crystal_mine.svg', 'Steinbruch 15 · 22 min', 250, 120, 'run'),
                                            ('buildings/deuterium_synthesizer.svg', 'Raffinerie 12', 380, 170, 'ok'), ('buildings/solar_plant.svg', 'Kathedrale 16', 170, 290, 'ok'),
                                            ('buildings/research_lab.svg', 'Scholarium 9', 320, 320, 'run'), ('buildings/shipyard.svg', 'Werft 8', 460, 300, 'run'),
                                            ('buildings/crystal_storage.svg', 'Reliquiar 5', 240, 440, 'warn'), ('buildings/robotics_factory.svg', 'Servitoren 8', 400, 450, '')])
    side = ('<div class="k-abs" style="left: 640px; top: 56px"><div class="k-panel" style="width: 290px"><div class="k-ph">Aurelia · alle Gebäude (kompakt)</div><div class="k-pb">' + grid(5, 48) + '</div></div></div>'
            '<div class="k-abs" style="left: 940px; top: 56px">' + info(326, True) + '</div>'
            '<div class="k-abs" style="left: 16px; top: 56px; font-size: 13px" class="m-dim"><span class="k-pill">Universum › Galaxie 1 › 1:27 › Aurelia</span></div>')
    return frame('Aurelia', blds + side, bg=surf)


def d4():
    m = '<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="inset: 0">' + galaxy_svg(1280, 720, route=False) + '</div>'
    drag = ('<svg class="k-abs" style="left: 0; top: 0" width="1280" height="720"><path d="M 520 400 Q 600 300 730 340" stroke="#f1d27a" stroke-width="3" fill="none" stroke-dasharray="8 5" />'
            '<circle cx="730" cy="340" r="18" fill="none" stroke="#f1d27a" stroke-width="2" /></svg>'
            '<div class="k-abs" style="left: 600px; top: 270px; font-size: 12.5px; background: rgb(15 11 8 / 0.9); border: 1px solid var(--gold); border-radius: 4px; padding: 3px 8px">1 h 12 · Treibstoff 1.240</div>')
    ring = ('<div class="k-abs" style="left: 650px; top: 260px; width: 160px; height: 160px; border-radius: 50%; border: 1px dashed var(--gold)">'
            + ''.join(f'<span class="k-pill" style="position: absolute; left: {x}px; top: {y}px;{" border-color: var(--gold-hi); color: var(--gold-hi)" if o else ""}">{t}</span>'
                      for t, x, y, o in [('Transport', 46, -14, True), ('Stationieren', 120, 64, False), ('Halten', 50, 146, False), ('Expedition', -60, 64, False)]) + '</div>')
    card = ('<div class="k-info k-abs" style="left: 860px; top: 230px; width: 300px"><h2 style="font-size: 16px">Aurelia → Vesper · Transport</h2>'
            '<div class="m-chips" style="margin: 6px 0"><span class="m-chip on">Vorlage: Transport</span><span class="m-chip">eigene Auswahl</span></div>'
            '<div class="m-kv"><span>Schiffe</span><b>8 Lastbarken</b><span>Fracht</span><b>160 k</b><span>Ankunft</span><b class="up">14:32</b><span>Rückkehr</span><b>15:44</b></div>'
            '<span class="m-btn big" style="display: block">Senden</span></div>')
    return frame('Galaxie 1 · Flotte ziehen', drag + ring + card, bg=m)


def d5():
    big = ('<div class="k-abs" style="left: 16px; top: 56px; font: 800 24px var(--head); color: var(--gold)">Dashboard · Ereignisse</div>'
           '<div class="k-panel k-abs" style="left: 16px; top: 96px; width: 360px"><div class="k-ph">Tracker, groß<span class="k-x">Filter ▾</span></div><div class="k-pb">'
           + ''.join(f'<div style="padding: 5px 0; border-bottom: 1px solid var(--line); font-size: 13px{"; background: rgb(212 165 55 / 0.1)" if i == 0 else ""}">{tag(c, t)} {d}</div>'
                     for i, (c, t, d) in enumerate([('green', 'KAMPF', 'Nox verteidigt · 03:12')] + TRACK)) + '</div></div>'
           '<div class="k-abs" style="left: 390px; top: 96px">' + report_card(500) + '</div>')
    return frame('Dashboard', big, chat_open=True)


# ------------------------------------------------------------- phone
def ph(body, chat_badge=True):
    trk = ('<div class="k-abs" style="left: 0; right: 0; bottom: 0; height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 10px; background: #0f0b08; border-top: 1px solid var(--line); font-size: 12.5px; white-space: nowrap; overflow: hidden">'
           + tag('red', 'FREMD') + ' Nox 14:32 · ' + tag('gold', 'BAU') + ' 13:42</div>')
    top = ('<div class="k-abs" style="left: 0; right: 0; top: 0; padding: 30px 10px 6px; background: rgb(18 13 10 / 0.92); border-bottom: 1px solid var(--line); display: flex; gap: 6px; align-items: center">'
           + pill('metal', '184 k') + pill('crystal', '92 k') + pill('deuterium', '41 k')
           + '<span style="margin-left: auto; display: flex; gap: 6px">' + ''.join(f'<span style="color: var(--gold-hi)">{g(n, 20)}</span>' for n in ['book', 'people', 'gear']) + '</span></div>')
    cb = (f'<div class="k-abs" style="right: 12px; bottom: 56px; width: 52px; height: 52px; border-radius: 50%; border: 2px solid var(--gold); background: #1d1611; display: grid; place-items: center; color: var(--gold-hi)">{g("chat", 24)}'
          '<span class="m-tag red" style="position: absolute; top: -6px; right: -6px; background: #120d0a">3</span></div>') if chat_badge else ''
    return phone(body + top + cb + trk)


def phones():
    p1 = ph('<div class="k-stars" style="position: absolute; inset: 0"></div><div style="position: relative; padding: 80px 10px 0"><b style="font: 800 18px var(--head); color: var(--gold)">Lage</b>'
            '<div class="k-panel" style="margin-top: 6px"><div class="k-ph">Was die anderen tun</div><div class="k-pb">' + feed(n=4) + '</div></div>'
            '<span class="m-btn big" style="display: block; margin-top: 10px">Zur Sternenkarte ▸</span></div>')
    p2 = ph('<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="left: -440px; top: 70px">' + galaxy_svg(1280, 640) + '</div>'
            '<div class="k-abs" style="left: 10px; top: 86px" ><span class="k-pill">Tippen: eigene Welt öffnen · fremde prüfen</span></div>')
    p3 = ph('<div class="k-abs" style="inset: 0; background: url(/planets/normal-1-surface.svg) center / 900px auto; filter: brightness(0.5)"></div>'
            '<div class="m-sheet" style="bottom: 44px; height: 480px"><b style="color: var(--gold-hi)">Aurelia · kompakt</b><div style="margin-top: 8px">' + grid(5, 62) + '</div></div>')
    p4 = ph('<div class="k-stars" style="position: absolute; inset: 0"></div><div class="k-abs" style="left: -440px; top: 70px">' + galaxy_svg(1280, 640) + '</div>'
            '<div class="m-sheet" style="bottom: 44px"><b style="color: var(--gold-hi)">Aurelia → Vesper</b><div class="m-chips" style="margin-top: 6px"><span class="m-chip on">Transport</span><span class="m-chip">Stationieren</span><span class="m-chip">Halten</span></div>'
            '<div class="m-kv"><span>Vorlage</span><b>8 Lastbarken</b><span>Ankunft</span><b class="up">14:32</b></div><span class="m-btn big" style="display: block">Senden</span></div>', False)
    p5 = ph('<div class="k-stars" style="position: absolute; inset: 0"></div><div class="m-sheet" style="bottom: 44px; height: 620px"><b style="color: var(--gold-hi)">Chat</b>'
            '<div class="m-chips" style="margin-top: 6px"><span class="m-chip on">Gilde 3</span><span class="m-chip">Leander</span></div>'
            '<div class="k-msg"><b>Mira</b> Valcor fliegt auf Nox, 14:32.</div><div class="k-msg"><b>Mira</b> Ich schicke 40 Abfangjäger.</div><div class="k-msg me"><span>Danke!</span></div>'
            '<div style="font-size: 12.5px; margin: 8px 0; padding: 6px; border: 1px dashed var(--line); border-radius: 4px">⚔ Bericht: Nox verteidigt · Sieg ▸</div>'
            '<span class="m-input" style="display: block">Nachricht …</span></div>', False)
    return [(p1, 'Einstieg: Lage und was die anderen tun.'), (p2, 'Sternenkarte als Menü; Tippen statt Ziehen.'), (p3, 'Eigene Welt: Oberfläche, kompakt [E] als Blatt.'),
            (p4, 'Flotte: eigene Welt, dann Ziel antippen, Auftrag im Blatt.'), (p5, 'Nachrichten als Chat; Berichte kommen über den Tracker.')]


def build():
    intro = ('<div class="k-intro"><div><b>Schwerpunkt: Dashboard und Sternenkarte statt Menü</b> (Idee des Owners, 2026-11-23, [E]). '
             'Der Einstieg ist ein Dashboard, das zeigt, was die anderen tun. Die Sternenkarte ersetzt das Menü: hineinzoomen in eine eigene Welt heißt bauen, von Welt zu Ziel ziehen heißt fliegen. '
             'Nur ein kleines Menü bleibt (Lexikon, Soziales, Optionen + Admin). Nachrichten sind ein Chat unten rechts, ein Tracker unten zeigt die neuesten Ereignisse; groß stehen sie im Dashboard. Nichts bleibt vom alten Aufbau.</div>'
             '<div><ul><li>[E] Dashboard als Einstieg · Karte statt Menü · kleines Menü · Chat unten rechts · Tracker unten.</li>'
             '<li>[V] Bauen auf der Oberfläche der Welt (#158), kompakt [E] daneben.</li><li>[V] Flotte durch Ziehen, Auftrag im Ring, Vorlage füllt die Schiffe.</li>'
             '<li>[V] Berichte gibt es nicht als Seite: Tracker → Dashboard groß; Teilen in den Chat.</li></ul></div></div>')
    desks = [('d1', '1 · Einstieg – Dashboard: was die anderen tun', d1(), 'Was Nachbarn, Gilde, Kriegsgegner und der Herold melden; eigene Welten klein; ein Klick führt in die Karte.'),
             ('d2', '2 · Sternenkarte als Menü', d2(), 'Alles beginnt auf der Karte; das kleine Menü oben rechts, Chat und Tracker unten.'),
             ('d3', '3 · Bauen – in die Welt hineinzoomen', d3(), 'Die eigene Welt als Oberfläche mit Gebäuden; kompakt [E] und Infoseite daneben.'),
             ('d4', '4 · Flotte – von Welt zu Ziel ziehen', d4(), 'Ziehen zeigt Flugzeit und Treibstoff; loslassen öffnet den Auftragsring; die Karte rechts bestätigt.'),
             ('d5', '5 · Berichte und Nachrichten', d5(), 'Der Tracker groß im Dashboard, der Bericht als Karte; der Chat unten rechts mit Gilde und Spielern, Berichte lassen sich teilen.')]
    return page('Studie D – Dashboard und Karte', 'Studie D · Idee des Owners [E] · Ausgestaltung [V] · Styling bleibt [E] · Werte sind Beispiele',
                '<h2 class="m-h">Studie D · Lage und Karte statt Menü</h2>' + intro + steps(desks, phones()))
