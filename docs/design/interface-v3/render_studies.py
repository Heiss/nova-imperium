"""Render proposal artboards and WebP storyboards, not gameplay recordings.
Run from repository root with Pillow, fontTools and Node sharp available.
No server, credentials or player data are used. All values are illustrative.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from fontTools.ttLib import TTFont
import math, random, io, subprocess, json

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).parent/'screenshots'
CACHE=Path('/tmp/nova-v3-render')
CACHE.mkdir(exist_ok=True); OUT.mkdir(exist_ok=True)
# Reuse the application's original artwork and heading font.
for name in ['cinzel-latin-600-normal','eb-garamond-latin-400-normal']:
    target=CACHE/f'{name}.ttf'
    if not target.exists():
        f=TTFont(ROOT/f'src/client/static/fonts/{name}.woff2');f.flavor=None;f.save(target)
script="""const fs=require('fs'),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp');(async()=>{for(const d of ['buildings','ships','resources'])for(const f of fs.readdirSync('src/client/static/icons/'+d)){if(f.endsWith('.svg'))await sharp('src/client/static/icons/'+d+'/'+f).resize(256,256).png().toFile('/tmp/nova-v3-render/'+f.replace('.svg','.png'));}for(const f of ['normal-0-surface','normal-0-clouds'])await sharp('src/client/static/planets/'+f+'.svg').resize(1024,512,{fit:'fill'}).png().toFile('/tmp/nova-v3-render/'+f+'.png');})()"""
subprocess.run(['node','-e',script],cwd=ROOT,check=True)
GOLD='#e4bb69'; TXT='#f2e8d4'; DIM='#b8b1a3'; LINE='#3f3930'; BG='#101214'; PANEL='#191c1e'; RED='#ff8d79'; BLUE='#89c9e3'; GREEN='#a9d39b'; ORANGE='#efb96e'
FONTS={}
def font(n=18,bold=False,serif=False):
    key=(n,bold,serif)
    if key not in FONTS:FONTS[key]=ImageFont.truetype(str(CACHE/'cinzel-latin-600-normal.ttf') if serif else '/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf',n)
    return FONTS[key]
class Board:
    def __init__(self,w=1440,h=1000,bg=BG):
        self.im=Image.new('RGB',(w,h),bg);self.d=ImageDraw.Draw(self.im);self.w=w;self.h=h;self.classic=False
    def rect(self,x,y,w,h,fill=PANEL,stroke=LINE,r=12,width=1):
        if self.classic:
            fill={PANEL:'#1a1411','#202426':'#231a14','#161718':'#0d0a08'}.get(fill,fill)
            stroke='#3b2f22' if stroke==LINE else stroke
        self.d.rounded_rectangle((x,y,x+w,y+h),radius=r,fill=fill,outline=stroke,width=width)
    def text(self,x,y,s,n=18,c=TXT,b=False,serif=False):
        if self.classic:s=s.replace('→','>').replace('▾','v').replace('✓','OK')
        f=ImageFont.truetype(str(CACHE/'eb-garamond-latin-400-normal.ttf'),n+2) if self.classic and not serif else font(n,b,serif)
        self.d.text((x,y),s,font=f,fill=c)
    def wrap(self,x,y,s,width,n=18,c=DIM,line=1.45):
        yy=y;row=''
        for word in s.split():
            if self.d.textlength(row+' '+word,font=font(n))>width and row:self.text(x,yy,row,n,c);yy+=n*line;row=word
            else:row=(row+' '+word).strip()
        self.text(x,yy,row,n,c);return yy+n*line
    def button(self,x,y,w,s,primary=False,h=44):
        self.rect(x,y,w,h,GOLD if primary else '#202426',GOLD if primary else LINE,7)
        self.text(x+14,y+(h-20)/2-2,s,16,'#151310' if primary else TXT,True)
    def pill(self,x,y,s,c=GOLD):
        w=int(self.d.textlength(s,font=font(13,True)))+20
        self.rect(x,y,w,26,'#242728',c,13);self.text(x+10,y+4,s,13,c,True);return w
    def line(self,x,y,x2,y2,c=LINE,width=1):self.d.line((x,y,x2,y2),fill=c,width=width)
    def bar(self,x,y,w,p,c=GOLD):
        self.rect(x,y,w,6,'#303335',None,3);self.rect(x,y,max(6,w*p),6,c,None,3)
    def icon(self,name,x,y,size=76):
        p=CACHE/(name+'.png')
        if p.exists():
            im=Image.open(p).convert('RGBA').resize((size,size),Image.Resampling.LANCZOS);self.im.paste(im,(int(x),int(y)),im)
    def planet(self,x,y,r=90):
        # Project the original normal-planet texture into a shaded sphere.
        size=int(r*2);tex=Image.open(CACHE/'normal-0-surface.png').convert('RGB');pix=tex.load();out=Image.new('RGBA',(size,size));op=out.load()
        for yy in range(size):
            sy=(yy-r)/r
            for xx in range(size):
                sx=(xx-r)/r;q=sx*sx+sy*sy
                if q>1:continue
                z=math.sqrt(1-q);u=int((math.atan2(sx,z)/(2*math.pi)+.5)*tex.width)%tex.width;v=min(tex.height-1,int((math.asin(sy)/math.pi+.5)*tex.height));rgb=pix[u,v];light=max(.12,min(1,.45+.65*(-sx*.7-sy*.4+z*.7)));op[xx,yy]=tuple(int(v*light) for v in rgb)+(255,)
        glow=Image.new('RGBA',self.im.size);gd=ImageDraw.Draw(glow);gd.ellipse((x-r-3,y-r-3,x+r+3,y+r+3),fill=(88,150,180,70));glow=glow.filter(ImageFilter.GaussianBlur(10));self.im=Image.alpha_composite(self.im.convert('RGBA'),glow).convert('RGB');self.im.paste(out,(int(x-r),int(y-r)),out);self.d=ImageDraw.Draw(self.im)
    def footer(self,s='Designstudie [V] · Beispieldaten · keine Implementierung'):
        self.line(24,self.h-35,self.w-24,self.h-35);self.text(26,self.h-26,s,12,DIM)
    def save(self,name):self.im.save(OUT/(name+'.webp'),quality=85,method=6)

