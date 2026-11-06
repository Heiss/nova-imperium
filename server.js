#!/usr/bin/env node
/* Nova Imperium – Spielserver. Keine Abhängigkeiten, nur Node.js >= 18. Start: node server.js */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const G = require('./public/game.js');
const { CFG, BUILD, RES, SHIPS, DEF, UNIT, MISSION } = G;

const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const INVITE_CODE = process.env.INVITE_CODE || '';          // leer = jeder darf sich registrieren
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'universe.json');
const PUBLIC = path.join(__dirname, 'public');
const SESSION_DAYS = 30;

class GErr extends Error {}
const fail = msg => { throw new GErr(msg); };
const now = () => Date.now();
const rid = () => crypto.randomBytes(9).toString('base64url');
const coords = c => `[${c.g}:${c.s}:${c.p}]`;
const fmt = n => Math.floor(n||0).toLocaleString('de-DE');
const resLine = r => `Metall ${fmt(r.m)} · Kristall ${fmt(r.c)} · Deuterium ${fmt(r.d)}`;
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));
const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);

/* ===================== Speicher ===================== */
let DB = { users: {}, planets: {}, fleets: {}, sessions: {} };
let dirty = false;
function load(){
 try { DB = Object.assign(DB, JSON.parse(fs.readFileSync(FILE, 'utf8'))); console.log(`Universum geladen: ${Object.keys(DB.users).length} Spieler`); }
 catch (e) { if (e.code !== 'ENOENT') { console.error('Konnte', FILE, 'nicht lesen:', e.message); process.exit(1); } console.log('Neues Universum wird angelegt.'); }
}
function save(){
 if (!dirty) return; dirty = false;
 fs.mkdirSync(DATA_DIR, { recursive: true });
 const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(DB)); fs.renameSync(tmp, FILE);
}
const touch = () => { dirty = true; };

/* ===================== Hilfen ===================== */
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const planetOf = u => Object.values(DB.planets).filter(p => p.owner === u.id).sort((a,b) => a.created - b.created)[0];
const R_of = (u, t) => G.settleR({ research: u.research || {}, rq: u.rq || null }, t);
function setResearch(u, R){ u.research = R.research; u.rq = R.rq; }
function addReport(uid, r){ const u = DB.users[uid]; if (!u) return; u.reports = u.reports || [];
 u.reports.unshift(Object.assign({ id: rid() }, r)); if (u.reports.length > CFG.MAX_REPORTS) u.reports.length = CFG.MAX_REPORTS; }
function pointsMap(){ const t = now(), pts = {};
 for (const u of Object.values(DB.users)){ const R = R_of(u, t); let s = 0; for (const k in RES) s += G.sumLevels(RES[k], R.research[k]||0); pts[u.id] = s; }
 for (const p of Object.values(DB.planets)){ if (!(p.owner in pts)) continue; const P = G.settle(p, t); let s = 0;
  for (const k in BUILD) s += G.sumLevels(BUILD[k], P.b[k]||0);
  for (const [k,n] of Object.entries(Object.assign({}, P.ships, P.def))) if (UNIT[k]) s += (UNIT[k].cost[0]+UNIT[k].cost[1]+UNIT[k].cost[2])*n;
  pts[p.owner] += s; }
 for (const f of Object.values(DB.fleets)) if (f.owner in pts) for (const [k,n] of Object.entries(f.ships||{})) if (SHIPS[k]) pts[f.owner] += (SHIPS[k].cost[0]+SHIPS[k].cost[1]+SHIPS[k].cost[2])*n;
 for (const k in pts) pts[k] = Math.floor(pts[k]/1000); return pts; }
const isProtected = (me, target, pts) => (pts[target]||0)*5 < (pts[me]||0);

function placePlanet(owner, name, gal){
 const free = c => !DB.planets[G.pid(c)];
 let c = null;
 for (let i = 0; i < 300 && !c; i++){ const t = {g:gal, s:1+Math.floor(Math.random()*CFG.SYSTEMS), p:4+Math.floor(Math.random()*9)}; if (free(t)) c = t; }
 for (let g = 1; g <= CFG.GALAXIES && !c; g++) for (let s = 1; s <= CFG.SYSTEMS && !c; s++) for (let p = 1; p <= CFG.POSITIONS && !c; p++) if (free({g,s,p})) c = {g,s,p};
 if (!c) fail('Das Universum ist voll.');
 const t = now(), id = G.pid(c);
 DB.planets[id] = { id, owner, name, g:c.g, s:c.s, p:c.p, temp: Math.round(130 - (c.p-1)*10 + (Math.random()*20-10)),
  res:{m:CFG.START_RES[0], c:CFG.START_RES[1], d:CFG.START_RES[2]}, b:{}, ships:{}, def:{}, bq:null, sq:[], sqT:null, pct:{}, t, created:t };
 return DB.planets[id];
}

