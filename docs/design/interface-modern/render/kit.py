"""Building blocks shared by the four UX studies (proposal only).

Every study arranges these differently; the data is the same everywhere so
the studies can be compared: the player has three worlds, Aurelia builds,
Nox is attacked at 14:32, Vesper receives a transport.
"""
import math

RES = '/icons/resources/small/'
I = '/icons/'

GLYPH = {
    'home': '<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>',
    'planet': '<circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="10" ry="3.5"/>',
    'fleet': '<path d="M3 16l9-11 9 11-9-3z"/><path d="M12 13v7"/>',
    'map': '<circle cx="6" cy="7" r="2"/><circle cx="17" cy="6" r="2"/><circle cx="12" cy="17" r="2"/><path d="M8 8l3 7M15 7l-2 8"/>',
    'reports': '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    'research': '<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/>',
    'people': '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M15 14c3 0 6 1.5 6 5"/>',
    'book': '<path d="M4 5h7v15H4zM13 5h7v15h-7z"/>',
    'gear': '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    'build': '<path d="M4 20h16M6 20V10l6-5 6 5v10"/><path d="M10 20v-5h4v5"/>',
    'chat': '<path d="M4 5h16v11H9l-5 4z"/>',
    'bell': '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>',
    'sword': '<path d="M5 19l4-4M14 4h6v6L9 21l-6-6z"/>',
    'search': '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
    'list': '<path d="M5 6h14M5 12h14M5 18h14"/>',
    'shield': '<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/>',
    'clock': '<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>',
    'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
}


def g(name, size=20):
    return (f'<svg class="k-g" viewBox="0 0 24 24" width="{size}" height="{size}" aria-hidden="true">'
            f'{GLYPH[name]}</svg>')


def ball(kind='normal', n=1, size=28, extra=''):
    return (f'<span class="m-ball" style="display: inline-block; width: {size}px; height: {size}px; background-image: '
            f'url(/planets/{kind}-{n}-surface.svg){extra}"></span>')


def pill(icon, text, cls=''):
    return f'<span class="k-pill {cls}"><img src="{RES}{icon}.svg" alt="" />{text}</span>'


def resline(short=False):
    if short:
        return (pill('metal', '184 k') + pill('crystal', '<span style="color: var(--orange)">92 k</span>')
                + pill('deuterium', '41 k') + pill('energy', '<span class="down">−120</span>'))
    return (pill('metal', '184.003 <span class="m-dim">· voll 6 h</span>')
            + pill('crystal', '92.001 <span style="color: var(--orange)">· voll 1 h 40</span>')
            + pill('deuterium', '41.000 <span class="m-dim">· +1,9 k/h</span>')
            + pill('energy', '<span class="down">−120 · Minen 94 %</span>'))


# ------------------------------------------------------------- catalogue
# (icon, name, level, state, status text) – state: ok, soon, no, lock, run
BUILDINGS = [
    ('buildings/metal_mine.svg', 'Adamant-Tiefbohrung', 18, 'soon', '14:30'),
    ('buildings/crystal_mine.svg', 'Psikristall-Steinbruch', 15, 'run', '22 min'),
    ('buildings/deuterium_synthesizer.svg', 'Promethium-Raffinerie', 12, 'ok', 'baubar'),
    ('buildings/solar_plant.svg', 'Sonnenkathedrale', 16, 'ok', 'baubar'),
    ('buildings/fusion_reactor.svg', 'Fusionssanktum', 0, 'ok', 'baubar'),
    ('buildings/robotics_factory.svg', 'Servitorenschmiede', 8, 'no', 'fehlt 10 k'),
    ('buildings/shipyard.svg', 'Orbitale Schiffsschmiede', 8, 'ok', 'baubar'),
    ('buildings/research_lab.svg', 'Scholarium', 9, 'soon', '15:10'),
    ('buildings/metal_storage.svg', 'Adamant-Gewölbe', 2, 'ok', 'baubar'),
    ('buildings/crystal_storage.svg', 'Psikristall-Reliquiar', 0, 'ok', 'baubar'),
    ('buildings/deuterium_tank.svg', 'Promethium-Zisterne', 1, 'ok', 'baubar'),
    ('buildings/nanite_factory.svg', 'Machina-Schwarmhalle', 0, 'lock', 'Servitoren 10'),
    ('buildings/missile_silo.svg', 'Raketensilo', 0, 'ok', 'baubar'),
    ('buildings/trading_post.svg', 'Handelsposten', 0, 'ok', 'baubar'),
    ('buildings/terraformer.svg', 'Weltenschmiede', 0, 'lock', 'gesperrt'),
    ('buildings/sensor_phalanx.svg', 'Auspex-Phalanx', 0, 'lock', 'nur Mond'),
]