def stars(b,x,y,w,h,seed=5):
    rng=random.Random(seed)
    for _ in range(int(w*h/3500)):
        xx=x+rng.randrange(max(1,int(w)));yy=y+rng.randrange(max(1,int(h)));r=rng.choice([1,1,1,2]);b.d.ellipse((xx,yy,xx+r,yy+r),fill=rng.choice(['#464744','#5e594b','#686457']))

def shell(b,variant='A',title='Kommandobrücke',active='Übersicht',classic=False,path=None):
    b.rect(0,0,b.w,82,'#181715',None,0);b.text(28,20,'NOVA IMPERIUM',24,GOLD,serif=True)
    b.text(30,53,'DER ORDEN DER STERNENWACHT',10,DIM)
    b.button(b.w-305,20,130,'Modern',not classic)
    b.button(b.w-165,20,135,'Classic',classic)
    for i,(s,v,c) in enumerate([('Adamant','128.450',TXT),('Psikristall','64.230',BLUE),('Promethium','18.900',GREEN),('Energie','+240',ORANGE)]):
        xx=360+i*168;b.text(xx,18,s,12,DIM);b.text(xx,40,v,21,c,True)
    b.rect(0,82,218,b.h-82,'#161718',None,0)
    b.text(24,105,'AKTIVE KOLONIE',11,DIM,True);b.text(24,128,'Aurelia  [1:27:8]',17,GOLD,True)
    b.text(24,163,'3 Kolonien · 1 Mond',13,DIM)
    entries=[('Übersicht','01'),('Kolonien','02'),('Ausbau & Forschung','03'),('Flotten','04'),('Sternenkarte','05'),('Bodenkampf','06'),('Gilde','07'),('Berichte','08')]
    if classic:entries=[(s,str(i+1).zfill(2)) for i,s in enumerate(['Übersicht','Gebäude','Rohstoffe','Forschung','Schiffsschmiede','Verteidigung','Flotten','Sternenkarte','Bodenkampf','Berichte','Gilden'])]
    for i,(s,v) in enumerate(entries):
        yy=216+i*(40 if classic else 49)
        if s==active:b.rect(12,yy-7,194,44,'#343026',None,6)
        b.text(24,yy,v,12,GOLD);b.text(54,yy,s,15,TXT if s==active else DIM,s==active)
    b.line(24,644,192,644);b.text(24,669,'Belohnungen  ·  2 bereit',13,GREEN);b.text(24,709,'Hilfe & Optionen',14,DIM)
    b.text(24,b.h-82,'STUDIE '+variant,11,GOLD,True)
    b.text(250,106,title,29,GOLD,serif=True)
    b.text(251,149,path or 'Universum 1  /  Galaxie 1  /  System 27',13,DIM)

def block(b,x,y,w,title,sub=None,h=180):
    b.rect(x,y,w,h);b.text(x+22,y+17,title,19,TXT,True)
    if sub:b.text(x+22,y+50,sub,14,DIM)

