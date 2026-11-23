"""Pages: empire, community, administration (UX study „Modern“, proposal only)."""
from shell import RES, ball, before, desk, page, phone

I = '/icons/'


def h1(title, crumb, right=''):
    return (f'<div class="m-title"><h1>{title}</h1><span class="m-crumb">{crumb}</span>'
            f'<div class="m-right">{right}</div></div>')


def ptitle(t):
    return f'<div style="font: 800 18px var(--head); color: var(--gold); margin-bottom: 6px">{t}</div>'


def fillcell(icon, val, pct, note, hot=False):
    col = 'orange' if hot else 'gold'
    return (f'<td><div style="display: flex; gap: 4px; align-items: center"><img src="{RES}{icon}.svg" alt="" style="width: 14px" />'
            f'<b class="m-num">{val}</b></div><div class="m-prog" style="height: 4px; margin: 2px 0"><i style="width: {pct}%; background: var(--{col})"></i></div>'
            f'<span style="font-size: 11.5px; color: var(--{"orange" if hot else "dim"})">{note}</span></td>')


def spark(points, color='#9ccb76'):
    return (f'<svg viewBox="0 0 80 20" style="width: 80px; height: 20px"><polyline fill="none" stroke="{color}" '
            f'stroke-width="1.5" points="{points}" /></svg>')