/* ===================== Zustand für einen Spieler ===================== */
function stateFor(u){
 const t = now(), P = planetOf(u), pts = pointsMap();
 const fleets = Object.values(DB.fleets).filter(f => f.owner === u.id || (P && f.state === 'out' && f.to === P.id)).map(f => {
  if (f.owner === u.id) return f;
  return { id:f.id, owner:f.owner, fromC:f.fromC, toC:f.toC, to:f.to, mission:f.mission, state:f.state, arr:f.arr, ships: f.mission === 'attack' ? f.ships : {} }; });
 const players = {}; for (const x of Object.values(DB.users)) players[x.id] = { name:x.name, points: pts[x.id]||0 };
 const galaxy = Object.values(DB.planets).map(p => ({ id:p.id, name:p.name, g:p.g, s:p.s, p:p.p, temp:p.temp, owner:p.owner }));
 return { now:t, cfg:CFG, me:{ id:u.id, name:u.name, research:u.research||{}, rq:u.rq||null, probes:u.probes||1, readAt:u.readAt||0, admin:!!u.admin },
  planet:P || null, fleets, reports:u.reports||[], players, galaxy };
}

/* ===================== Aktionen ===================== */
const A = {};
function mine(u){ const p = planetOf(u); if (!p) fail('Du hast keinen Planeten.'); return G.settle(p, now()); }
const store = P => { DB.planets[P.id] = P; touch(); };

A.build = (u, d) => { const P = mine(u), R = R_of(u, now()), k = d.key, def = BUILD[k]; if (!def) fail('Unbekanntes Gebäude.');
 if (P.bq) fail('Es wird bereits gebaut.'); if (G.reqMissing(def, P, R).length) fail('Voraussetzungen fehlen.');
 if (k === 'yard' && P.sq.length) fail('Die Werft arbeitet gerade.'); if (k === 'lab' && R.rq) fail('Das Labor forscht gerade.');
 const lvl = (P.b[k]||0)+1, c = G.lvlCost(def, lvl); if (!G.afford(P, c)) fail('Nicht genug Rohstoffe.');
 G.pay(P, c); P.bq = {key:k, lvl, start:now(), end:now()+G.buildTime(c, P), cost:c}; store(P); };
A.cancelBuild = u => { const P = mine(u); if (!P.bq) return; const c = P.bq.cost; P.res.m += c[0]; P.res.c += c[1]; P.res.d += c[2]; P.bq = null; store(P); };
A.research = (u, d) => { const P = mine(u), R = R_of(u, now()), k = d.key, def = RES[k]; if (!def) fail('Unbekannte Forschung.');
 if (!(P.b.lab > 0)) fail('Du brauchst ein Forschungslabor.'); if (R.rq) fail('Es wird bereits geforscht.'); if (P.bq && P.bq.key === 'lab') fail('Das Labor wird ausgebaut.');
 if (G.reqMissing(def, P, R).length) fail('Voraussetzungen fehlen.');
 const lvl = (R.research[k]||0)+1, c = G.lvlCost(def, lvl); if (!G.afford(P, c)) fail('Nicht genug Rohstoffe.');
 G.pay(P, c); R.rq = {key:k, lvl, start:now(), end:now()+G.researchTime(c, P), cost:c}; setResearch(u, R); store(P); };
A.cancelResearch = u => { const P = mine(u), R = R_of(u, now()); if (!R.rq) return; const c = R.rq.cost; P.res.m += c[0]; P.res.c += c[1]; P.res.d += c[2]; R.rq = null; setResearch(u, R); store(P); };
A.order = (u, d) => { const P = mine(u), R = R_of(u, now()), k = d.key, def = UNIT[k]; if (!def) fail('Unbekannte Einheit.');
 if (!(P.b.yard > 0)) fail('Du brauchst eine Raumschiffwerft.'); if (P.bq && P.bq.key === 'yard') fail('Die Werft wird ausgebaut.');
 if (G.reqMissing(def, P, R).length) fail('Voraussetzungen fehlen.');
 let n = Math.min(int(d.n, 0, 1e9), G.maxAfford(P, def.cost)); if (n <= 0) fail('Nicht genug Rohstoffe.');
 if (P.sq.length >= 20) fail('Die Bauliste der Werft ist voll.');
 G.pay(P, def.cost, n); if (!P.sq.length) P.sqT = now(); P.sq.push({key:k, n, unit:G.unitTime(def, P)}); store(P);
 return `${fmt(n)}× ${def.n} in Auftrag gegeben.`; };