def event(b,x,y,when,title,sub,c=GOLD):
    b.d.ellipse((x,y+6,x+9,y+15),fill=c);b.text(x+22,y,when,13,c,True);b.text(x+115,y,title,16,TXT,True);b.text(x+115,y+26,sub,14,DIM)

def bridge():
    b=Board();shell(b)
    b.pill(1155,111,'Synchronisiert · jetzt',GREEN)
    b.rect(250,192,1158,95,'#30231f','#815448',10)
    b.text(272,209,'!  Varn braucht deinen Befehl',22,TXT,True)
    b.text(272,246,'Belagerung · 3 Befehle geplant · Rückmeldung bis 20:37',16,DIM)
    b.button(1170,215,215,'Bodenkampf öffnen',True)
    b.rect(250,309,710,283,'#1c2021')
    b.text(276,331,'Willkommen zurück, Kommandant.',27,TXT,True)
    b.text(276,376,'Seit deinem letzten Besuch',14,GOLD,True)
    b.wrap(276,408,'Die Forschung ist abgeschlossen. Zwei Transportflotten sind zurück. Auf Aurelia ist ein Bauplatz frei.',390,19,TXT)
    b.planet(848,455,80)
    b.button(276,518,220,'Aurelia ausbauen',True)
    block(b,984,309,424,'Nächste Ereignisse',h=283)
    for i,(t,s,ss) in enumerate([('00:42','Transport trifft ein','Aurelia → Varn'),('12:18','Scholarium Stufe 6','Aurelia · Ausbau läuft'),('20:37','Befehlsfrist Varn','Bodenkampf · Plan prüfen')]):event(b,1007,371+i*67,t,s,ss,GOLD if i!=2 else ORANGE)
    block(b,250,616,710,'Dein Imperium',h=302)
    for i,(s,st,c) in enumerate([('Aurelia','Bauplatz frei · Energie +240',GREEN),('Vesper','Bauplatz frei · Lager 61 %',GREEN),('Nox','Werft baut · 7 Schiffe offen',BLUE)]):
        y=678+i*71;b.text(278,y,s,20,TXT,True);b.text(439,y+3,st,15,c);b.text(903,y,'›',24,GOLD);b.line(278,y+52,932,y+52)
    block(b,984,616,424,'Was möchtest du tun?',h=302)
    for i,s in enumerate(['Nachschub für Varn planen','Sternenkarte erkunden','Berichte lesen · 3 neu','Belohnungen abholen · 2']):b.button(1007,672+i*56,376,s,False)
    b.footer();return b

def galaxy_map(b,x,y,w,h,selected=True):
    b.rect(x,y,w,h,'#0c1218','#3e4447',10);stars(b,x+10,y+10,w-20,h-20)
    cx=x+w*.5;cy=y+h*.52
    for i in range(50):
        a=i*.54;r=18+i*min(w,h)*.0072;xx=cx+math.cos(a)*r*1.3;yy=cy+math.sin(a)*r*.8
        c=BLUE if i in [8,12,26] else GREEN if i in [28,35] else '#827d72'
        b.d.ellipse((xx-3,yy-3,xx+3,yy+3),fill=c)
        if i in [8,12,26,35,42]:b.text(xx+9,yy-8,str(i+1),13,c)
    px=x+w*.66;py=y+h*.61
    b.d.ellipse((px-23,py-23,px+23,py+23),outline=GOLD,width=2);b.d.ellipse((px-6,py-6,px+6,py+6),fill=GOLD)
    if w < 500:
        b.text(x+20,y+h-96,'Varn · [1:42:8]',16,TXT,True)
        b.text(x+20,y+h-69,'! Belagerung',13,ORANGE)
    else:
        b.text(px+33,py-12,'Varn · [1:42:8]',17,TXT,True)
        b.text(px+33,py+15,'Belagerung',13,ORANGE)
    # Solid route = live own flight, dashed = proposed order.
    qx=x+w*.26;qy=y+h*.70;b.line(qx,qy,px,py,GREEN,2);b.pill(qx-8,qy-41,'Nachschub · 00:42',GREEN)
    b.pill(x+20,y+20,'● Eigene    ◇ Gilde    ! Konflikt',BLUE)
    b.text(x+20,y+h-35,'+ / −  Zoom    ·    Ziehen: verschieben    ·    Liste verfügbar',12,DIM)