def tile(icon, lvl, state, st, sel=False, show_st=True):
    s = f'<span class="k-st">{st}</span>' if show_st else ''
    lv = f'<span class="k-lv">{lvl}</span>' if lvl else ''
    return (f'<div class="k-tile {state}{" sel" if sel else ""}"><img src="{I}{icon}" alt="" />{lv}{s}</div>')


def grid(cols, size, items=BUILDINGS, sel='Psikristall-Reliquiar', show_st=True):
    tiles = ''.join(tile(i, lv, s, st, n == sel, show_st) for i, n, lv, s, st in items)
    return (f'<div class="k-grid" style="grid-template-columns: repeat({cols}, {size}px)">{tiles}</div>')


def need(icon, value, have=True, miss=''):
    cls = 'have' if have else 'miss'
    right = '✓' if have else f'fehlt {miss}'
    return (f'<div class="k-need {cls}"><img src="{RES}{icon}.svg" alt="" /><span>{value}</span>'
            f'<b style="font-weight: 600">{right}</b></div>')


def info(width=330, small=False):
    """The info page of the compact mode [E]: picture, effect, costs coloured by have / not have, build."""
    pad = 'padding: 10px' if small else ''
    return (f'<div class="k-info" style="width: {width}px; {pad}"><div class="k-ih">'
            f'<img src="{I}buildings/crystal_storage.svg" alt="" /><div><h2>Psikristall-Reliquiar</h2>'
            '<span class="m-dim">Stufe 0 → 1 · Lager</span></div></div>'
            '<div style="font-size: 13.5px; margin-bottom: 6px">Lager für Psikristall <b class="up">+50.000</b> (100.000 → 150.000). '
            'Ohne Ausbau ist das Lager in <b style="color: var(--orange)">1 h 40 min</b> voll.</div>'
            + need('metal', '1.000') + need('crystal', '500')
            + '<div class="m-kv" style="margin: 6px 0"><span>Bauzeit</span><b>4 min</b><span>fertig</span><b>13:24</b></div>'
            '<div style="display: flex; gap: 8px"><span class="m-btn big" style="flex: 1">Bauen</span>'
            '<span class="m-btn ghost big">Lexicanum</span></div></div>')


def info_missing(width=330):
    return (f'<div class="k-info" style="width: {width}px"><div class="k-ih">'
            f'<img src="{I}buildings/robotics_factory.svg" alt="" /><div><h2>Servitorenschmiede</h2>'
            '<span class="m-dim">Stufe 8 → 9 · Bauzeit aller Gebäude −10 %</span></div></div>'
            + need('metal', '102.400') + need('crystal', '30.720') + need('deuterium', '51.200', False, '10.200')
            + '<div class="m-dim" style="font-size: 13px; margin: 6px 0">leistbar um <b style="color: var(--orange)">18:39</b> (in 5 h 19)</div>'
            '<span class="m-btn dis big" style="display: block">Ausbauen ab 18:39</span></div>')


