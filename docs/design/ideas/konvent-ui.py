"""Generate illustrative Nova Imperium Konvent UI studies as animated WebP.

Requires Pillow. Uses the application's four self-hosted WOFF2 files from
src/client/static/fonts/ alongside this script when run locally.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
FONT_ROOT = ROOT if (ROOT / "cinzel-latin-600-normal.woff2").exists() else ROOT.parents[2] / "src/client/static/fonts"
BG, BOX, BOX2, LINE = "#0d0a08", "#1a1411", "#231a14", "#3b2f22"
TXT, DIM, GOLD, HI = "#e9dfc8", "#a8997f", "#d4a537", "#f1d27a"
EMBER, RED, GREEN = "#e08a2a", "#ee7660", "#9ccb76"
AM, CR, PR = "#c9c2b6", "#7fd3f5", "#6fe0a8"

FONT_FILES = {
    "head": "cinzel-latin-600-normal.woff2",
    "strong": "cinzel-latin-800-normal.woff2",
    "body": "eb-garamond-latin-400-normal.woff2",
    "bold": "eb-garamond-latin-600-normal.woff2",
}
FONTS = {}


def font(kind, size):
    key = kind, size
    if key not in FONTS:
        FONTS[key] = ImageFont.truetype(str(FONT_ROOT / FONT_FILES[kind]), size)
    return FONTS[key]


def panel(d, xy, fill=BOX, border=LINE, radius=6, width=1):
    d.rounded_rectangle(xy, radius=radius, fill=fill, outline=border, width=width)


def line(d, xy, color=LINE, width=1):
    d.line(xy, fill=color, width=width)


def text(d, xy, s, size=22, color=TXT, kind="body", anchor=None):
    d.text(xy, s, font=font(kind, size), fill=color, anchor=anchor)


def wrap(d, s, max_width, size=22, kind="body"):
    result, current = [], ""
    for word in s.split():
        candidate = (current + " " + word).strip()
        if current and d.textlength(candidate, font=font(kind, size)) > max_width:
            result.append(current)
            current = word
        else:
            current = candidate
    if current:
        result.append(current)
    return result


def paragraph(d, x, y, s, width, size=22, color=TXT, spacing=27, kind="body"):
    for row in wrap(d, s, width, size, kind):
        text(d, (x, y), row, size, color, kind)
        y += spacing
    return y


def button(d, xy, title, active=True, red=False, size=14):
    x0, y0, x1, y1 = xy
    fill = "#7c241b" if red else ("#b8842a" if active else BOX2)
    top = "#c2392a" if red else ("#f1d27a" if active else LINE)
    panel(d, xy, fill, "#6c4811" if active else LINE, 4, 1)
    d.rectangle((x0+2, y0+2, x1-2, y0+5), fill=top)
    text(d, ((x0+x1)//2, (y0+y1)//2 + 1), title, size,
         "#fff" if red else ("#1a1206" if active else DIM), "head", "mm")


def meter(d, xy, fraction, color=EMBER):
    x0, y0, x1, y1 = xy
    panel(d, xy, BOX2, LINE, 5)
    w = max(0, round((x1-x0-2)*fraction))
    if w:
        d.rounded_rectangle((x0+1, y0+1, x0+1+w, y1-1), radius=4, fill=color)


def box_title(d, xy, title):
    panel(d, xy)
    x0, y0, x1, _ = xy
    line(d, (x0, y0+44, x1, y0+44))
    text(d, (x0+16, y0+13), title, 16, GOLD, "head")


def shell(d, mobile, view):
    w, h = d.im.size
    d.rectangle((0, 0, w, h), fill=BG)
    d.ellipse((-w//2, -h//2, w*3//2, h//2), fill="#20150f")
    d.rectangle((0, 0, w, 106 if mobile else 95), fill="#160f0b")
    line(d, (0, 105 if mobile else 94, w, 105 if mobile else 94))
    if mobile:
        text(d, (18, 10), "NOVA IMPERIUM", 21, GOLD, "strong")
        text(d, (460, 13), "STUDIE [V]", 10, DIM, "head", "ra")
        text(d, (19, 38), "Classic Universum · Heimatplanet", 17, DIM)
        chips = [("ADAMANT", "32.400", AM), ("PSIKRISTALL", "14.800", CR),
                 ("PROMETHIUM", "6.200", PR)]
        for i, (name, value, col) in enumerate(chips):
            x = 18+i*153
            panel(d, (x, 66, x+145, 99))
            d.ellipse((x+8, 77, x+18, 87), fill=col)
            text(d, (x+24, 74), value, 18, TXT, "bold")
        d.rectangle((0, h-72, w, h), fill="#160f0b")
        line(d, (0, h-72, w, h-72))
        for i, name in enumerate(["Übersicht", "Bauen", "Flotte", "Mehr"]):
            x = 5+i*119
            if name == "Mehr":
                panel(d, (x+3,h-66,x+114,h-8),BOX2,GOLD)
            text(d, (x+58,h-38), name, 12, HI if name == "Mehr" else TXT, "head", "mm")
        return 18, 116, w-36, h-202
    text(d, (22, 10), "NOVA IMPERIUM", 25, GOLD, "strong")
    text(d, (24, 46), "Classic Universum", 18, DIM)
    text(d, (320, 31), "Heimatplanet · Kommandant A", 20, DIM)
    for i, (name, value, col) in enumerate([("ADAMANT", "32.400", AM),
                                             ("PSIKRISTALL", "14.800", CR),
                                             ("PROMETHIUM", "6.200", PR)]):
        x = 745+i*165
        panel(d, (x, 19, x+155, 72))
        d.ellipse((x+9, 37, x+25, 53), fill=col)
        text(d, (x+32, 24), name, 11, DIM, "head")
        text(d, (x+32, 40), value, 21, TXT, "bold")
    d.rectangle((0, 95, 205, h), fill="#100c09")
    line(d, (205,95,205,h))
    items = ["Übersicht", "Gebäude", "Forschung", "Schiffe", "Sternenkarte", "Konvent", "Gilde", "Mehr"]
    for i, item in enumerate(items):
        yy = 122+i*49
        if item == "Konvent" and view != "admin":
            panel(d, (12, yy-4, 193, yy+36), BOX2, GOLD)
        if item == "Mehr" and view == "admin":
            panel(d, (12, yy-4, 193, yy+36), BOX2, GOLD)
        text(d, (25, yy+6), item, 15, HI if (item == "Konvent" and view != "admin") or (item == "Mehr" and view == "admin") else TXT, "head")
    return 230, 116, 1028, h-146


def title(d, x, y, w, label, status, mobile):
    text(d, (x, y), label, 22 if mobile else 26, GOLD, "strong")
    line(d, (x,y+38,x+w,y+38))
    text(d, (x, y+49), status, 18 if mobile else 20, DIM)
    return y+87


def convening(d, x, y, w, h, mobile, passed):
    box_title(d, (x,y,x+w,y+h), "EINBERUFUNG · SPIELERABSTIMMUNG")
    px=x+18; inner=w-36
    text(d,(px,y+61),"Soll ein Konvent stattfinden?",23 if mobile else 29,HI,"bold")
    yy=paragraph(d,px,y+101,"Jede berechtigte Person hat genau eine Stimme. Einzahlungen spielen hier noch keine Rolle.",inner,19 if mobile else 22,DIM,25)
    yy+=19
    meter(d,(px,yy,px+inner,yy+15), 4/6 if passed else 2/6, GOLD)
    text(d,(px,yy+24),"4 Ja · 2 Nein · Quorum erfüllt" if passed else "2 Ja · 1 Nein · Abstimmung läuft",19,GREEN if passed else DIM,"bold")
    yy+=72
    button(d,(px,yy,px+min(190,(inner-12)//2),yy+46),"JA",not passed)
    button(d,(px+min(190,(inner-12)//2)+12,yy,px+min(392,inner),yy+46),"NEIN",False)
    if not mobile:
        text(d,(px, y+h-36),"Nach erfolgreicher Abstimmung beginnt die Finanzierung.",21,DIM)


def edict(d, x, y, w, h, mobile, funded):
    box_title(d,(x,y,x+w,y+h),"AKTUELLES DEKRET")
    px=x+18; inner=w-36
    text(d,(px,y+60),"FÖRDERDEKRET",20 if mobile else 23,HI,"head")
    text(d,(px,y+96),"Positiv · +5 % Produktion für 12 Stunden",19 if mobile else 21,GREEN,"bold")
    yy=paragraph(d,px,y+131,"Der Empfänger wird erst nach der Finanzierung gewählt. Die Wirkung beginnt nach der Abstimmung.",inner,18 if mobile else 21,DIM,24)
    if not mobile:
        text(d,(px,y+h-72),"Mögliche Ziele: alle aktiven Spieler",19,DIM)
        text(d,(px,y+h-42),"Beispielwerte · keine beschlossenen Spielregeln",18,EMBER)


def funding(d, x, y, w, h, mobile, amount):
    box_title(d,(x,y,x+w,y+h),"GEMEINSAM FINANZIEREN")
    px=x+18; inner=w-36
    text(d,(px,y+58),f"{amount} / 600 Wertpunkte",22 if mobile else 28,HI,"bold")
    meter(d,(px,y+98,px+inner,y+114),amount/600,EMBER)
    text(d,(px,y+132),"A: 300   B: 200   C: 100" if amount==600 else
         ("A: 300   B: 200" if amount==500 else ("A: 300" if amount else "Noch keine Einzahlungen")),
         19 if mobile else 22,DIM)
    if mobile:
        if amount < 600:
            text(d,(px,y+160),"Deine Einzahlung",19,HI,"bold")
            for i,(name,col) in enumerate([("Adamant",AM),("Psikristall",CR),("Promethium",PR)]):
                yy=y+190+i*40
                text(d,(px,yy),name,19,col)
                panel(d,(px+inner-120,yy-4,px+inner,yy+28),"#120d0a")
                text(d,(px+inner-106,yy),"300" if i==0 and amount==0 else "0",19,TXT)
            text(d,(px,y+306),"Dein Anteil nach Zahlung: 50 %",17,GREEN if amount==0 else DIM)
        else:
            text(d,(px,y+178),"Finanziert · Zielwahl eröffnet",20,GREEN,"bold")
            text(d,(px,y+221),"Dein Beitrag: 300 Adamant",18,DIM)
            text(d,(px,y+257),"Dein Stimmanteil: 50 %",19,HI,"bold")
        button(d,(px,y+h-57,px+inner,y+h-10),"EINZAHLEN" if amount<600 else "ZIELWAHL ANSEHEN",True)
    else:
        if amount < 600:
            text(d,(px,y+180),"Deine Einzahlung",20,HI,"bold")
            for i,(name,col) in enumerate([("Adamant",AM),("Psikristall",CR),("Promethium",PR)]):
                yy=y+216+i*51
                text(d,(px,yy),name,20,col)
                panel(d,(px+inner-158,yy-5,px+inner,yy+32),"#120d0a")
                text(d,(px+inner-142,yy),"300" if i==0 and amount==0 else "0",20,TXT)
            text(d,(px,y+h-102),"Voraussichtlicher Stimmanteil: 50 %",19,GREEN if amount==0 else DIM)
        else:
            text(d,(px,y+198),"Finanziert · Zielwahl eröffnet",24,GREEN,"bold")
            text(d,(px,y+253),"Dein Beitrag: 300 Adamant",21,DIM)
            text(d,(px,y+295),"Dein Stimmanteil: 50 %",21,HI,"bold")
        button(d,(px,y+h-71,px+inner,y+h-17),"EINZAHLEN" if amount<600 else "ZIELWAHL ANSEHEN",True)


def ballot(d,x,y,w,h,mobile,partial):
    box_title(d,(x,y,x+w,y+h),"ZIELWAHL · STIMMEN NACH EINZAHLUNG")
    px=x+18; inner=w-36
    text(d,(px,y+57),"Wem soll das Dekret gelten?",22 if mobile else 27,HI,"bold")
    text(d,(px,y+96),"Dein Anteil: 300 von 600 · 50 %",19 if mobile else 22,GREEN,"bold")
    rows=[("Lea",300 if partial else 400,GREEN),("Max",0 if partial else 200,EMBER),("Keine Vergabe",0,DIM)]
    yy=y+145
    for name,v,col in rows:
        panel(d,(px,yy,px+inner,yy+(85 if mobile else 96)), BOX2, GOLD if name=="Lea" else LINE)
        text(d,(px+15,yy+9),name,22 if mobile else 24,HI if name=="Lea" else TXT,"bold")
        text(d,(px+inner-17,yy+13),f"{v} Stimmen",19,col,"bold","ra")
        meter(d,(px+15,yy+48,px+inner-15,yy+62),v/600,col)
        yy+=98 if mobile else 111
    text(d,(px,yy+4),"Stimme bis zum Fristende änderbar.",18,DIM)
    button(d,(px, y+h-68, px+inner, y+h-18),"STIMME ABGEBEN" if partial else "STIMME ÄNDERN",True)


def receipt(d,x,y,w,h,mobile):
    box_title(d,(x,y,x+w,y+h),"BESCHLUSS · ABGESCHLOSSEN")
    px=x+18; inner=w-36
    text(d,(px,y+60),"Lea erhält das Förderdekret",23 if mobile else 31,HI,"bold")
    text(d,(px,y+110),"400 : 200 Stimmen",23,GREEN,"bold")
    meter(d,(px,y+151,px+inner,y+168),2/3,GREEN)
    paragraph(d,px,y+205,"+5 % Produktion auf allen Planeten von Lea · 12 Stunden ab Beschluss.",inner,20 if mobile else 23,TXT,29)
    if mobile:
        text(d,(px,y+294),"A: 300 · B: 200 · C: 100",18,DIM)
        text(d,(px,y+330),"Dein Beitrag: 300 Adamant",18,DIM)
        text(d,(px,y+366),"Wirkung endet: in 12 Stunden",18,EMBER)
    else:
        text(d,(px,y+h-111),"Beiträge: A 300 · B 200 · C 100",21,DIM)
        text(d,(px,y+h-73),"Wirkung endet: in 12 Stunden",21,EMBER)


def admin(d,x,y,w,h,mobile):
    box_title(d,(x,y,x+w,y+h),"ADMIN · KONVENT DER RUNDE")
    px=x+18; inner=w-36
    rows=[("Modus", "Spieler stimmen ab"),("Abstimmungsdauer", "24 Stunden"),
          ("Erneuter Versuch", "72 Stunden"),("Einzahlungsfrist", "24 Stunden"),
          ("Zielwahl", "12 Stunden"),("Quorum", "50 %")]
    yy=y+62
    for a,b in rows:
        text(d,(px,yy),a,17 if mobile else 21,DIM)
        text(d,(px+inner,yy),b,17 if mobile else 21,HI,"bold","ra")
        line(d,(px,yy+29,px+inner,yy+29))
        yy+=47 if mobile else 52
    text(d,(px,yy+13),"Erlasse dieser Runde",18 if mobile else 22,GOLD,"head")
    for row, entries in enumerate([[("Förderdekret",True),("Rohstoffprüfung",True)],
                                   [("Schutzmandat",False),("Werftauflage",False)]]):
        for col, (name, checked) in enumerate(entries):
            cx=px+col*inner//2
            cy=yy+52+row*36
            panel(d,(cx,cy+4,cx+18,cy+22),BOX2,GOLD)
            if checked:
                line(d,(cx+4,cy+13,cx+8,cy+17,cx+15,cy+8),GOLD,2)
            text(d,(cx+26,cy),name,17 if mobile else 21,TXT)
    if not mobile:
        text(d,(px,yy+145),"Gültige Konvente behalten ihre eingefrorenen Werte.",21,DIM)
    button(d,(px,y+h-67,px+inner,y+h-17),"RUNDENEINSTELLUNGEN SPEICHERN",True, size=11 if mobile else 14)


def render(view, mobile=False, progress=0):
    size=(480,900) if mobile else (1280,800)
    im=Image.new("RGB",size,BG)
    d=ImageDraw.Draw(im)
    x,y,w,h=shell(d,mobile,view)
    statuses={"conv":"Einberufung · endet in 18:25 h","fund":"Finanzierung · endet in 23:10 h",
              "modal":"Finanzierung · Einzahlung bestätigen","vote":"Zielwahl · endet in 11:58 h",
              "result":"Beschluss · Wirkung aktiv","admin":"Rundeneinstellungen · Vorschau"}
    y=title(d,x,y,w,"KONVENT" if view!="admin" else "ADMIN · KONVENT",statuses[view],mobile)
    if view=="conv":
        convening(d,x,y,w,min(h-100,530),mobile,bool(progress))
    elif view in ("fund","modal"):
        if mobile:
            edict(d,x,y,w,205,mobile,progress)
            funding(d,x,y+219,w,390,mobile,progress)
        else:
            edict(d,x,y,w*0.48,h-110,mobile,progress)
            funding(d,x+w*0.50,y,w*0.50,h-110,mobile,progress)
        if view=="modal":
            veil=Image.new("RGBA",size,(0,0,0,125))
            im=Image.alpha_composite(im.convert("RGBA"),veil).convert("RGB")
            d=ImageDraw.Draw(im)
            bx=(30,303,450,655) if mobile else (410,212,1030,610)
            panel(d,bx,BOX,"#7c612f",8,2)
            xx,yy,rr,bb=bx
            text(d,(xx+20,yy+21),"EINZAHLUNG BESTÄTIGEN",17 if mobile else 22,GOLD,"head")
            line(d,(xx,yy+62,rr,yy+62))
            text(d,(xx+20,yy+87),"300 Adamant = 300 Wertpunkte",20 if mobile else 25,HI,"bold")
            text(d,(xx+20,yy+132),"Dein Stimmanteil: 50 %",21,GREEN,"bold")
            paragraph(d,xx+20,yy+179,"Die Ressourcen bleiben bis zur Entscheidung gebunden. Bei einem gescheiterten Konvent werden sie erstattet.",rr-xx-40,19 if mobile else 23,DIM,27)
            button(d,(xx+20,bb-75,rr-20,bb-20),"VERBINDLICH EINZAHLEN",True,size=12 if mobile else 15)
    elif view=="vote":
        ballot(d,x,y,w,min(h-100,565),mobile,progress==1)
    elif view=="result":
        receipt(d,x,y,w,min(h-100,540),mobile)
    elif view=="admin":
        admin(d,x,y,w,min(h-100,580),mobile)
    if not mobile:
        text(d,(x,size[1]-29),"DESIGNSTUDIE [V] · BEISPIELWERTE",13,DIM,"head")
    return im


STAGES=[("conv",0,1400),("conv",1,1100),("fund",0,1200),("modal",0,1700),
        ("fund",300,1000),("fund",500,1000),("fund",600,1200),
        ("vote",1,1500),("vote",2,1700),("result",0,2100),("admin",0,1800)]

for mobile, name in [(False,"konvent-desktop.webp"),(True,"konvent-mobile.webp")]:
    frames=[render(stage,mobile,amount) for stage,amount,_ in STAGES]
    frames[0].save(ROOT/name,format="WEBP",save_all=True,append_images=frames[1:],
                   duration=[duration for _,_,duration in STAGES],loop=0,quality=84,method=6)
    print(name,(ROOT/name).stat().st_size,"bytes",len(frames),"frames")
    frames[6].save(ROOT/("preview-mobile.png" if mobile else "preview-desktop.png"))