def atlas():
    b=Board(bg='#0c1218');shell(b,'B','Sektor-Atlas','Sternenkarte')
    b.button(1075,108,145,'Karte',True);b.button(1230,108,175,'Liste & Suche')
    galaxy_map(b,250,192,790,726)
    block(b,1062,192,346,'Varn',sub='[1:42:8] · Ziel der Operation',h=328)
    b.planet(1234,325,57);b.pill(1084,407,'! Belagerung · Angreifersicht',ORANGE)
    b.button(1084,452,302,'Planet öffnen',True)
    block(b,1062,544,346,'Lage & Daten',h=374)
    b.wrap(1084,597,'Eigene Operation: aktuell. Fremde Flotten nur aus eigenen Berichten unter 24 h.',291,16)
    b.text(1084,699,'Nachschub reicht für',14,DIM);b.text(1084,723,'03 h 20 min',27,ORANGE,True)
    b.button(1084,780,302,'Versorgung planen');b.button(1084,838,302,'Zum Bodenkampf')
    b.footer();return b

def operations():
    b=Board(bg='#101516');shell(b,'C','Operationsdeck','Kolonien')
    b.pill(1095,111,'Dichte: kompakt',GREEN)
    b.text(252,193,'3 Kolonien. Ein gemeinsamer Lageüberblick.',24,TXT,True)
    for i,(s,v,c) in enumerate([('Bauplätze frei','1',GREEN),('Flotten unterwegs','3 / 8',BLUE),('Befehle offen','1',ORANGE)]):
        x=250+i*391;b.rect(x,244,367,98);b.text(x+18,261,s,14,DIM);b.text(x+18,286,v,31,c,True)
    block(b,250,366,1158,'Kolonien im Vergleich',h=298)
    cols=[274,476,714,957,1208]
    for x,t in zip(cols,['Kolonie','Bauen','Forschung / Werft','Rohstoffe','Aktion']):b.text(x,423,t,13,DIM,True)
    rows=[('Aurelia','Frei','Scholarium · 12:18','+12.480 / h','Ausbauen'),('Vesper','Frei','Werft · 7 offen','Lager 61 %','Ausbauen'),('Nox','Speicher · 22:40','Werft · 7 offen','Lager 81 %','Öffnen')]
    for i,row in enumerate(rows):
        y=459+i*62;b.line(274,y-11,1384,y-11)
        for j,(x,t) in enumerate(zip(cols,row)):
            if j==4:b.button(x,y-1,170,t,i==1,h=41)
            else:b.text(x,y+9,t,15,ORANGE if i==1 else TXT,j==0)
    block(b,250,688,732,'Zeitachse',h=230)
    b.line(285,803,943,803)
    for i,(x,t,s) in enumerate([(307,'JETZT','Transport gestartet'),(510,'00:42','Nachschub landet'),(727,'12:18','Scholarium fertig'),(934,'20:37','Befehlsfrist')]):
        b.d.ellipse((x-5,798,x+5,808),fill=GOLD);b.text(x-28,762,t,13,GOLD,True);b.wrap(x-35,822,s,100,13)
    block(b,1006,688,402,'Fokus: Varn',h=230)
    b.text(1028,745,'3 / 10 Befehle geplant',20,TXT,True);b.wrap(1028,781,'Entwurf lokal. Noch nichts an den Server übermittelt.',347,15);b.button(1028,853,356,'Befehle prüfen',True)
    b.footer();return b

def chronicle():
    b=Board(bg='#16130f');shell(b,'D','Chronik des Imperiums')
    b.rect(250,192,1158,330,'#25211a','#5d4c31',8);stars(b,660,200,730,309)
    b.text(280,216,'KAPITEL XII   ·   DIE WACHT ÜBER VARN',12,GOLD,True)
    b.text(280,264,'Dein Imperium',43,TXT,serif=True);b.text(280,317,'steht nicht still.',43,TXT,serif=True)
    b.wrap(282,388,'Während du fort warst, erreichte dein Orden drei neue Meilensteine. Eine Kolonie braucht nun deine Entscheidung.',600,19)
    b.planet(1211,357,125)
    block(b,250,548,748,'Dein Lagebericht',h=370)
    event(b,277,610,'ERLEDIGT','Scholarium erweitert','Die nächste Forschung steht bereit.',GREEN)
    event(b,277,687,'ANKUNFT','Zwei Flotten sind zurück','Schiffe und Ladung liegen auf Aurelia.',BLUE)
    event(b,277,764,'DEIN ZUG','Varn hält stand','Eigene Belagerung · Vorrat reicht 03:20.',ORANGE)
    b.button(277,844,693,'Die Operation bei Varn planen',True)
    block(b,1022,548,386,'Du entscheidest',h=370)
    b.wrap(1044,603,'Deine Prioritäten für diesen Besuch. Kein Pflichtprogramm.',330,18)
    for i,s in enumerate(['1   Varn versorgen','2   Aurelia ausbauen','3   Die Karte erkunden']):b.button(1044,701+i*60,342,s)
    b.footer();return b