# ------------------------------------------------------------- map
def system_svg(w, h, sel=4, label=True, sun_x=None):
    cx = sun_x if sun_x is not None else w * 0.16
    cy = h * 0.5
    kinds = {3: 'unk', 4: 'enemy', 6: 'guild', 8: 'neutral', 9: 'own', 11: 'neutral', 12: 'unk', 15: 'enemy'}
    names = {4: 'Varn', 6: 'Kessra Prime', 9: 'Vesper', 8: 'Tarsis'}
    step = (w - cx - 40) / 15
    out = [f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" style="display: block">']
    out.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{h * 0.09:.0f}" fill="#f3d36b" opacity="0.9" />'
               f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{h * 0.16:.0f}" fill="#f0a050" opacity="0.12" />')
    for i in range(1, 16):
        r = h * 0.12 + i * step
        a0 = -0.9
        out.append(f'<path d="M {cx + r * math.cos(a0):.1f} {cy + r * math.sin(a0):.1f} A {r:.1f} {r:.1f} 0 0 1 '
                   f'{cx + r * math.cos(-a0):.1f} {cy + r * math.sin(-a0):.1f}" fill="none" stroke="#3b2f22" />')
        ang = -0.7 + i * 0.09
        x, y = cx + r * math.cos(ang), cy + r * math.sin(ang)
        k = kinds.get(i)
        if k == 'own':
            out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="9" fill="#6fb8ff" stroke="#cfefff" />')
        elif k in ('guild', 'enemy'):
            col = '#6fe0a8' if k == 'guild' else '#ee7660'
            out.append(f'<rect x="{x - 7:.1f}" y="{y - 7:.1f}" width="14" height="14" fill="{col}" transform="rotate(45 {x:.1f} {y:.1f})" />')
        elif k == 'neutral':
            out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" fill="#a8997f" />')
        elif k == 'unk':
            out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" fill="none" stroke="#a8997f" stroke-dasharray="3 2" />')
        else:
            out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2" fill="#4b3c2c" />')
        if label and i in names:
            out.append(f'<text x="{x + 12:.1f}" y="{y + 4:.1f}" fill="#e9dfc8" font-size="12" font-family="Georgia">{names[i]}</text>')
        if i == sel:
            out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="16" fill="none" stroke="#f1d27a" stroke-width="2" />')
    out.append('</svg>')
    return ''.join(out)


def galaxy_svg(w, h, route=True):
    """A galaxy level: systems as dots, own systems blue, routes of own fleets."""
    import random
    rnd = random.Random(7)
    out = [f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" style="display: block">']
    cx, cy = w / 2, h / 2
    for i in range(420):
        a = rnd.random() * 6.283
        r = (rnd.random() ** 0.6) * min(w, h) * 0.48
        arm = math.sin(a * 2 + r / 60) * 30
        x, y = cx + (r + arm) * math.cos(a), cy + (r + arm) * math.sin(a) * 0.62
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rnd.choice([1, 1, 1.4, 2])}" fill="#d9c9a8" opacity="{rnd.uniform(0.25, 0.8):.2f}" />')
    pts = {'Aurelia': (cx - 120, cy + 40), 'Nox': (cx - 60, cy + 70), 'Vesper': (cx + 90, cy - 20),
           'Varn': (cx + 150, cy - 50), 'Kessra': (cx + 110, cy - 70)}
    if route:
        out.append(f'<path d="M {pts["Aurelia"][0]} {pts["Aurelia"][1]} Q {cx} {cy - 60} {pts["Vesper"][0]} {pts["Vesper"][1]}" stroke="#9ccb76" stroke-width="2" fill="none" stroke-dasharray="6 4" />')
        out.append(f'<path d="M {pts["Varn"][0]} {pts["Varn"][1]} Q {cx + 40} {cy + 90} {pts["Nox"][0]} {pts["Nox"][1]}" stroke="#ee7660" stroke-width="2" fill="none" stroke-dasharray="6 4" />')
    for n, (x, y) in pts.items():
        col = {'Varn': '#ee7660', 'Kessra': '#6fe0a8'}.get(n, '#6fb8ff')
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="7" fill="{col}" stroke="#120d0a" stroke-width="2" />'
                   f'<text x="{x + 11:.0f}" y="{y + 4:.0f}" fill="#e9dfc8" font-size="13" font-family="Georgia">{n}</text>')
    out.append('</svg>')
    return ''.join(out)


# ------------------------------------------------------------- events
EVENTS = [
    ('red', 'FREMD', 'Angriff auf Nox · Ankunft 14:32', 'in 1 h 12'),
    ('gold', 'BAU', 'Psikristall-Steinbruch 16 fertig 13:42', '22 min'),
    ('green', 'FLOTTE', 'Transport Aurelia → Vesper · 13:50', '30 min'),
    ('blue', 'FORSCHUNG', 'Warp-Antrieb 5 · 16:32', '3 h 12'),
]