# ------------------------------------------------------------------ empire
def imperium():
    rows = [
        ('normal', 1, 'Aurelia', '[1:27:8]', ('184 k', 71, 'voll 6 h'), ('92 k', 88, 'voll 1 h 40', True), ('41 k', 34, '+1,9 k/h'), '<span class="down">−120</span>',
         ('Psikristall-Steinbruch 16', 64), ('Warp-Antrieb 5', 18), ('12 Fregatten', 40), ''),
        ('wasser', 0, 'Nox', '[1:31:4]', ('61 k', 40, 'voll 11 h'), ('33 k', 35, 'voll 9 h'), ('12 k', 20, '+0,8 k/h'), '<span class="up">+40</span>',
         ('— leer', 0), ('', 0), ('', 0), '<span class="m-tag red">ANGRIFF 14:32</span>'),
        ('dschungel', 2, 'Vesper', '[1:44:9]', ('22 k', 15, 'voll 2 Tg'), ('9 k', 12, 'voll 2 Tg'), ('3 k', 9, '+0,4 k/h'), '<span class="up">+12</span>',
         ('Adamant-Tiefbohrung 9', 80), ('', 0), ('', 0), '<span class="m-tag green">TRANSPORT 13:50</span>'),
    ]
    trs = ''
    for kind, n, name, co, m, c, d, e, b, r, s, inc in rows:
        def q(x):
            return (f'<div style="font-size: 12.5px">{x[0]}</div><div class="m-prog" style="height: 4px"><i style="width: {x[1]}%"></i></div>' if x[1]
                    else f'<span class="{"down" if "leer" in x[0] else "m-dim"}" style="font-size: 12.5px">{x[0] or "—"}</span>')
        trs += (f'<tr><td><div style="display: flex; gap: 8px; align-items: center">{ball(kind, n)}<div><b>{name}</b><br /><span class="m-dim" style="font-size: 12px">{co}</span></div></div></td>'
                + fillcell('metal', *m) + fillcell('crystal', c[0], c[1], c[2], len(c) > 3) + fillcell('deuterium', *d)
                + f'<td>{e}</td><td>{q(b)}</td><td>{q(s)}</td><td>{inc}</td></tr>')
    table = ('<div class="m-card"><table class="m-mini" style="font-size: 14px"><tr><th>Welt</th><th>Adamant</th><th>Psikristall</th><th>Promethium</th>'
             '<th>Energie</th><th>Bau</th><th>Werft</th><th>Flotten</th></tr>' + trs
             + '<tr><td><b>Summe</b></td><td><b>267 k</b><br /><span class="m-dim">+6,1 k/h</span></td><td><b>134 k</b><br /><span class="m-dim">+3,0 k/h</span></td>'
             '<td><b>56 k</b><br /><span class="m-dim">+3,1 k/h</span></td><td></td><td colspan="3" class="m-dim">Forschung: Warp-Antrieb 5 (reichsweit) · 3 h 12 min</td></tr></table></div>')
    prod = ('<div class="m-two" style="margin-top: 12px"><div class="m-card"><div class="m-ch">Rohstoffe · Aurelia<span class="m-right">Produktion je Stunde</span></div><div class="m-cb">'
            + ''.join(f'<div style="display: grid; grid-template-columns: 160px 1fr 70px 60px; gap: 8px; align-items: center; font-size: 13.5px; margin: 5px 0">'
                      f'<span>{n}</span><div class="m-prog" style="height: 10px"><i style="width: {w}%; background: var(--{col})"></i></div><b class="m-num">{v}</b><span class="m-chip" style="text-align: center">{p} %</span></div>'
                      for n, w, col, v, p in [('Adamant-Tiefbohrung 18', 82, 'm', '3.410', 100), ('Psikristall-Steinbruch 15', 60, 'c', '1.690', 100),
                                              ('Promethium-Raffinerie 12', 44, 'd', '1.920', 100), ('Fusionssanktum 0', 0, 'e', '—', 0)])
            + '<div class="m-dim" style="font-size: 12.5px">Prozent je Erzeuger wie heute einstellbar; die Balken zeigen den Anteil am Lager pro Tag.</div></div></div>'
            '<div class="m-card"><div class="m-ch">Energie · Aurelia<span class="m-right down">Defizit 120</span></div><div class="m-cb">'
            '<div style="font-size: 13px" class="m-dim">Erzeugung</div><div style="display: flex; height: 14px; border-radius: 3px; overflow: hidden; margin: 3px 0 8px">'
            '<i style="width: 78%; background: var(--e)"></i><i style="width: 12%; background: #b88a2a"></i></div>'
            '<div style="font-size: 13px" class="m-dim">Verbrauch</div><div style="display: flex; height: 14px; border-radius: 3px; overflow: hidden; margin: 3px 0 8px">'
            '<i style="width: 44%; background: var(--m)"></i><i style="width: 34%; background: var(--c)"></i><i style="width: 22%; background: var(--d)"></i></div>'
            '<div class="m-kv"><span>Sonnenkathedrale 16</span><b>1.240</b><span>Sonnenreliquiare 30</span><b>230</b><span>Minen brauchen</span><b>1.590</b>'
            '<span>Minen laufen mit</span><b class="down">94 %</b></div><span class="m-btn">Sonnenkathedrale 17 bauen</span></div></div></div>')
    main = (h1('Kolonien', 'Imperium · alle Welten', '<span class="m-chip on">Übersicht</span><span class="m-chip">Lager</span><span class="m-chip">Flotten</span><span class="m-chip">Abwehr</span>')
            + table + prod)
    ph = (ptitle('Kolonien')
          + ''.join(f'<div class="m-card" style="margin-bottom: 8px"><div class="m-cb" style="font-size: 13.5px"><div style="display: flex; gap: 8px; align-items: center">{ball(k, n)}<b>{nm}</b>'
                    f'<span class="m-dim">{co}</span><span style="margin-left: auto">{tag}</span></div>'
                    f'<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 6px">{a}</div><div class="m-dim" style="margin-top: 4px">{q}</div></div></div>'
                    for k, n, nm, co, tag, a, q in [
                        ('normal', 1, 'Aurelia', '[1:27:8]', '<span class="m-dot warn"></span>',
                         '<span>184 k<br /><span class="m-dim">6 h</span></span><span style="color: var(--orange)">92 k<br />1 h 40</span><span>41 k<br /><span class="m-dim">+1,9 k</span></span>',
                         'Bau: Steinbruch 16 · 22 min'),
                        ('wasser', 0, 'Nox', '[1:31:4]', '<span class="m-tag red">14:32</span>',
                         '<span>61 k</span><span>33 k</span><span>12 k</span>', '<span class="down">Bau: leer</span>'),
                        ('dschungel', 2, 'Vesper', '[1:44:9]', '<span class="m-dot ok"></span>',
                         '<span>22 k</span><span>9 k</span><span>3 k</span>', 'Bau: Tiefbohrung 9 · 1 h')]))
    content = (
        '<h2 class="m-h">Heute</h2>'
        + before('desktop-resources.png', 'phone-resources.png', 'Rohstoffe nur je Planet als Zahlentabelle; einen Blick über alle Welten gibt es nicht.')
        + '<h2 class="m-h">Desktop: alle Welten auf einen Blick, Produktion als Balken</h2>'
        + desk('Imperium', 'Kolonien', main, None, queue=False, tall=True)
        + '''<div class="m-two" style="margin-top: 12px"><div class="m-ann"><ol>
<li><b>Eine Zeile pro Welt</b>: Lager mit „voll in“, Energie, was baut, was die Werft macht, welche Flotte kommt (Travian zentrale Dorfübersicht, OGame Imperiumsansicht, Grepolis Administrator).</li>
<li>Die Spiele verkaufen genau diese Ansicht als Premium; das macht ihre Grundoberfläche zur Seitenwand.</li>
<li><b>Produktion und Energie als Balken</b> mit der Folge („Minen 94 %“) und dem Knopf, der sie behebt.</li></ol></div>
<div class="m-ann"><ol start="4"><li class="m-note red" style="list-style: none; margin-left: -18px"><b>Konflikt mit #243:</b> Dort soll eine Forschung („Kogitator-Verbund“) diese Ansicht stufenweise freischalten. Die Recherche spricht dafür, sie allen zu geben. Entscheidung nötig (siehe Issue).</li>
<li>Zum Bereich „Imperium“ gehören auch die Erfolge (Achievements); die Rangliste steht bei Gemeinschaft.</li></ol></div></div>'''
        + '<h2 class="m-h">Handy: eine Karte pro Welt</h2><div class="m-row">' + phone('Mehr', ph)
        + '<div class="m-ann"><ul><li>Karten statt Spalten; Warnung pro Welt oben rechts.</li><li>Antippen wechselt die aktive Welt und bleibt auf derselben Seite (#236).</li></ul></div></div>')
    return page('Studie – Modern: Imperium', 'Studie [V] · Kolonien, Rohstoffe und Energie · Werte sind Beispiele · Styling bleibt [E]', content)