def phone_base(title,variant='A',classic=False):
    b=Board(430,1000,bg='#0d0a08' if classic else BG);b.classic=classic;b.rect(0,0,430,126,'#191918',None,0);b.text(18,13,'NOVA IMPERIUM',17,GOLD,serif=True);b.pill(264,10,'Modern | Classic')
    b.text(18,48,'Aurelia  [1:27:8]  ▾',18,TXT,True);b.text(350,48,'3 neu',14,BLUE)
    for i,(v,c) in enumerate([('128,4 k',TXT),('64,2 k',BLUE),('18,9 k',GREEN),('+240',ORANGE)]):
        x=18+i*104;b.text(x,88,v,17,c,True)
    b.text(18,147,title,24,GOLD,serif=True)
    b.rect(0,909,430,58,'#1e201f',LINE,0)
    for i,s in enumerate(['Brücke','Ausbau','Flotte','Karte','Mehr']):b.text(13+i*85,930,s,13,GOLD if i==0 else DIM,True)
    b.footer('Studie '+variant+' [V] · Beispieldaten');return b

def phone(variant):
    titles={'A':'Kommandobrücke','B':'Sektor-Atlas','C':'Operationsdeck','D':'Deine Chronik'}
    b=phone_base(titles[variant],variant)
    if variant=='A':
        b.rect(18,198,394,142,'#30231f','#815448');b.text(34,216,'!  Varn braucht dich',20,TXT,True);b.text(34,250,'Befehle bis 20:37 · 3 / 10 geplant',14,DIM);b.button(34,280,362,'Bodenkampf öffnen',True)
        block(b,18,358,394,'Läuft für dich',h=202)
        for i,(s,t) in enumerate([('Scholarium 5 → 6','12:18'),('Versorgung → Varn','00:42')]):
            y=418+i*66;b.text(36,y,s,16,TXT,True);b.text(325,y,t,15,GOLD);b.bar(36,y+33,356,.65-i*.25)
        block(b,18,578,394,'Deine Kolonien',h=231)
        for i,(s,t) in enumerate([('Aurelia','Bauplatz frei'),('Vesper','Bauplatz frei'),('Nox','Werft baut')]):b.text(36,637+i*51,s,18,TXT,True);b.text(180,640+i*51,t,15,ORANGE if i==1 else DIM)
        b.button(18,831,394,'Aurelia ausbauen',True)
    elif variant=='B':
        galaxy_map(b,18,198,394,388)
        b.rect(18,598,394,290);b.text(36,618,'Varn  [1:42:8]',24,TXT,True);b.pill(36,659,'! Belagerung · Angreifersicht',ORANGE);b.text(36,706,'Nachschub reicht 03 h 20 min',16,DIM);b.button(36,746,358,'Planet öffnen',True);b.button(36,805,358,'Bodenkampf öffnen')
    elif variant=='C':
        b.pill(18,197,'1 Bauplatz frei',GREEN);b.pill(177,197,'1 Befehl offen',ORANGE)
        for i,(s,t,q) in enumerate([('Aurelia','Bauen: frei','+12.480 / h'),('Vesper','Bauen: frei','Lager 61 %'),('Nox','Werft: 7 offen','Lager 81 %')]):
            y=245+i*155;b.rect(18,y,394,139);b.text(35,y+14,s,22,TXT,True);b.text(35,y+51,t,16,ORANGE if i==1 else DIM);b.text(35,y+84,q,14,DIM);b.button(278,y+72,116,'Öffnen',i==1)
        block(b,18,728,394,'Als Nächstes',h=160);b.wrap(37,779,'00:42 · Nachschub landet auf Varn. Entwurf mit 3 Befehlen bleibt erhalten.',349,17)
    else:
        b.rect(18,198,394,248,'#272219','#635036');b.text(36,218,'KAPITEL XII',11,GOLD,True);b.text(36,253,'Varn hält stand.',27,TXT,serif=True);b.planet(332,351,66);b.wrap(36,309,'Dein Orden erwartet deine nächste Entscheidung.',210,18,TXT)
        block(b,18,464,394,'Seit deinem letzten Besuch',h=235)
        b.wrap(37,519,'Das Scholarium ist fertig. Zwei Flotten sind zurück. Eine Kolonie braucht Nachschub.',350,19,TXT)
        b.pill(37,641,'Keine Pflichtaufgaben',GREEN)
        b.button(18,723,394,'Varn versorgen',True);b.button(18,783,394,'Aurelia ausbauen');b.button(18,843,394,'Direkt zur Sternenkarte')
    return b