A.pct = (u, d) => { const P = mine(u); if (!['metal','crystal','deut','solar'].includes(d.key)) fail('Ungültig.'); P.pct[d.key] = Math.round(int(d.v, 0, 100)/10)*10; store(P); };
A.rename = (u, d) => { const n = str(d.name, 20); if (!n) fail('Bitte einen Namen eingeben.'); const P = mine(u); P.name = n; store(P); };
A.options = (u, d) => { u.probes = int(d.probes, 1, 1e6); touch(); return 'Gespeichert.'; };
A.read = u => { u.readAt = Math.max(0, ...(u.reports||[]).map(r => r.time)); touch(); };
A.delrep = (u, d) => { u.reports = (u.reports||[]).filter(r => r.id !== d.id); touch(); };
A.delall = u => { u.reports = []; touch(); };
A.recall = (u, d) => { const f = DB.fleets[d.id], t = now(); if (!f || f.owner !== u.id || f.state !== 'out' || f.arr <= t) fail('Rückruf nicht mehr möglich.');
 f.state = 'back'; f.ret = t + (t - f.dep); f.recalled = true; touch(); return 'Flotte zurückgerufen.'; };
A.send = (u, d) => {
 const t = now(), P = mine(u), R = R_of(u, t), mission = d.mission, pct = int(d.pct, 1, 10);
 if (!MISSION[mission]) fail('Unbekannter Auftrag.');
 const ships = {}; for (const [k,n] of Object.entries(d.ships||{})) { if (!SHIPS[k]) continue; const m = Math.min(int(n, 0, 1e12), P.ships[k]||0); if (m > 0) ships[k] = m; }
 if (!G.countUnits(ships)) fail('Keine Schiffe ausgewählt.');
 if (Object.values(DB.fleets).filter(f => f.owner === u.id).length >= 1 + (R.research.computer||0)) fail('Alle Flottenslots belegt.');
 const to = {g:int(d.to && d.to.g, 1, CFG.GALAXIES), s:int(d.to && d.to.s, 1, CFG.SYSTEMS), p:int(d.to && d.to.p, 1, CFG.POSITIONS)};
 const target = DB.planets[G.pid(to)]; if (!target) fail('An dieser Position gibt es keinen Planeten.');
 if (target.id === P.id) fail('Das ist dein eigener Planet.');
 if (mission !== 'transport' && target.owner === u.id) fail('Eigene Planeten kann man nicht angreifen.');
 if (mission !== 'transport' && isProtected(u.id, target.owner, pointsMap())) fail('Dieser Spieler steht unter Noobschutz.');
 if (mission === 'spy' && Object.keys(ships).some(k => k !== 'probe')) fail('Spionage nur mit Spionagesonden.');
 const c = d.cargo || {};
 const cargo = mission === 'spy' ? {m:0,c:0,d:0} : {m:Math.min(int(c.m,0,1e15), Math.floor(P.res.m)), c:Math.min(int(c.c,0,1e15), Math.floor(P.res.c)), d:int(c.d,0,1e15)};
 const dist = G.distance(P, to), ms = G.flightMs(dist, G.fleetSpeed(ships, R), pct), fuel = G.fuelFor(ships, dist, pct);
 if (cargo.m + cargo.c + cargo.d > G.capacity(ships)) fail('Nicht genug Laderaum.');
 if (P.res.d < fuel + cargo.d) fail('Nicht genug Deuterium für Treibstoff und Ladung.');
 for (const [k,n] of Object.entries(ships)) P.ships[k] -= n; P.res.m -= cargo.m; P.res.c -= cargo.c; P.res.d -= cargo.d + fuel; store(P);
 const id = rid();
 DB.fleets[id] = { id, owner:u.id, from:P.id, fromC:{g:P.g,s:P.s,p:P.p}, to:target.id, toC:{g:target.g,s:target.s,p:target.p}, mission, ships, cargo, dep:t, arr:t+ms, ret:t+2*ms, state:'out' };
 touch(); return `Flotte unterwegs nach ${coords(to)}.`; };