# ------------------------------------------------------------------ community
def gemeinschaft():
    coords = {1: '[1:44:4]', 2: '[2:12:7]', 3: '[1:44:6]', 7: '[1:27:8]', 8: '[1:44:8]'}
    ranks = [(1, '▲ 2', 'Haus Valcor', 'VAL', '1.284.300', '0,15 0,13 10,13 20,11 30,10 40,8 50,7 60,5 70,4 80,2', '#9ccb76', False),
             (2, '▼ 1', 'Brüderschaft Ashkar', 'ASH', '1.201.900', '0,4 10,4 20,5 30,6 40,6 50,8 60,9 70,10 80,11', '#ee7660', False),
             (3, '—', 'Orden von Kessra', 'KES', '988.400', '0,12 10,12 20,11 30,11 40,10 50,10 60,9 70,9 80,9', '#a8997f', False),
             (7, '▲ 1', 'Du (Aurelia)', 'KES', '402.100', '0,16 10,15 20,15 30,13 40,12 50,11 60,9 70,8 80,7', '#9ccb76', True),
             (8, '▼ 1', 'Leander', '', '398.700', '0,8 10,8 20,9 30,9 40,10 50,10 60,10 70,11 80,11', '#ee7660', False)]
    tr = ''.join(f'<tr style="{"background: rgb(212 165 55 / 0.1)" if me else ""}"><td class="n"><b>{r}</b></td>'
                 f'<td class="{"up" if "▲" in d else "down" if "▼" in d else "m-dim"}">{d}</td><td><b>{n}</b> <span class="m-dim">{t}</span></td>'
                 f'<td class="n m-num">{p}</td><td>{spark(sp, col)}</td></tr>' for r, d, n, t, p, sp, col, me in ranks)
    hs = ('<div class="m-card"><div class="m-ch">Rangliste<span class="m-right">Veränderung seit gestern · 7 Tage</span></div>'
          '<div class="m-cb"><div class="m-tabs"><span class="on">Gesamt</span><span>Gebäude</span><span>Forschung</span><span>Flotte</span><span>Abwehr</span></div>'
          '<table class="m-mini" style="font-size: 14px"><tr><th class="n">Platz</th><th>±</th><th>Spieler</th><th class="n">Punkte</th><th>Verlauf</th></tr>'
          + tr + '</table><div class="m-dim" style="font-size: 12.5px; margin-top: 6px">Platz 4–6 eingeklappt · eigene Zeile bleibt sichtbar</div></div></div>')
    guild = ('<div class="m-card"><div class="m-ch">Gilde · Orden von Kessra [KES]<span class="m-right">9 Mitglieder · Rang: Hauptmann</span></div><div class="m-cb">'
             '<div class="m-tabs"><span class="on">Lage</span><span>Mitglieder</span><span>Chat <em>3</em></span><span>Ränge</span><span>Depot</span></div>'
             '<div style="font-size: 13.5px; line-height: 1.8"><div><span class="m-tag red">ANGRIFF</span> auf Nox (du) · 14:32 · <span class="m-dim">Halten möglich: 2 Mitglieder in Reichweite</span></div>'
             '<div><span class="m-tag gold">CHAT</span> Mira: „Ich schicke Abfangjäger nach Nox.“ · 13:05</div>'
             '<div><span class="m-tag green">MITGLIED</span> Leander ist beigetreten · gestern</div></div>'
             '<div class="m-sect">MITGLIEDER ONLINE</div><div class="m-chips"><span class="m-chip">● Mira · Leitung</span><span class="m-chip">● Tamas</span><span class="m-chip off">◌ Leander · 1 Tg</span></div></div></div>')
    friends = ('<div class="m-card" style="margin-top: 12px"><div class="m-ch">Freunde<span class="m-right">2 · 1 Anfrage</span></div><div class="m-cb" style="font-size: 13.5px">'
               '<div>Mira · <span class="m-dim">Orden von Kessra</span> · <span class="m-btn ghost">Nachricht</span></div>'
               '<div style="margin-top: 6px">Anfrage von Tarsis · <span class="m-btn">Annehmen</span> <span class="m-btn ghost">Ablehnen</span></div></div></div>')
    main = (h1('Gemeinschaft', 'Rangliste, Gilde, Freunde', '<span class="m-chip">Imperialer Herold →</span>')
            + '<div style="display: grid; grid-template-columns: 1.1fr 1fr; gap: 12px"><div>' + hs + '</div><div>' + guild + friends + '</div></div>')
    ph = (ptitle('Rangliste')
          + '<div class="m-chips"><span class="m-chip on">Gesamt</span><span class="m-chip">Flotte</span><span class="m-chip">Forschung</span><span class="m-chip">…</span></div>'
          + ''.join(f'<div class="m-pit" style="grid-template-columns: 30px 1fr auto{"; background: rgb(212 165 55 / 0.1)" if me else ""}"><b>{r}</b>'
                    f'<div><div class="m-nm" style="font-size: 14px">{n}</div><div class="m-sm">{coords[r]} · <span class="{"up" if "▲" in d else "down" if "▼" in d else ""}">{d}</span></div></div>'
                    f'<div style="text-align: right"><b class="m-num">{p}</b><br />{spark(sp, col)}</div></div>'
                    for r, d, n, t, p, sp, col, me in ranks))
    content = (
        '<h2 class="m-h">Heute</h2>'
        + before('desktop-highscore.png', 'phone-highscore.png', 'eine lange Punkte-Tabelle ohne Veränderung und ohne Verlauf.')
        + '<h2 class="m-h">Desktop: Rangliste mit Bewegung, Gilde als Lagebild</h2>'
        + desk('Gemeinschaft', 'Gilde', main, None, queue=False)
        + '''<div class="m-two" style="margin-top: 12px"><div class="m-ann"><ol>
<li><b>Rangliste</b> mit ▲/▼ seit gestern und einem kleinen Verlauf; die eigene Zeile bleibt sichtbar. Das ist abgeleitet, keine Quelle zeigt es so für Strategiespiele [V].</li>
<li><b>Daten</b>: Verlauf braucht gespeicherte Tagespunkte. Heute gibt es Punkte nur aktuell; das Rundenarchiv (#235) schreibt erst am Ende. [U] Speicher nötig.</li></ol></div>
<div class="m-ann"><ol start="3"><li><b>Gilde als Lage</b>: Angriffe auf Mitglieder, Chat-Auszug, wer online ist; Reiter für Mitglieder, Chat (#169), Ränge (#163), Depot (#55).</li>
<li>Auf dem Handy bleibt die Regel von #189 D7 [E]: Koordinaten klein unter dem Namen, keine Spalte „Heimatplanet“.</li></ol></div></div>'''
        + '<h2 class="m-h">Handy: Rangliste</h2><div class="m-row">' + phone('Mehr', ph) + '</div>')
    return page('Studie – Modern: Gemeinschaft', 'Studie [V] · Rangliste, Gilde, Freunde · Namen und Werte sind Beispiele · Styling bleibt [E]', content)