def system():
    b=Board();shell(b,'B','Varn · System 42','Sternenkarte',path='Universum › Galaxie 1 › System 42 › Varn [1:42:8]')
    b.rect(250,208,790,710,'#0c1218');stars(b,270,230,740,660)
    cx,cy=635,565
    for r in [100,180,255,320]:b.d.ellipse((cx-r,cy-r*.65,cx+r,cy+r*.65),outline='#343c41',width=1)
    b.d.ellipse((cx-34,cy-34,cx+34,cy+34),fill='#f2c878');b.planet(808,471,71);b.planet(441,645,39)
    b.d.ellipse((725,388,892,555),outline=GOLD,width=2);b.text(875,479,'Varn',18,GOLD,True)
    b.icon('battleship',810,315,75);b.text(888,337,'12 · eigene Schiffe',13,GREEN)
    b.pill(275,234,'Systemansicht · stufenloser Zoom')
    block(b,1062,208,346,'Varn · Belagerung',h=710)
    b.text(1084,266,'Eigene Kolonie [1:42:8]',16,DIM);b.text(1084,315,'Bodenkampf',23,TXT,True);b.text(1084,351,'3 / 10 Befehle geplant',16,ORANGE)
    b.text(1084,398,'Nachschub',14,DIM);b.text(1084,427,'03 h 20 min',29,ORANGE,True)
    b.text(1084,485,'Produktion pausiert',17,RED);b.wrap(1084,522,'Die Belagerung sperrt den Ausbau dieses Planeten.',292,16)
    b.button(1084,609,302,'Bodenkampf öffnen',True);b.button(1084,668,302,'Nachschub planen');b.button(1084,727,302,'Belagerungsbericht')
    b.wrap(1084,799,'Gleicher Auswahlrahmen und Aktionsbereich wie in der Galaxie.',292,15)
    b.footer();return b

def hexboard(b,x,y,w,h):
    b.rect(x,y,w,h,'#171d1d','#464e4c',10);rng=random.Random(22)
    size=min(w/17.6,h/13);centers={}
    for row in range(8):
        for col in range(9):
            xx=x+size*1.1+col*size*1.73+(row%2)*size*.86;yy=y+size*1.1+row*size*1.5
            pts=[(xx+size*.97*math.cos(math.pi/3*k-math.pi/6),yy+size*.97*math.sin(math.pi/3*k-math.pi/6)) for k in range(6)]
            selected=(row,col) in [(5,2),(4,2),(3,3),(2,3)]
            fill='#3b3a2c' if selected else rng.choice(['#232c28','#28312c','#2e302a','#35332a'])
            b.d.polygon(pts,fill=fill,outline=GOLD if selected else '#454940',width=2 if selected else 1);centers[row,col]=(xx,yy)
            if (row*9+col)%13==0:b.rect(xx-10,yy-9,20,18,'#565343',None,1)
    route=[centers[z] for z in [(5,2),(4,2),(3,3),(2,3)]]
    b.d.line(route,fill=GOLD,width=4)
    for i,(xx,yy) in enumerate(route[1:]):b.d.ellipse((xx-10,yy-10,xx+10,yy+10),fill=GOLD);b.text(xx-4,yy-8,str(i+1),12,'#161713',True)
    for row,col,label,c in [(5,2,'S',BLUE),(6,1,'L',BLUE),(2,6,'W',RED),(4,6,'M',RED)]:
        xx,yy=centers[row,col]
        if c==RED:b.d.polygon([(xx,yy-21),(xx+21,yy),(xx,yy+21),(xx-21,yy)],fill='#111b1e',outline=c,width=3)
        else:b.d.ellipse((xx-17,yy-17,xx+17,yy+17),fill='#111b1e',outline=c,width=3)
        b.text(xx-7,yy-12,label,18,c,True);b.bar(xx-17,yy+24,34,.75,c)
    b.text(x+20,y+h-40,'● Eigene   ◆ Gegner   1–3 Geplant   □ Deckung',13,DIM)

