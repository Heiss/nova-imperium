"""Pages: navigation and building (UX study „Modern“, proposal only)."""
from shell import RES, ball, before, desk, g, page, phone

I = '/icons/'


def cost(icon, have_pct, text, short=False):
    s = ' short' if short else ''
    return (f'<div class="m-cost{s}"><img src="{RES}{icon}.svg" alt="" />'
            f'<span>{text}</span><div class="m-bar"><i style="width: {have_pct}%"></i></div></div>')


def item(icon, name, lvl, eff, costs, time, btn, sel=False, dim=False):
    cls = ' sel' if sel else ''
    cls += ' dim' if dim else ''
    return (f'<div class="m-it{cls}"><img class="m-ic" src="{I}{icon}" alt="" />'
            f'<div><div class="m-nm">{name}<em>{lvl}</em></div><div class="m-eff">{eff}</div></div>'
            f'<div class="m-costs">{costs}</div><div class="m-time">{time}</div>'
            f'<div>{btn}</div></div>')


# ------------------------------------------------------------------ navigation
def navigation():
    sitemap = '''
<div class="m-card"><div class="m-ch">Heute 17 gleichrangige Menüpunkte → 7 Bereiche [V]</div>
<div class="m-cb"><table class="m-mini">
<tr><th>Bereich (neu)</th><th>enthält (heute eigene Seiten)</th><th>Handy</th></tr>
<tr><td><b>Übersicht</b></td><td>Übersicht → Dashboard aus #236</td><td>Tab Übersicht</td></tr>
<tr><td><b>Planet</b></td><td>Gebäude, Forschung, Schiffsschmiede, Verteidigung (ein Katalog mit Reitern), Rohstoffe</td><td>Tab Bauen [E #189]</td></tr>
<tr><td><b>Flotte</b></td><td>Flotte (Versenden), Flottenbewegungen, neu: Vorlagen</td><td>Tab Flotte</td></tr>
<tr><td><b>Sternenkarte</b></td><td>Sternenkarte (#160)</td><td>Tab Karte</td></tr>
<tr><td><b>Berichte</b></td><td>Nachrichten, Kampf- und Spionageberichte, neu: „Seit deinem Besuch“</td><td>Glocke [E #189]</td></tr>
<tr><td><b>Imperium</b></td><td>neu: Kolonien (#243), Achievements → Erfolge</td><td>Mehr</td></tr>
<tr><td><b>Gemeinschaft</b></td><td>Highscore → Rangliste, Gilden, Freunde, Imperialer Herold (#382)</td><td>Mehr</td></tr>
<tr><td class="m-dim">unten</td><td class="m-dim">Lexicanum, Optionen; Neuigkeiten unter Optionen, Marktplatz/Börse unter Planet; Admin nur für Admins</td><td>Mehr</td></tr>
</table></div></div>'''

    dash = '''
<div class="m-title"><h1>Übersicht</h1><span class="m-crumb">Dashboard „Brücke“ · Aufbau aus #236</span>
<div class="m-right"><span class="m-btn ghost">Bearbeiten</span></div></div>
<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px">
<div class="m-card" style="grid-column: span 2"><div class="m-ch">Was in deiner Abwesenheit geschah<span class="m-right">seit gestern 22:14</span></div>
<div class="m-cb" style="font-size: 14px; line-height: 1.7">
<div><span class="m-tag red">KAMPF</span> Nox wurde angegriffen · <b>Sieg</b>, Verluste gering · <span class="m-dim">03:12</span></div>
<div><span class="m-tag blue">FORSCHUNG</span> Waffensegnung 11 abgeschlossen · <span class="m-dim">05:40</span></div>
<div><span class="m-tag green">FLOTTE</span> 2 Transporte aus Vesper zurück · <span class="m-dim">07:02</span></div>
<div><span class="m-tag gold">SPIONAGE</span> 3 Berichte · ältester 9 h · <span class="m-dim">bis 08:30</span></div></div></div>
<div class="m-card"><div class="m-ch">Nächste Schritte</div><div class="m-cb" style="font-size: 14px; line-height: 1.5">
<div><b>Psikristall-Lager</b> in 1 h 40 min voll</div><div class="m-dim">Psikristall-Reliquiar ausbauen</div>
<div style="margin: 6px 0 10px"><span class="m-btn">Zum Reliquiar</span></div>
<div><b>Energie fehlt</b> auf Aurelia (−120)</div><div class="m-dim">Minen laufen mit 94 %</div>
<div style="margin-top: 6px"><span class="m-btn ghost">Energie prüfen</span></div></div></div>
<div class="m-card"><div class="m-ch">Alle Kolonien</div><div class="m-cb" style="font-size: 14px">
<div class="m-pit" style="grid-template-columns: 30px 1fr auto">''' + ball('normal', 1) + '''<div><b>Aurelia</b> <span class="m-dim">[1:27:8]</span></div><span class="m-dot warn"></span></div>
<div class="m-pit" style="grid-template-columns: 30px 1fr auto">''' + ball('wasser', 0) + '''<div><b>Nox</b> <span class="m-dim">[1:31:4]</span></div><span class="m-dot bad"></span></div>
<div class="m-pit" style="grid-template-columns: 30px 1fr auto; border: 0">''' + ball('dschungel', 2) + '''<div><b>Vesper</b> <span class="m-dim">[1:44:9]</span></div><span class="m-dot ok"></span></div></div></div>
<div class="m-card" style="grid-column: span 2"><div class="m-ch">Flottenbewegungen<span class="m-right">2 eigene · 1 fremde</span></div>
<div class="m-cb" style="font-size: 14px; line-height: 1.8">
<div><span class="m-tag red">FREMD</span> Angriff auf <b>Nox</b> · Ankunft <b>14:32</b> (in 1 h 12 min) · Flotte ≥ 8 Schiffe</div>
<div><span class="m-tag green">TRANSPORT</span> Aurelia → Vesper · Ankunft 13:50 · Rückkehr 15:10</div>
<div><span class="m-tag gold">EXPEDITION</span> Position 16 · Haltezeit endet 18:00</div></div></div></div>'''

    phone_more = '''
<div style="font: 600 13px var(--head); color: var(--gold); letter-spacing: 0.08em; margin-bottom: 8px">MEHR</div>
<div class="m-chips"><span class="m-chip">Rohstoffe</span><span class="m-chip">Vorlagen</span><span class="m-chip">Bewegungen</span></div>
<div class="m-pit" style="grid-template-columns: 26px 1fr auto">''' + g('empire', 22) + '''<div class="m-nm">Imperium</div><span class="m-sm">Kolonien · Erfolge</span></div>
<div class="m-pit" style="grid-template-columns: 26px 1fr auto">''' + g('people', 22) + '''<div class="m-nm">Gemeinschaft</div><span class="m-sm">Rangliste · Gilde · Herold</span></div>
<div class="m-pit" style="grid-template-columns: 26px 1fr auto">''' + g('book', 22) + '''<div class="m-nm">Lexicanum</div><span class="m-sm"></span></div>
<div class="m-pit" style="grid-template-columns: 26px 1fr auto">''' + g('gear', 22) + '''<div class="m-nm">Optionen</div><span class="m-sm">Modern / Classic</span></div>
<div class="m-pit" style="grid-template-columns: 26px 1fr auto; border: 0"><span></span><div class="m-sm">Neuigkeiten · Abmelden</div><span></span></div>'''

    phone_dash = '''
<div style="font: 800 18px var(--head); color: var(--gold); letter-spacing: 0.06em; margin-bottom: 8px">Übersicht</div>
<div class="m-card" style="margin-bottom: 8px"><div class="m-ch">Achtung</div><div class="m-cb" style="font-size: 14px; line-height: 1.6">
<div><span class="m-tag red">FREMD</span> Angriff auf Nox · 14:32</div><div><span class="m-tag gold">LAGER</span> Psikristall voll in 1 h 40</div></div></div>
<div class="m-card" style="margin-bottom: 8px"><div class="m-ch">Läuft</div><div class="m-cb" style="font-size: 14px">
<div>Psikristall-Steinbruch 16 <span class="m-dim" style="float: right">22 min</span></div><div class="m-prog" style="margin: 4px 0 8px"><i style="width: 64%"></i></div>
<div>Warp-Antrieb 5 <span class="m-dim" style="float: right">3 h 12</span></div><div class="m-prog" style="margin-top: 4px"><i style="width: 18%"></i></div></div></div>
<div class="m-card"><div class="m-ch">Seit deinem Besuch</div><div class="m-cb" style="font-size: 14px">1 Kampf · 1 Forschung · 2 Flotten · 3 Spionage</div></div>'''

    content = (
        '<h2 class="m-h">Heute</h2>'
        + before('desktop-overview.png', 'phone-overview.png',
                 'ein langer Menüstapel links, alle Punkte gleich wichtig; der Planet wird oben gewechselt, ohne Zustand.')
        + '<h2 class="m-h">Navigation: sieben Bereiche statt siebzehn Seiten</h2>'
        + '<div class="m-two">' + sitemap + '''<div class="m-ann"><ul>
<li><b>Bereiche statt Seiten</b>: Planet bündelt alles, was auf einer Welt gebaut wird; Flotte alles, was fliegt; Berichte alles, was gemeldet wird (Recherche: Clash of Clans 2026 legte vier Bau-Menüs zu einem zusammen).</li>
<li><b>Kopfzeile mit Zustand</b>: Lager zeigt „voll in …“ statt nur Zahlen, Energiedefizit mit Folge; der Planetenwechsel zeigt eine Warnung pro Welt (Travian, Grepolis).</li>
<li><b>„Läuft“ immer sichtbar</b> unten in der Leiste (Warteschlangen der aktiven Welt).</li>
<li><b>Handy bleibt beim Beschluss von #189</b>: Übersicht · Bauen · Flotte · Karte · Mehr, Berichte hinter der Glocke [E].</li>
<li><b>Modern/Classic</b> oben rechts, wie in #236 [E]; Classic bleibt die heutige Darstellung [E, 2026-11-23].</li></ul></div></div>'''
        + '<h2 class="m-h">Desktop: Rahmen mit Übersicht</h2>'
        + desk('Übersicht', None, dash)
        + '<h2 class="m-h">Handy: Übersicht und „Mehr“</h2><div class="m-row">'
        + phone('Übersicht', phone_dash)
        + phone('Mehr', phone_dash, phone_more, scrim=True)
        + '''<div class="m-ann"><ol>
<li>Kopf auf dem Handy: Planet, Glocke, eine Zeile Rohstoffe mit „voll in“.</li>
<li>Die Übersicht ist auf dem Handy die Karten-Folge aus #189 (Achtung, Läuft, Seit deinem Besuch).</li>
<li>„Mehr“ ist ein Blatt mit den Bereichen, nicht mehr eine lange Liste; Schnellzugriffe oben.</li></ol></div></div>''')
    return page('Studie – Modern: Navigation',
                'Studie [V] · UX-Neuaufbau „Modern“ · Styling bleibt (Farben, Schriften, Icons, Planeten) [E] · Aufbau, Texte und Zahlen sind Vorschläge und Beispiele',
                content)