A.reset = u => { if (!u.admin) fail('Nur der Admin darf das.');
 DB.planets = {}; DB.fleets = {}; for (const x of Object.values(DB.users)){ x.research = {}; x.rq = null; x.reports = []; x.readAt = 0; }
 for (const x of Object.values(DB.users)) placePlanet(x.id, 'Heimatplanet', 1 + Math.floor(Math.random()*CFG.GALAXIES));
 touch(); return 'Neue Runde gestartet – alle Spieler haben einen frischen Planeten.'; };

/* ===================== Flotten verarbeiten ===================== */
function arrive(F){
 const T0 = DB.planets[F.to], attU = DB.users[F.owner] || {name:'Unbekannt'};
 const back = extra => { Object.assign(F, extra, {state:'back'}); touch(); };
 if (!T0 || (F.mission !== 'transport' && T0.owner === F.owner)){
  addReport(F.owner, {time:F.arr, type:'info', title:'Flotte kehrt um', text:`An ${coords(F.toC)} wurde kein passendes Ziel gefunden. Deine Flotte kehrt zurück.`}); return back({}); }
 const T = G.settle(T0, F.arr), defU = DB.users[T.owner] || {name:'Unbekannt'};
 const attR = R_of(attU, F.arr).research, defR = R_of(defU, F.arr).research;
 if (F.mission === 'transport'){
  T.res.m += F.cargo.m; T.res.c += F.cargo.c; T.res.d += F.cargo.d; store(T);
  const text = `Eine Flotte von ${attU.name} erreicht ${T.name} ${coords(F.toC)} und liefert ${resLine(F.cargo)}.`;
  addReport(F.owner, {time:F.arr, type:'info', title:`Transport erreicht ${coords(F.toC)}`, text});
  if (T.owner !== F.owner) addReport(T.owner, {time:F.arr, type:'info', title:`Lieferung von ${attU.name}`, text});
  return back({cargo:{m:0,c:0,d:0}}); }
 if (F.mission === 'spy'){
  const probes = F.ships.probe||0, diff = (attR.spy||0) - (defR.spy||0), score = probes + Math.sign(diff)*diff*diff;
  const defShips = G.countUnits(T.ships), chance = defShips ? Math.min(100, Math.round(2*Math.sqrt(defShips)*Math.pow(2, -diff))) : 0;
  const lost = Math.random()*100 < chance;
  const rep = {time:F.arr, type:'spy', title:`Spionagebericht von ${T.name} ${coords(F.toC)}`, name:T.name, defName:defU.name, coords:F.toC,
   res:{m:Math.floor(T.res.m), c:Math.floor(T.res.c), d:Math.floor(T.res.d)}, counter:chance, lost};
  if (score >= 2) rep.ships = T.ships; if (score >= 3) rep.def = T.def; if (score >= 5) rep.b = T.b; if (score >= 7) rep.r = defR;
  addReport(F.owner, rep);
  addReport(T.owner, {time:F.arr, type:'info', title:'Spionageaktivität', text:`Eine fremde Flotte von ${attU.name} ${coords(F.fromC)} wurde in der Nähe deines Planeten ${T.name} ${coords(F.toC)} gesichtet. Chance auf Spionageabwehr: ${chance} %.${lost ? ' Die Sonden wurden abgeschossen!' : ''}`});
  if (lost){ delete DB.fleets[F.id]; touch(); return; }
  return back({}); }
 // Angriff
 const defBefore = Object.assign({}, T.ships, T.def), res = G.battle({units:F.ships, tech:attR}, {units:defBefore, tech:defR});
 const rebuilt = {}, newDef = {}, newShips = {};
 for (const k in DEF){ const before = T.def[k]||0, after = res.def[k]||0, lostN = before - after; let rb = 0;
  if (lostN > 0){ if (lostN < 50) for (let i = 0; i < lostN; i++) rb += Math.random() < 0.7 ? 1 : 0; else rb = Math.round(lostN*0.7); }
  if (rb) rebuilt[k] = rb; if (after + rb) newDef[k] = after + rb; }
 for (const k in SHIPS) if (res.def[k]) newShips[k] = res.def[k];
 const loot = {m:0,c:0,d:0};
 if (res.winner === 'att'){ let cap = G.capacity(res.att) - (F.cargo.m+F.cargo.c+F.cargo.d); const av = {m:T.res.m/2, c:T.res.c/2, d:T.res.d/2};
  const take = (k, lim) => { const v = Math.max(0, Math.floor(Math.min(av[k] - loot[k], lim))); loot[k] += v; cap -= v; };
  take('m', cap/3); take('c', cap/2); take('d', cap); take('m', cap/2); take('c', cap); take('m', cap);
  T.res.m -= loot.m; T.res.c -= loot.c; T.res.d -= loot.d; }
 T.ships = newShips; T.def = newDef; store(T);
 const rep = {time:F.arr, type:'battle', name:T.name, coords:F.toC, attName:attU.name, defName:defU.name, rounds:res.rounds, winner:res.winner,
  attBefore:F.ships, attAfter:res.att, defBefore, defAfter:res.def, rebuilt, loot,
  attTech:{weapons:attR.weapons||0, shield:attR.shield||0, armor:attR.armor||0}, defTech:{weapons:defR.weapons||0, shield:defR.shield||0, armor:defR.armor||0}};
 const W = {att:'gewonnen', def:'verloren', draw:'unentschieden'};
 addReport(F.owner, Object.assign({}, rep, {title:`Kampfbericht ${coords(F.toC)} – ${W[res.winner]}`}));
 addReport(T.owner, Object.assign({}, rep, {title:`Angriff auf ${T.name} ${coords(F.toC)} durch ${attU.name}`}));
 if (!G.countUnits(res.att)){ delete DB.fleets[F.id]; touch(); return; }
 back({ships:res.att, cargo:{m:F.cargo.m+loot.m, c:F.cargo.c+loot.c, d:F.cargo.d+loot.d}});
}
function comeHome(F){
 const O0 = DB.planets[F.from];
 if (O0 && O0.owner === F.owner){ const O = G.settle(O0, F.ret);
  for (const [k,n] of Object.entries(F.ships)) O.ships[k] = (O.ships[k]||0) + n; O.res.m += F.cargo.m; O.res.c += F.cargo.c; O.res.d += F.cargo.d; store(O);
  const sum = F.cargo.m + F.cargo.c + F.cargo.d;
  if (F.mission !== 'spy' || F.recalled) addReport(F.owner, {time:F.ret, type:'info', title:`Rückkehr zu ${O.name} ${coords(F.fromC)}`, text:`Deine Flotte ist zurück${sum ? ' und bringt ' + resLine(F.cargo) + ' mit' : ''}.`}); }
 delete DB.fleets[F.id]; touch();
}
function tick(){
 const t = now();
 const due = Object.values(DB.fleets).map(f => ({f, at: f.state === 'out' ? f.arr : f.ret})).filter(x => x.at <= t).sort((a,b) => a.at - b.at);
 for (const {f} of due){ try { if (!DB.fleets[f.id]) continue; if (f.state === 'out') arrive(f); else comeHome(f); }
  catch (e) { console.error('Fehler bei Flotte', f.id, e); delete DB.fleets[f.id]; touch(); } }
}