OTHERS = [
    ('#ee7660', 'HV', 'Haus Valcor', 'greift Nox an (deine Welt) · Flotte ≥ 8 Schiffe', '13:20'),
    ('#6fe0a8', 'MI', 'Mira (Gilde)', 'schickt 40 Abfangjäger zum Halten nach Nox', '13:25'),
    ('#a8997f', 'LE', 'Leander', 'hat eine Kolonie in System 1:44 gegründet – dein Nachbar', '12:58'),
    ('#d4a537', 'BA', 'Brüderschaft Ashkar', 'steigt auf Platz 2 der Flottenwertung', '11:40'),
    ('#7fd3f5', 'HE', 'Imperialer Herold', 'Schlacht über Gorgonis III · Replay', '09:05'),
]


def feed(items=OTHERS, n=5):
    lis = ''.join(f'<li><span class="k-av" style="background: {c}">{a}</span><div><b>{who}</b> {what}</div><span class="k-t">{t}</span></li>'
                  for c, a, who, what, t in items[:n])
    return f'<ul class="k-feed">{lis}</ul>'


def tag(c, t):
    return f'<span class="m-tag {c}">{t}</span>'


def report_card(width=460):
    def row(name, a, b, pct):
        return (f'<div style="display: grid; grid-template-columns: 110px 1fr 80px; gap: 8px; align-items: center; font-size: 13px; margin: 2px 0">'
                f'<span>{name}</span><div class="m-prog" style="height: 7px"><i style="width: {pct}%; background: var(--red)"></i></div>'
                f'<span class="m-num" style="text-align: right">{a} → <b>{b}</b></span></div>')
    return (f'<div class="k-panel" style="width: {width}px"><div class="k-ph">Kampf · Nox [1:31:4] · Planet<span class="k-x">03:12 · 3 Runden</span></div>'
            '<div class="k-pb">' + tag('green', 'SIEG DER VERTEIDIGUNG') + ' <span class="m-dim">gegen Haus Valcor</span>'
            '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px"><div><div class="m-sect" style="margin-top: 0">ANGREIFER −100 %</div>'
            + row('Abfangjäger', '120', '0', 100) + row('Fregatte', '18', '0', 100) + '</div><div><div class="m-sect" style="margin-top: 0">DU −2 %</div>'
            + row('Raketenbatterie', '120', '112', 7) + row('Lichtlanze', '80', '80', 0) + '</div></div>'
            '<div class="m-kv" style="grid-template-columns: repeat(3, auto auto); margin-top: 6px"><span>Trümmer</span><b>200 k</b><span>Mond</span><b>2 %</b><span>Aufbau</span><b>6 / 8</b></div>'
            '<div style="display: flex; gap: 6px"><span class="m-btn ghost">Runden</span><span class="m-btn ghost">Trümmer bergen</span><span class="m-btn ghost">Replay</span></div></div></div>')


def phone(inner, bg=''):
    return f'<div class="k-phone" style="{bg}">{inner}</div>'


def desk(inner, bg=''):
    return f'<div class="k-desk" style="{bg}">{inner}</div>'


def page(title, cap, content):
    return (
        '<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1" />\n'
        f'<title>{title}</title>\n'
        '<link rel="stylesheet" href="/style.css" />\n'
        '<link rel="stylesheet" href="modern.css" />\n<link rel="stylesheet" href="studies.css" />\n</head>\n<body>\n'
        f'<div class="m-page"><p class="m-cap">{cap}</p>\n{content}\n</div>\n'
        '</body>\n</html>\n')


def steps(desks, phones):
    """desks: list of (id, title, html, caption); phones: list of (html, caption)."""
    out = ['<div id="desk">']
    for sid, title, html, cap in desks:
        out.append(f'<div class="k-step" id="{sid}"><h3>{title}</h3><figure>{html}<figcaption>{cap}</figcaption></figure></div>')
    out.append('</div><h2 class="m-h">Handy</h2><div id="phone" class="k-phones">')
    for html, cap in phones:
        out.append(f'<figure>{html}<figcaption>{cap}</figcaption></figure>')
    out.append('</div>')
    return ''.join(out)