def siege(classic=False):
    b=Board(bg='#0d0a08' if classic else BG);b.classic=classic;shell(b,'A + B','Varn · Bodenkampf','Bodenkampf',classic,path='Karte › Varn [1:42:8] › Belagerung › Bodenkampf')
    b.pill(250,207,'PLANUNG · noch nicht übermittelt',ORANGE);b.pill(671,207,'Frist 20:37 · Zeitmodell offen',GOLD);b.pill(1078,207,'Nachschub 03:20',ORANGE)
    if not classic:
        hexboard(b,250,252,790,666)
    else:
        block(b,250,252,790,'Klassische Befehlsansicht',h=666)
        b.wrap(274,307,'Gleicher Kampf, gleiche Befehle. Die Liste ergänzt das Hexfeld und ersetzt keine Spielregel.',735,18)
        for i,(s,p,t) in enumerate([('Sturmtrupp II','D6 · 34 / 50 LP','C5: Deckung nehmen'),('Läufer I','B7 · 40 / 40 LP','Halten'),('Mörser I','B8 · 22 / 30 LP','Ziel auswählen')]):
            y=405+i*130;b.line(274,y-15,1015,y-15);b.text(274,y,s,21,TXT,True);b.text(274,y+38,p,16,DIM);b.button(640,y+4,350,t)
        b.button(274,839,741,'Hexfeld öffnen · gleiche Auswahl')
    block(b,1062,252,346,'Sturmtrupp II',sub='Ausgewählt · D6 · 34 / 50 LP',h=235)
    b.bar(1084,334,302,.68,GREEN);b.button(1084,365,143,'Bewegen',True);b.button(1238,365,148,'Halten');b.text(1084,434,'Deckung · Befehle im Entwurf',14,DIM)
    block(b,1062,508,346,'Geplante Befehle · 3 / 10',h=410)
    for i,s in enumerate(['D6 → C5 · Deckung','C5 → D4 · Vorrücken','D4 halten']):
        y=568+i*65;b.pill(1084,y,str(i+1));b.text(1126,y+3,s,15,TXT);b.text(1084,y+31,'↑  ↓   Ändern   Entfernen',12,DIM)
    b.text(1084,779,'Entwurf erhalten · kein Absenden',13,GREEN)
    b.button(1084,816,302,'3 Befehle prüfen',True);b.text(1084,878,'Danach: verbindlich übermitteln',12,DIM)
    b.footer('Studie [V] · #155 Zeit- und Kampfregeln bleiben offen · keine Implementierung');return b

def build_phone(stage=0):
    b=phone_base('Ausbau & Forschung')
    b.text(18,190,'Gebäude    Forschung    Werft',15,DIM);b.pill(18,226,'Alle');b.pill(83,226,'Baubar',GREEN);b.pill(175,226,'Läuft')
    data=[('metal_mine','Adamant-Tiefbohrung','12 → 13','18,2 k  ·  4,5 k  ·  08:12'),('crystal_mine','Psikristall-Steinbruch','10 → 11','14,8 k  ·  7,4 k  ·  06:42'),('solar_plant','Sonnenkathedrale','11 → 12','8,6 k  ·  3,4 k  ·  04:21')]
    y=277
    for i,(ico,name,lv,cost) in enumerate(data):
        h=325 if i==0 and stage==1 else 132
        b.rect(18,y,394,h);b.icon(ico,27,y+14,56);b.text(94,y+15,name,15,TXT,True);b.text(94,y+43,lv,14,GOLD);b.text(36,y+82,cost,13,DIM)
        if i==0 and stage==1:
            b.text(36,y+124,'Wirkung der nächsten Stufe',16,TXT,True);b.text(36,y+160,'Produktion   +2.400 Adamant / h',14,GREEN);b.text(36,y+192,'Energie       −60 · danach +180',14,ORANGE);b.text(36,y+224,'Bauzeit        08:12',14,DIM);b.button(36,y+265,358,'Auf Stufe 13 ausbauen',True)
        elif i==0 and stage==2:b.pill(231,y+40,'Ausbau läuft',GREEN)
        else:b.text(369,y+40,'›',22,GOLD)
        y+=h+15
    if stage==2:
        b.rect(18,753,394,132,'#203124','#566d4e');b.text(36,770,'✓  Ausbau bestätigt',20,GREEN,True);b.wrap(36,808,'Stufe 13 wird gebaut. Fertig in 08:12. Ressourcen wurden abgebucht.',352,16)
    elif stage==0:b.wrap(20,y+10,'Kosten und Zeit immer sichtbar. Wirkung und Details gezielt aufklappen.',386,15)
    return b


