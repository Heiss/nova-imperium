"""Shared frames of the UX study „Modern“: desktop shell and phone shell.

Proposal only. The pages in build.py call desk() and phone() so the header,
the navigation and the phone frame are the same on every page.
"""

RES = '/icons/resources/small/'

GLYPH = {
    'home': '<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>',
    'planet': '<circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="10" ry="3.5"/>',
    'fleet': '<path d="M3 16l9-11 9 11-9-3z"/><path d="M12 13v7"/>',
    'map': '<circle cx="6" cy="7" r="2"/><circle cx="17" cy="6" r="2"/><circle cx="12" cy="17" r="2"/><path d="M8 8l3 7M15 7l-2 8"/>',
    'reports': '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    'empire': '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M9 11l6.5-3M9 13l6 3"/>',
    'people': '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M15 14c3 0 6 1.5 6 5"/>',
    'book': '<path d="M4 5h7v15H4zM13 5h7v15h-7z"/>',
    'gear': '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    'build': '<path d="M4 20h16M6 20V10l6-5 6 5v10"/><path d="M10 20v-5h4v5"/>',
    'more': '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    'bell': '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>',
}


def g(name, size=18):
    return (f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" '
            f'aria-hidden="true">{GLYPH[name]}</svg>')


def ball(kind='normal', n=0, cls=''):
    return (f'<span class="m-ball {cls}" style="background-image: '
            f'url(/planets/{kind}-{n}-surface.svg)"></span>')


def res(icon, value, fill, note, hot=False):
    h = ' hot' if hot else ''
    return (f'<div class="m-r"><img src="{RES}{icon}.svg" alt="" />'
            f'<b>{value}</b><div class="m-fill{h}"><i style="width: {fill}%"></i></div>'
            f'<small class="{h.strip()}">{note}</small></div>')


RES_DESK = (res('metal', '184.003', 71, 'voll in 6 h 10 min')
            + res('crystal', '92.001', 88, 'voll in 1 h 40 min', True)
            + res('deuterium', '41.000', 34, '+1.920 / h')
            + '<div class="m-r"><img src="' + RES + 'energy.svg" alt="" />'
            '<b class="down">−120</b><small class="hot">Energie fehlt: Minen 94 %</small></div>')

HUBS = [
    ('home', 'Übersicht', None, []),
    ('planet', 'Planet', None, ['Bauen', 'Rohstoffe']),
    ('fleet', 'Flotte', None, ['Versenden', 'Bewegungen', 'Vorlagen']),
    ('map', 'Sternenkarte', None, []),
    ('reports', 'Berichte', '7', ['Seit deinem Besuch', 'Kämpfe', 'Spionage', 'Nachrichten']),
    ('empire', 'Imperium', None, ['Kolonien', 'Erfolge']),
    ('people', 'Gemeinschaft', None, ['Rangliste', 'Gilde', 'Freunde', 'Imperialer Herold']),
]
FOOT = [('book', 'Lexicanum'), ('gear', 'Optionen')]


def rail(active, sub, queue=True):
    out = ['<div class="m-rail">']
    for glyph, name, cnt, subs in HUBS:
        on = ' on' if name == active else ''
        c = f'<span class="m-cnt">{cnt}</span>' if cnt else ''
        out.append(f'<div class="m-hub{on}">{g(glyph)}{name}{c}</div>')
        if name == active:
            for s in subs:
                son = ' on' if s == sub else ''
                out.append(f'<div class="m-sub{son}">{s}</div>')
    out.append('<div class="m-railsep"></div>')
    for glyph, name in FOOT:
        on = ' on' if name == active else ''
        out.append(f'<div class="m-hub{on}">{g(glyph)}{name}</div>')
    if queue:
        out.append(
            '<div class="m-queue"><div class="m-qh">LÄUFT AUF AURELIA</div>'
            '<div class="m-q">Psikristall-Steinbruch 16<span>22 min</span></div>'
            '<div class="m-prog"><i style="width: 64%"></i></div>'
            '<div class="m-q">Warp-Antrieb 5<span>3 h 12 min</span></div>'
            '<div class="m-prog"><i style="width: 18%"></i></div>'
            '<div class="m-q">12 Fregatten<span>1 h 05 min</span></div>'
            '<div class="m-prog"><i style="width: 40%"></i></div></div>')
    out.append('</div>')
    return ''.join(out)


def top():
    return ('<div class="m-top"><div class="m-logo">NOVA IMPERIUM</div>'
            '<div class="m-planet">' + ball('normal', 1)
            + '<div><b>Aurelia</b> <small>[1:27:8] ▾</small><br />'
            '<small><span class="m-dot warn"></span> Lager fast voll · 3 Welten</small></div></div>'
            '<div class="m-res">' + RES_DESK + '</div>'
            '<div class="m-tools"><div class="m-bell">' + g('bell')
            + '<i>7</i></div><div class="m-mode"><span class="on">Modern</span>'
            '<span>Classic</span></div></div></div>')


def desk(active, sub, main, insp=None, queue=True, tall=False):
    cls = ' tall' if tall else ''
    body = 'm-body insp' if insp else 'm-body'
    i = f'<div class="m-insp">{insp}</div>' if insp else ''
    return (f'<div class="m-desk{cls}">{top()}{rail(active, sub, queue)}'
            f'<div class="{body}"><div class="m-main">{main}</div>{i}</div></div>')


TABS = [('home', 'Übersicht'), ('build', 'Bauen'), ('fleet', 'Flotte'),
        ('map', 'Karte'), ('more', 'Mehr')]


def phone(tab, body, sheet=None, scrim=False):
    tabs = ''.join(
        f'<span class="{"on" if n == tab else ""}">{g(gl, 22)}{n}</span>'
        for gl, n in TABS)
    sh = ''
    if sheet:
        sh = ('<div class="m-scrim"></div>' if scrim else '') + \
            f'<div class="m-sheet">{sheet}</div>'
    return (
        '<div class="m-phone"><div class="m-ptop"><div class="m-prow">'
        '<div class="m-planet">' + ball('normal', 1)
        + '<div><b>Aurelia</b> <small>▾</small></div></div>'
        '<span style="margin-left: auto"></span><div class="m-bell">'
        + g('bell') + '<i>7</i></div></div><div class="m-pres">'
        + res('metal', '184.003', 71, '6 h')
        + res('crystal', '92.001', 88, '1 h 40', True)
        + res('deuterium', '41.000', 34, '+1.920/h')
        + '</div></div>'
        f'<div class="m-pbody">{body}{sh}</div>'
        f'<div class="m-tabbar">{tabs}</div></div>')


def page(title, cap, content):
    return (
        '<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1" />\n'
        f'<title>{title}</title>\n'
        '<link rel="stylesheet" href="/style.css" />\n'
        '<link rel="stylesheet" href="modern.css" />\n</head>\n<body>\n'
        f'<div class="m-page"><p class="m-cap">{cap}</p>\n{content}\n</div>\n'
        '</body>\n</html>\n')


def before(desk_png, phone_png, text):
    return (
        '<div class="m-before"><figure><img src="before/' + desk_png
        + '" alt="Heute auf dem Desktop" /><figcaption>Heute (main, Desktop): '
        + text + '</figcaption></figure><figure style="display: flex; gap: 12px">'
        '<img src="before/' + phone_png + '" alt="Heute auf dem Handy" '
        'style="width: 180px; flex: none" /><figcaption>Heute (main, Handy 390 px). '
        'Aufgenommen am 2026-11-23 mit Testdaten.</figcaption></figure></div>')