/* ===================== HTTP ===================== */
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
const attempts = {};
function json(res, code, obj, headers){ res.writeHead(code, Object.assign({'content-type':'application/json; charset=utf-8', 'cache-control':'no-store'}, headers||{})); res.end(JSON.stringify(obj)); }
function body(req){ return new Promise((ok, no) => { let s = ''; req.on('data', c => { s += c; if (s.length > 65536) { no(new GErr('Anfrage zu groß.')); req.destroy(); } });
 req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { no(new GErr('Ungültige Anfrage.')); } }); req.on('error', no); }); }
function cookies(req){ const o = {}; (req.headers.cookie||'').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0,i).trim()] = decodeURIComponent(p.slice(i+1).trim()); }); return o; }
function sessionUser(req){ const sid = cookies(req).sid; const s = sid && DB.sessions[sid]; if (!s || s.exp < now()) return null; return DB.users[s.uid] || null; }
function newSession(req, uid){ const sid = crypto.randomBytes(24).toString('base64url'); DB.sessions[sid] = {uid, exp: now() + SESSION_DAYS*864e5}; touch();
 const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
 return `sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DAYS*86400}${secure}`; }
function limited(req){ const ip = req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress;
 const a = attempts[ip] = (attempts[ip] && attempts[ip].until > now()) ? attempts[ip] : {n:0, until: now()+10*60000}; return ++a.n > 20; }