def siege_phone(classic=False):
    b=phone_base('Varn · Bodenkampf',classic=classic)
    b.text(18,190,'[1:42:8]  ·  Frist 20:37',15,DIM)
    b.pill(18,225,'Planung · 3 / 10',ORANGE);b.pill(226,225,'Nachschub 03:20',ORANGE)
    if not classic:
        field=Board(650,650);hexboard(field,0,0,650,650)
        b.im.paste(field.im.crop((80,200,474,550)),(18,270));b.d=ImageDraw.Draw(b.im)
        b.pill(28,283,'Feld D6 · gewählt',GOLD);b.button(305,553,44,'+');b.button(358,553,44,'−')
        b.rect(18,632,394,136);b.text(36,646,'Sturmtrupp II · 34 / 50 LP',17,TXT,True);b.button(36,687,170,'Bewegen',True);b.button(219,687,175,'Halten')
        b.rect(18,782,394,106);b.text(36,794,'3 Befehle im Entwurf',16,GOLD,True);b.button(36,830,358,'Befehlsliste öffnen',True)
    else:
        block(b,18,270,394,'Classic · Befehlsliste',h=618)
        b.text(36,326,'Sturmtrupp II · Feld D6',18,TXT,True)
        b.text(36,361,'34 / 50 LP · Entwurf unverändert',14,GREEN)
        for i,t in enumerate(['1   D6 → C5 · Deckung','2   C5 → D4 · Vorrücken','3   D4 halten']):
            y=408+i*91;b.text(36,y,t,17,TXT,True);b.text(36,y+35,'↑  ↓     Ändern     Entfernen',14,DIM);b.line(36,y+69,394,y+69)
        b.button(36,715,358,'3 Befehle prüfen',True);b.button(36,774,358,'Modern · Hexfeld öffnen')
        b.text(36,842,'Kein automatisches Abschicken',14,GREEN)
    return b

BOARDS={'a-bridge-desktop':bridge(),'b-atlas-desktop':atlas(),'c-operations-desktop':operations(),'d-chronicle-desktop':chronicle(),'map-system':system(),'siege-modern':siege(),'siege-classic':siege(True)}
BOARDS['siege-phone-modern']=siege_phone()
BOARDS['siege-phone-classic']=siege_phone(True)
for v in 'ABCD':BOARDS[v.lower()+'-phone']=phone(v)
for i in range(3):BOARDS['build-phone-'+str(i)]=build_phone(i)
for name,b in BOARDS.items():b.save(name)
# A compact choice sheet, with legible full-size individual exports alongside it.
contact=Board(1480,1112)
for i,(name,title,sub) in enumerate([('a-bridge-desktop','A · Imperiale Brücke','Prioritäten + kurze Besuche'),('b-atlas-desktop','B · Sektor-Atlas','Raum + Kontext + nahtloser Zoom'),('c-operations-desktop','C · Operationsdeck','Vergleiche + Zeit + viele Kolonien'),('d-chronicle-desktop','D · Imperiums-Chronik','Atmosphäre + Rückkehr + Orientierung')]):
    x=24+(i%2)*728;y=24+(i//2)*538;contact.text(x,y,title,25,GOLD,True);contact.text(x,y+37,sub,17,DIM);im=BOARDS[name].im.resize((704,455),Image.Resampling.LANCZOS);contact.im.paste(im,(x,y+65))
contact.save('four-directions')
# Storyboards are deliberate readable held states. Animated movement is a
# proposal illustration, not a claim that pan/zoom or state persistence shipped.
def storyboard(names,out,durations,taps=None):
    frames=[];times=[]
    for i,name in enumerate(names):
        base=BOARDS[name].im
        frames.append(base);times.append(durations[i] if not taps else durations[i]-650)
        if taps:
            x,y=taps[i]
            for k in range(5):
                im=base.copy();d=ImageDraw.Draw(im);r=9+k*4;d.ellipse((x-r,y-r,x+r,y+r),outline=GOLD,width=3);d.ellipse((x-4,y-4,x+4,y+4),fill=TXT);frames.append(im);times.append(130)
    frames[0].save(OUT/(out+'.webp'),save_all=True,append_images=frames[1:],duration=times,loop=0,quality=76,method=6,minimize_size=True)
storyboard(['a-bridge-desktop','b-atlas-desktop','c-operations-desktop','d-chronicle-desktop'],'design-tour',[3500]*4)
storyboard(['b-atlas-desktop','map-system','siege-modern','siege-classic','siege-modern'],'map-to-siege-and-classic',[2800,2800,3500,3500,2800],[(1217,474),(1220,631),(1343,42),(1191,42),(1228,836)])
storyboard(['build-phone-0','build-phone-1','build-phone-2'],'phone-build-flow',[2500,3500,3500],[(373,329),(213,561),(214,929)])
storyboard(['siege-phone-modern','siege-phone-classic','siege-phone-modern'],'phone-modern-classic',[3500,4000,3000],[(340,23),(204,796),(191,849)])
print(json.dumps({p.name:p.stat().st_size for p in sorted(OUT.glob('*.webp'))},indent=2))