# ------------------------------------------------------------------ administration
def verwaltung():
    opts = (h1('Optionen', 'Konto und Darstellung', '<span class="m-input">Einstellung suchen …</span>')
            + '<div style="display: grid; grid-template-columns: 200px 1fr; gap: 14px"><div class="m-list">'
            + ''.join(f'<div class="m-it{" sel" if s else ""}" style="grid-template-columns: 1fr; font-size: 14px">{n}</div>'
                      for n, s in [('Darstellung', True), ('Erklärtexte', False), ('Benachrichtigungen', False), ('Hauptplanet', False),
                                   ('Urlaubsmodus', False), ('Anmeldung und Passkeys', False), ('Konto löschen', False)])
            + '</div><div class="m-card"><div class="m-ch">Darstellung</div><div class="m-cb" style="font-size: 14px">'
            + ''.join(f'<div style="display: grid; grid-template-columns: 220px 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line)"><b>{k}</b><div>{v}</div></div>'
                      for k, v in [('Oberfläche', '<span class="m-chip on">Modern</span> <span class="m-chip">Classic</span> <span class="m-dim">auch oben rechts umschaltbar</span>'),
                                   ('Dichte', '<span class="m-chip on">Normal</span> <span class="m-chip">Kompakt</span>'),
                                   ('Berichte', '<span class="m-chip on">Zusammenfassung</span> <span class="m-chip">Ausführlich</span>'),
                                   ('Sternenkarte', '<span class="m-chip on">Karte</span> <span class="m-chip">Liste</span> <span class="m-dim">(#160)</span>'),
                                   ('Bewegung', '<span class="m-chip">folgt dem System</span> <span class="m-chip on">aus</span>')])
            + '</div></div></div>')
    admin = (h1('Admin', 'Runde 7 · 14 Spieler', '<span class="m-chip">Neue Runde …</span>')
             + '<div class="m-tabs"><span class="on">Lage</span><span>Universum</span><span>Spieler</span><span>Einladungen</span><span>Meldungen <em>2</em></span><span>Fehler <em>1</em></span><span>Protokoll</span></div>'
             + '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px">'
             + ''.join(f'<div class="m-card"><div class="m-cb"><div class="m-dim" style="font-size: 13px">{k}</div><div style="font: 800 22px var(--head); color: var(--gold-hi)">{v}</div><div class="m-dim" style="font-size: 12.5px">{n}</div></div></div>'
                       for k, v, n in [('Aktiv heute', '11 / 14', '3 im Urlaub'), ('Offene Meldungen', '2', 'älteste 5 h'), ('Fehler 24 h', '1', 'Browser'), ('Runde', 'Tag 23', 'Ende offen')])
             + '</div><div class="m-card" style="margin-top: 10px"><div class="m-ch">Was zu tun ist</div><div class="m-cb" style="font-size: 14px; line-height: 1.8">'
             '<div><span class="m-tag red">MELDUNG</span> Nachricht von Varn an Leander gemeldet · <span class="m-btn ghost">Prüfen</span></div>'
             '<div><span class="m-tag gold">FEHLER</span> Browserfehler in „Flotte“ · <span class="m-btn ghost">Ansehen</span></div></div></div>')
    lex = (ptitle('Lexicanum') + '<span class="m-input focus" style="display: block; margin-bottom: 8px">Fregatte</span>'
           + '<div class="m-pit"><img src="' + I + 'ships/cruiser.svg" alt="" /><div><div class="m-nm">Fregatte</div><div class="m-sm">Schiff · Schnellfeuer gegen Abfangjäger</div></div><span>›</span></div>'
           + '<div class="m-pit"><img src="' + I + 'research/impulse_drive.svg" alt="" /><div><div class="m-nm">Plasma-Impulsantrieb</div><div class="m-sm">Forschung · Antrieb der Fregatte</div></div><span>›</span></div>'
           + '<div class="m-card" style="margin-top: 8px"><div class="m-cb" style="font-size: 13.5px">Artikel öffnen als Seite oder Seitenleiste (#285, gebaut); im neuen Aufbau auch aus jedem Inspektor über „Lexicanum“.</div></div>')
    login = ('<div style="padding-top: 90px; text-align: center"><div style="font: 800 22px var(--head); letter-spacing: 0.14em; color: var(--gold-hi)">NOVA IMPERIUM</div>'
             '<div class="m-dim" style="margin-bottom: 20px">Runde 7 · Tag 23</div>'
             '<div class="m-card" style="text-align: left"><div class="m-cb"><span class="m-btn big" style="display: block">Mit Passkey anmelden</span>'
             '<div class="m-dim" style="text-align: center; margin: 10px 0">oder</div><span class="m-input" style="display: block; margin-bottom: 6px">Name</span>'
             '<span class="m-input" style="display: block; margin-bottom: 8px">Passwort</span><span class="m-btn ghost big" style="display: block">Anmelden</span>'
             '<div class="m-dim" style="font-size: 13px; margin-top: 8px">Nur mit Einladung.</div></div></div></div>')
    content = (
        '<h2 class="m-h">Optionen: Abschnitte mit Suche</h2>' + desk('Optionen', None, opts, None, queue=False)
        + '<div class="m-ann" style="max-width: none; margin-top: 10px">Optionen in Abschnitten statt einer langen Seite; die Suche findet jede Einstellung. Alle heutigen Optionen bleiben (Erklärtexte #63, Push #192, Hauptplanet #221, Urlaub #223).</div>'
        + '<h2 class="m-h">Admin: Lage zuerst</h2>' + desk('Admin', None, admin, None, queue=False)
        + '<div class="m-ann" style="max-width: none; margin-top: 10px">Der Admin-Bereich beginnt mit dem, was zu tun ist; die heutigen Reiter bleiben (#126, #181, Einladungen, Protokoll). Nur für Admins sichtbar.</div>'
        + '<h2 class="m-h">Handy: Lexicanum und Anmeldung</h2><div class="m-row">' + phone('Mehr', lex)
        + '<div class="m-phone"><div class="m-pbody">' + login + '</div></div>'
        + '<div class="m-ann"><ul><li>Lexicanum: Suche zuerst, Treffer mit Bild und Art.</li><li>Anmeldung: Passkey als erste Wahl, wenn eingerichtet (gibt es schon).</li></ul></div></div>')
    return page('Studie – Modern: Verwaltung', 'Studie [V] · Optionen, Admin, Lexicanum, Anmeldung · Styling bleibt [E]', content)


PAGES = {
    '06-imperium.html': imperium,
    '07-gemeinschaft.html': gemeinschaft,
    '08-verwaltung.html': verwaltung,
}