async function api(req, res, url){
 if (url === '/api/register' && req.method === 'POST'){
  if (limited(req)) fail('Zu viele Versuche – bitte später nochmal.');
  const d = await body(req), name = str(d.name, 20), pw = String(d.password || '');
  if (INVITE_CODE && d.invite !== INVITE_CODE) fail('Falscher Einladungscode.');
  if (name.length < 2) fail('Der Name braucht mindestens 2 Zeichen.'); if (pw.length < 6) fail('Das Passwort braucht mindestens 6 Zeichen.');
  if (Object.values(DB.users).some(u => u.name.toLowerCase() === name.toLowerCase())) fail('Der Name ist schon vergeben.');
  const id = 'u' + rid(), salt = crypto.randomBytes(16).toString('hex');
  const u = DB.users[id] = { id, name, salt, pw: hash(pw, salt), research:{}, rq:null, probes:1, readAt:now(), reports:[], created:now(), admin: Object.keys(DB.users).length === 0 };
  placePlanet(id, str(d.planet, 20) || 'Heimatplanet', int(d.gal, 1, CFG.GALAXIES)); touch();
  return json(res, 200, {ok:true, state:stateFor(u)}, {'set-cookie': newSession(req, id)}); }
 if (url === '/api/login' && req.method === 'POST'){
  if (limited(req)) fail('Zu viele Versuche – bitte später nochmal.');
  const d = await body(req), name = str(d.name, 20).toLowerCase(); const u = Object.values(DB.users).find(x => x.name.toLowerCase() === name);
  if (!u || !crypto.timingSafeEqual(Buffer.from(hash(String(d.password||''), u.salt), 'hex'), Buffer.from(u.pw, 'hex'))) fail('Name oder Passwort falsch.');
  return json(res, 200, {ok:true, state:stateFor(u)}, {'set-cookie': newSession(req, u.id)}); }
 if (url === '/api/logout' && req.method === 'POST'){ const sid = cookies(req).sid; if (sid) { delete DB.sessions[sid]; touch(); }
  return json(res, 200, {ok:true}, {'set-cookie':'sid=; Path=/; Max-Age=0'}); }
 const u = sessionUser(req); if (!u) return json(res, 401, {error:'Bitte einloggen.'});
 if (url === '/api/state' && req.method === 'GET') return json(res, 200, stateFor(u));
 if (url === '/api/action' && req.method === 'POST'){ const d = await body(req); const fn = A[d.type]; if (!fn) fail('Unbekannte Aktion.');
  tick(); const msg = fn(u, d); return json(res, 200, {ok:true, msg: msg || null, state:stateFor(u)}); }
 json(res, 404, {error:'Nicht gefunden.'});
}
function serveStatic(req, res, url){
 let p = url === '/' ? '/index.html' : url; p = path.normalize(decodeURIComponent(p)).replace(/^([/\\])+/, '');
 const file = path.join(PUBLIC, p); if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
 fs.readFile(file, (e, data) => { if (e) { res.writeHead(404, {'content-type':'text/plain; charset=utf-8'}); return res.end('Nicht gefunden'); }
  res.writeHead(200, {'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control':'no-cache', 'x-content-type-options':'nosniff'}); res.end(data); });
}
function start(){
 load();
 const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try { if (url.startsWith('/api/')) await api(req, res, url); else serveStatic(req, res, url); }
  catch (e) { if (e instanceof GErr) json(res, 400, {error:e.message}); else { console.error(e); json(res, 500, {error:'Serverfehler.'}); } }
 });
 setInterval(tick, 1000); setInterval(save, 5000);
 setInterval(() => { const t = now(); for (const [k,s] of Object.entries(DB.sessions)) if (s.exp < t) { delete DB.sessions[k]; touch(); } }, 3600000);
 const stop = () => { console.log('Speichere und beende …'); dirty = true; save(); process.exit(0); };
 process.on('SIGINT', stop); process.on('SIGTERM', stop);
 server.listen(PORT, HOST, () => console.log(`Nova Imperium läuft auf http://${HOST}:${PORT}  (Speed x${CFG.SPEED}${INVITE_CODE ? ', Einladungscode aktiv' : ''})`));
}
if (require.main === module) start();
module.exports = { start, _DB: () => DB, A, tick, stateFor, placePlanet };