# ------------------------------------------------------------------ building
def bauen():
    ok_btn = '<span class="m-btn">▲ Stufe {}</span>'
    rows_now = (
        item('buildings/crystal_mine.svg', 'Psikristall-Steinbruch', 'Stufe 15 → 16',
             '<b>+1.210 / h</b> Psikristall · Energie <b class="neg">−48</b>',
             cost('metal', 100, '55.340') + cost('crystal', 100, '27.670'),
             '<b>22 min</b>fertig 13:42', ok_btn.format(16), sel=True)
        + item('buildings/crystal_storage.svg', 'Psikristall-Reliquiar', 'Stufe 5 → 6',
               'Lager <b>+52.000</b> · sonst voll in 1 h 40',
               cost('metal', 100, '40.960') + cost('crystal', 100, '20.480'),
               '<b>41 min</b>fertig 14:01', ok_btn.format(6))
        + item('buildings/solar_plant.svg', 'Sonnenkathedrale', 'Stufe 16 → 17',
               'Energie <b>+248</b> · behebt das Defizit',
               cost('metal', 100, '49.263') + cost('crystal', 100, '19.705'),
               '<b>18 min</b>fertig 13:38', ok_btn.format(17)))
    rows_soon = (
        item('buildings/metal_mine.svg', 'Adamant-Tiefbohrung', 'Stufe 18 → 19',
             '<b>+1.640 / h</b> Adamant · Energie <b class="neg">−61</b>',
             cost('metal', 100, '88.673') + cost('crystal', 61, '22.168', True) + '<div class="m-req" style="color: var(--orange)">fehlt 8.600 Psikristall</div>',
             '<b>29 min</b>leistbar in 1 h 10', '<span class="m-btn dis">ab 14:30</span>')
        + item('buildings/robotics_factory.svg', 'Servitorenschmiede', 'Stufe 8 → 9',
               'Bauzeit aller Gebäude <b>−10 %</b>',
               cost('metal', 100, '102.400') + cost('crystal', 72, '51.200', True) + cost('deuterium', 100, '25.600') + '<div class="m-req" style="color: var(--orange)">fehlt 14.200 Psikristall</div>',
               '<b>1 h 52</b>leistbar in 2 h 05', '<span class="m-btn dis">ab 15:25</span>'))
    locked = ('<div class="m-it dim"><img class="m-ic" src="' + I + 'buildings/terraformer.svg" alt="" />'
              '<div><div class="m-nm">Weltenschmiede</div><div class="m-req">braucht <b>Machina-Schwarmhalle 1</b> · Machina-Energetik 12 (hast 8)</div></div>'
              '<div></div><div></div><div><span class="m-btn ghost">Weg zeigen</span></div></div>')
    main = ('<div class="m-title"><h1>Bauen</h1><span class="m-crumb">Planet · Aurelia [1:27:8] · Felder 102 / 163</span>'
            '<div class="m-right"><span class="m-chip">Dichte: normal ▾</span></div></div>'
            '<div class="m-tabs"><span class="on">Gebäude<em>3 baubar</em></span><span>Forschung<em>2</em></span>'
            '<span>Schiffsschmiede<em>14</em></span><span>Abwehr<em>9</em></span><span>Rohstoffe</span></div>'
            '<div class="m-chips"><span class="m-chip on">Baubar</span><span class="m-chip">Bald</span><span class="m-chip">Alle</span>'
            '<span class="m-chip">Produktion</span><span class="m-chip">Lager</span><span class="m-chip">Energie</span><span class="m-chip">Ausbau</span>'
            '<span class="m-dim" style="margin-left: auto; font-size: 13px">sortiert: Nutzen · stabil</span></div>'
            '<div class="m-group">JETZT BAUBAR <span>3</span></div><div class="m-list">' + rows_now + '</div>'
            '<div class="m-group">BALD BAUBAR <span>Rohstoffe fehlen, mit Zeitpunkt</span></div><div class="m-list">' + rows_soon + '</div>'
            '<div class="m-group">GESPERRT <span>2 · eingeklappt</span></div><div class="m-list">' + locked + '</div>')
    insp = ('<div class="m-ihead"><img src="' + I + 'buildings/crystal_mine.svg" alt="" /><div><h2>Psikristall-Steinbruch</h2>'
            '<small>Stufe 15 · nächste 16</small></div></div>'
            '<p style="margin: 0 0 8px; font-size: 14px; font-style: italic">Bricht Psikristall ab – wichtig für Elektronik und Forschung.</p>'
            '<div class="m-sect">WAS SICH ÄNDERT</div><div class="m-kv">'
            '<span>Produktion</span><b>27.670 → <span class="up">28.880 / h</span></b>'
            '<span>Energie der Welt</span><b class="down">−120 → −168</b>'
            '<span>Minen laufen mit</span><b class="down">94 % → 92 %</b></div>'
            '<div class="m-note red" style="font-size: 13.5px">Energie reicht nicht. Erst die Sonnenkathedrale 17 bauen, dann läuft alles mit 100 %.</div>'
            '<div class="m-sect">KOSTEN</div>' + cost('metal', 100, '55.340') + cost('crystal', 100, '27.670')
            + '<div class="m-kv"><span>Bauzeit</span><b>22 min 9 s</b><span>fertig</span><b>13:42</b></div>'
            '<div class="m-sect">NÄCHSTE STUFEN (#187)</div><table class="m-mini"><tr><th>Stufe</th><th class="n">Prod./h</th><th class="n">Kosten</th></tr>'
            '<tr><td>16</td><td class="n">28.880</td><td class="n">83 k</td></tr><tr><td>17</td><td class="n">31.400</td><td class="n">133 k</td></tr>'
            '<tr><td>18</td><td class="n">34.100</td><td class="n">212 k</td></tr></table>'
            '<div style="display: flex; gap: 8px; margin-top: 12px"><span class="m-btn big" style="flex: 1">Ausbauen auf 16</span>'
            '<span class="m-btn ghost big">Lexicanum</span></div>')
    phone_list = ('<div style="font: 800 18px var(--head); color: var(--gold); margin-bottom: 6px">Bauen</div>'
                  '<div class="m-chips"><span class="m-chip on">Gebäude</span><span class="m-chip">Forschung</span><span class="m-chip">Werft</span><span class="m-chip">Abwehr</span></div>'
                  '<div class="m-chips"><span class="m-chip on">Baubar</span><span class="m-chip">Bald</span><span class="m-chip">Alle</span></div>'
                  '<div class="m-group">JETZT BAUBAR</div>'
                  + ''.join(f'<div class="m-pit"><img src="{I}buildings/{ic}" alt="" /><div><div class="m-nm">{n}</div><div class="m-sm">{s}</div></div><span class="m-btn">▲ {l}</span></div>'
                            for ic, n, s, l in [('crystal_mine.svg', 'Psikristall-Steinbruch', '+1.210/h · 22 min', 16),
                                                ('crystal_storage.svg', 'Psikristall-Reliquiar', 'Lager +52 k · 41 min', 6),
                                                ('solar_plant.svg', 'Sonnenkathedrale', 'Energie +248 · 18 min', 17)])
                  + '<div class="m-group">BALD BAUBAR</div>'
                  + ''.join(f'<div class="m-pit"><img src="{I}buildings/{ic}" alt="" /><div><div class="m-nm">{n}</div><div class="m-sm" style="color: var(--orange)">{s}</div></div><span class="m-btn dis">{t}</span></div>'
                            for ic, n, s, t in [('metal_mine.svg', 'Adamant-Tiefbohrung', 'fehlt 8.600 Psikristall', '14:30'),
                                                ('robotics_factory.svg', 'Servitorenschmiede', 'fehlt 14.200 Psikristall', '15:25')]))
    sheet = ('<div class="m-ihead"><img src="' + I + 'buildings/crystal_mine.svg" alt="" style="width: 56px; height: 56px" /><div><h2 style="font-size: 16px">Psikristall-Steinbruch</h2><small>15 → 16 · 22 min · fertig 13:42</small></div></div>'
             '<div class="m-kv"><span>Produktion</span><b class="up">+1.210 / h</b><span>Energie</span><b class="down">−48 (Defizit)</b></div>'
             + cost('metal', 100, '55.340') + cost('crystal', 100, '27.670')
             + '<div class="m-note red" style="font-size: 13px">Erst Sonnenkathedrale 17, sonst Minen 92 %.</div>'
             '<span class="m-btn big" style="display: block">Ausbauen auf 16</span>')
    content = (
        '<h2 class="m-h">Heute</h2>'
        + before('desktop-buildings.png', 'phone-buildings.png',
                 'jede Zeile gleich gewichtet mit Bild, Text, Kosten, Energie, Zeit und Knopf; Gesperrtes, Leistbares und Unleistbares sehen gleich aus.')
        + '<h2 class="m-h">Desktop: ein Katalog, nach Zustand gruppiert, mit Inspektor</h2>'
        + desk('Planet', 'Bauen', main, insp, tall=True)
        + '''<div class="m-two" style="margin-top: 12px"><div class="m-ann"><ol>
<li><b>Zeilen bleiben Zeilen</b> (Beschluss D4 von #61 [E]), aber nach Zustand gruppiert: jetzt baubar, bald baubar mit Zeitpunkt, gesperrt eingeklappt (Forge of Empires blendet Unbrauchbares aus; Clash of Clans 2026: eine filterbare Liste).</li>
<li><b>Kosten als Balken</b>: wie viel da ist, was fehlt, ab wann leistbar – statt Zahlenwand.</li>
<li><b>Wirkung in der Zeile</b>: „+1.210 / h“, „Energie −48“, „Lager +52.000“; Details im Inspektor rechts.</li>
<li><b>Inspektor</b> zeigt die Folgen vor dem Klick (Energie, Minen-Prozent) und die nächsten Stufen (#187).</li></ol></div>
<div class="m-ann"><ol start="5"><li><b>Reiter statt Seiten</b>: Gebäude, Forschung, Schiffsschmiede, Abwehr, Rohstoffe in einem Bereich; Zähler zeigen, wo etwas baubar ist.</li>
<li><b>Feste Reihenfolge</b>, Filter werden gemerkt (Forge of Empires und Clash of Clans mussten wechselnde Reihenfolgen nachbessern).</li>
<li><b>Dichte-Schalter</b> normal / kompakt für viele Einträge (EVE „compact mode“).</li>
<li>Schiffe und Abwehr: gleiche Zeile, statt „▲“ ein Mengenfeld mit „max“ und der Bauzeit der Menge.</li></ol></div></div>'''
        + '<h2 class="m-h">Handy: kompakte Zeilen, Details im Blatt</h2><div class="m-row">'
        + phone('Bauen', phone_list) + phone('Bauen', phone_list, sheet, scrim=True)
        + '''<div class="m-ann"><ul><li>Entspricht #189 D2–D4 [E]: ein Tab „Bauen“ mit Umschalter, kompakte Zeile, Filter „Baubar“ als Vorgabe.</li>
<li>Neu: Gruppen „jetzt“ / „bald“ und der Zeitpunkt, ab dem leistbar.</li>
<li>Antippen öffnet das Blatt mit Folgen und Kosten statt die Zeile aufzuklappen.</li></ul></div></div>''')
    return page('Studie – Modern: Bauen',
                'Studie [V] · Gebäude, Forschung, Schiffsschmiede, Abwehr als ein Katalog · Werte sind Beispiele · Styling bleibt [E]',
                content)
