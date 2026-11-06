/* Frozen copy of the original public/game.js (version 1 of Nova Imperium). Reference for the equivalence test of src/shared, never changed. */
(function (root) {
"use strict";
/* ===== Universum-Einstellungen (hier anpassen) ===== */
const CFG = { SPEED: 5, GALAXIES: 2, SYSTEMS: 50, POSITIONS: 15, BASE_STORE: 100000, MAX_REPORTS: 60, START_RES: [500, 500, 0] };

const BUILD = {
 metal:{n:'Metallmine',ab:'Me',cost:[60,15,0],f:1.5,ds:'Fördert Metall, den wichtigsten Grundrohstoff.'},
 crystal:{n:'Kristallmine',ab:'Kr',cost:[48,24,0],f:1.6,ds:'Baut Kristall ab – nötig für Elektronik und Forschung.'},
 deut:{n:'Deuteriumsynthetisierer',ab:'De',cost:[225,75,0],f:1.5,ds:'Gewinnt Deuterium. Kältere Planeten produzieren mehr.'},
 solar:{n:'Solarkraftwerk',ab:'So',cost:[75,30,0],f:1.5,ds:'Liefert Energie für die Minen.'},
 robot:{n:'Roboterfabrik',ab:'Ro',cost:[400,120,200],f:2,ds:'Verkürzt die Bauzeit von Gebäuden.'},
 yard:{n:'Raumschiffwerft',ab:'Wf',cost:[400,200,100],f:2,ds:'Baut Schiffe und Verteidigung. Höhere Stufe = schneller.',req:{b:{robot:2}}},
 lab:{n:'Forschungslabor',ab:'La',cost:[200,400,200],f:2,ds:'Ermöglicht und beschleunigt Forschung.'},
 smetal:{n:'Metallspeicher',ab:'MS',cost:[1000,0,0],f:2,ds:'Erhöht die Lagerkapazität für Metall.'},
 scrystal:{n:'Kristallspeicher',ab:'KS',cost:[1000,500,0],f:2,ds:'Erhöht die Lagerkapazität für Kristall.'},
 sdeut:{n:'Deuteriumtank',ab:'DT',cost:[1000,1000,0],f:2,ds:'Erhöht die Lagerkapazität für Deuterium.'},
};
const RES = {
 energy:{n:'Energietechnik',ab:'En',cost:[0,800,400],req:{b:{lab:1}},ds:'Grundlage vieler weiterer Technologien.'},
 laser:{n:'Lasertechnik',ab:'Ls',cost:[200,100,0],req:{b:{lab:1},r:{energy:2}},ds:'Gebündeltes Licht – Basis für Laserwaffen.'},
 comb:{n:'Verbrennungstriebwerk',ab:'VT',cost:[400,0,600],req:{b:{lab:1},r:{energy:1}},ds:'+10 % Geschwindigkeit pro Stufe (Transporter, Jäger, Sonden).'},
 impulse:{n:'Impulstriebwerk',ab:'IT',cost:[2000,4000,600],req:{b:{lab:2},r:{energy:1}},ds:'+20 % pro Stufe (Schwere Jäger, Kreuzer).'},
 hyper:{n:'Hyperraumtechnik',ab:'HT',cost:[0,4000,2000],req:{b:{lab:7},r:{energy:5,shield:5}},ds:'Erschließt den Hyperraum.'},
 hdrive:{n:'Hyperraumantrieb',ab:'HA',cost:[10000,20000,6000],req:{b:{lab:7},r:{hyper:3}},ds:'+30 % pro Stufe (Schlachtschiffe).'},
 spy:{n:'Spionagetechnik',ab:'Sp',cost:[200,1000,200],req:{b:{lab:3}},ds:'Bessere Spionageberichte, bessere Abwehr.'},
 computer:{n:'Computertechnik',ab:'Co',cost:[0,400,600],req:{b:{lab:1}},ds:'+1 Flottenslot pro Stufe.'},
 weapons:{n:'Waffentechnik',ab:'Wa',cost:[800,200,0],req:{b:{lab:4}},ds:'+10 % Angriff pro Stufe.'},
 shield:{n:'Schildtechnik',ab:'Sc',cost:[200,600,0],req:{b:{lab:6},r:{energy:3}},ds:'+10 % Schilde pro Stufe.'},
 armor:{n:'Raumschiffpanzerung',ab:'Pa',cost:[1000,0,0],req:{b:{lab:2}},ds:'+10 % Strukturpunkte pro Stufe.'},
};
const SHIPS = {
 sc:{n:'Kleiner Transporter',ab:'KT',cost:[2000,2000,0],atk:5,sh:10,cargo:5000,speed:5000,fuel:10,drive:'comb',req:{b:{yard:2},r:{comb:2}}},
 lc:{n:'Großer Transporter',ab:'GT',cost:[6000,6000,0],atk:5,sh:25,cargo:25000,speed:7500,fuel:50,drive:'comb',req:{b:{yard:4},r:{comb:6}}},
 lf:{n:'Leichter Jäger',ab:'LJ',cost:[3000,1000,0],atk:50,sh:10,cargo:50,speed:12500,fuel:20,drive:'comb',req:{b:{yard:1},r:{comb:1}}},
 hf:{n:'Schwerer Jäger',ab:'SJ',cost:[6000,4000,0],atk:150,sh:25,cargo:100,speed:10000,fuel:75,drive:'impulse',req:{b:{yard:3},r:{armor:2,impulse:2}},rf:{sc:3}},
 cr:{n:'Kreuzer',ab:'Kr',cost:[20000,7000,2000],atk:400,sh:50,cargo:800,speed:15000,fuel:300,drive:'impulse',req:{b:{yard:5},r:{impulse:4,laser:4}},rf:{lf:6,rl:10}},
 bs:{n:'Schlachtschiff',ab:'SS',cost:[45000,15000,0],atk:1000,sh:200,cargo:1500,speed:10000,fuel:500,drive:'hdrive',req:{b:{yard:7},r:{hdrive:4}}},
 probe:{n:'Spionagesonde',ab:'So',cost:[0,1000,0],atk:0.01,sh:0.01,cargo:0,speed:100000000,fuel:1,drive:'comb',req:{b:{yard:3},r:{comb:3,spy:2}}},
};
const DEF = {
 rl:{n:'Raketenwerfer',ab:'RW',cost:[2000,0,0],atk:80,sh:20,req:{b:{yard:1}}},
 ll:{n:'Leichtes Lasergeschütz',ab:'LL',cost:[1500,500,0],atk:100,sh:25,req:{b:{yard:2},r:{energy:1,laser:3}}},
 hl:{n:'Schweres Lasergeschütz',ab:'SL',cost:[6000,2000,0],atk:250,sh:100,req:{b:{yard:4},r:{energy:3,laser:6}}},
 gauss:{n:'Gaußkanone',ab:'GK',cost:[20000,15000,2000],atk:1100,sh:200,req:{b:{yard:6},r:{energy:6,weapons:3,shield:1}}},
};
const UNIT = Object.assign({}, SHIPS, DEF);
const DRIVE_BONUS = {comb:0.1, impulse:0.2, hdrive:0.3};
const MISSION = {attack:'Angreifen', transport:'Transport', spy:'Spionage'};

const pid = c => `p${c.g}_${c.s}_${c.p}`;
const lvlCost = (d, L) => d.cost.map(x => Math.floor(x * Math.pow(d.f || 2, L-1)));
const capOf = L => CFG.BASE_STORE + 50000 * (Math.ceil(Math.pow(1.6, L)) - 1);
function sumLevels(d, L){ let t = 0; for (let i = 1; i <= L; i++){ const c = lvlCost(d, i); t += c[0]+c[1]+c[2]; } return t; }
const hrs = h => h * 3600000 / CFG.SPEED;
const buildTime = (c, P) => Math.max(1000, hrs((c[0]+c[1]) / (2500 * (1 + (P.b.robot||0)))));
const researchTime = (c, P) => Math.max(1000, hrs((c[0]+c[1]) / (1000 * (1 + (P.b.lab||0)))));
const unitTime = (d, P) => Math.max(1000, hrs((d.cost[0]+d.cost[1]) / (2500 * (1 + (P.b.yard||0)))));
const afford = (P, c, n=1) => P.res.m >= c[0]*n && P.res.c >= c[1]*n && P.res.d >= c[2]*n;
const pay = (P, c, n=1) => { P.res.m -= c[0]*n; P.res.c -= c[1]*n; P.res.d -= c[2]*n; };
const maxAfford = (P, c) => Math.floor(Math.min(...[0,1,2].map(i => c[i] ? P.res[['m','c','d'][i]]/c[i] : Infinity)));
function reqMissing(d, P, R){ const out = []; const q = d.req || {};
 for (const [k,l] of Object.entries(q.b||{})) if ((P.b[k]||0) < l) out.push(`${BUILD[k].n} (Stufe ${l})`);
 for (const [k,l] of Object.entries(q.r||{})) if ((R.research[k]||0) < l) out.push(`${RES[k].n} (Stufe ${l})`);
 return out; }

function prod(P){
 const L = k => P.b[k]||0, pc = k => ((P.pct||{})[k] ?? 100)/100, g = l => l*Math.pow(1.1,l), SP = CFG.SPEED;
 const eProd = 20*g(L('solar'))*pc('solar');
 const eUse = 10*g(L('metal'))*pc('metal') + 10*g(L('crystal'))*pc('crystal') + 20*g(L('deut'))*pc('deut');
 const f = eUse <= 0 ? 1 : Math.min(1, eProd/eUse);
 return { m:(20 + 30*g(L('metal'))*pc('metal')*f)*SP, c:(10 + 20*g(L('crystal'))*pc('crystal')*f)*SP,
  d:Math.max(0, 10*g(L('deut'))*(1.28-0.002*(P.temp||20))*pc('deut')*f*SP), eProd, eUse, f };
}
const caps = P => ({m:capOf(P.b.smetal||0), c:capOf(P.b.scrystal||0), d:capOf(P.b.sdeut||0)});
function accrue(P, ms){ if (ms <= 0) return; const pr = prod(P), cp = caps(P), h = ms/3600000;
 for (const k of ['m','c','d']) if (P.res[k] < cp[k]) P.res[k] = Math.min(cp[k], P.res[k] + pr[k]*h); }
const clone = o => JSON.parse(JSON.stringify(o));
function settle(src, until){
 const P = clone(src);
 P.b = P.b || {}; P.ships = P.ships || {}; P.def = P.def || {}; P.res = P.res || {m:0,c:0,d:0}; P.sq = P.sq || []; P.pct = P.pct || {};
 let t = P.t || until; until = Math.max(until, t);
 while (t < until){ let e = until; if (P.bq && P.bq.end > t && P.bq.end < e) e = P.bq.end; accrue(P, e - t); t = e;
  if (P.bq && P.bq.end <= t){ P.b[P.bq.key] = P.bq.lvl; P.bq = null; } }
 if (P.bq && P.bq.end <= until){ P.b[P.bq.key] = P.bq.lvl; P.bq = null; }
 let st = P.sqT || until;
 while (P.sq.length && st < until){ const q = P.sq[0]; const n = Math.min(q.n, Math.floor((until - st)/q.unit));
  if (n > 0){ const tgt = SHIPS[q.key] ? P.ships : P.def; tgt[q.key] = (tgt[q.key]||0) + n; q.n -= n; st += n*q.unit; }
  if (q.n <= 0) { P.sq.shift(); continue; } break; }
 P.sqT = P.sq.length ? st : null; P.t = until; return P;
}
function settleR(src, until){ const R = clone(src); R.research = R.research || {};
 if (R.rq && R.rq.end <= until){ R.research[R.rq.key] = R.rq.lvl; R.rq = null; } return R; }

function distance(a, b){ if (a.g !== b.g) return 20000*Math.abs(a.g-b.g); if (a.s !== b.s) return 2700 + 95*Math.abs(a.s-b.s); if (a.p !== b.p) return 1000 + 5*Math.abs(a.p-b.p); return 5; }
const shipSpeed = (k, R) => SHIPS[k].speed * (1 + DRIVE_BONUS[SHIPS[k].drive] * (R.research[SHIPS[k].drive]||0));
function fleetSpeed(ships, R){ let s = Infinity; for (const [k,n] of Object.entries(ships)) if (n > 0) s = Math.min(s, shipSpeed(k, R)); return s; }
const flightMs = (dist, speed, pct) => Math.round(((3500/(pct/10)) * Math.sqrt(dist*10/speed) + 10) / CFG.SPEED * 1000);
function fuelFor(ships, dist, pct){ let f = 0; for (const [k,n] of Object.entries(ships)) if (n > 0) f += SHIPS[k].fuel * n * dist/35000 * Math.pow(pct/10 + 1, 2); return Math.round(f) + 1; }
const capacity = ships => Object.entries(ships).reduce((a,[k,n]) => a + (SHIPS[k] ? SHIPS[k].cargo*n : 0), 0);
const countUnits = o => Object.values(o||{}).reduce((a,b) => a+b, 0);

function rapid(a, t){ const d = UNIT[a]; if (d.rf && d.rf[t]) return d.rf[t]; if (t === 'probe' && SHIPS[a] && a !== 'probe') return 5; return 1; }
function battle(A, D){
 const mk = (units, tech) => { const S = {k:[],h:[],mh:[],s:[],ms:[],a:[]};
  for (const [k,n] of Object.entries(units)) { const d = UNIT[k]; if (!d) continue;
   const mh = (d.cost[0]+d.cost[1])/10*(1+0.1*(tech.armor||0)), ms = d.sh*(1+0.1*(tech.shield||0)), at = d.atk*(1+0.1*(tech.weapons||0));
   for (let i = 0; i < n; i++){ S.k.push(k); S.h.push(mh); S.mh.push(mh); S.s.push(ms); S.ms.push(ms); S.a.push(at); } }
  return S; };
 let a = mk(A.units, A.tech), d = mk(D.units, D.tech), rounds = 0;
 const hit = (T, j, dmg) => { if (T.h[j] <= 0) return; if (dmg < 0.01*T.s[j]) return;
  if (T.s[j] >= dmg) T.s[j] -= dmg; else { T.h[j] -= dmg - T.s[j]; T.s[j] = 0; }
  if (T.h[j] > 0 && T.h[j] < 0.7*T.mh[j] && Math.random() > T.h[j]/T.mh[j]) T.h[j] = 0; };
 const fire = (S, T) => { const n = T.k.length; if (!n) return; for (let i = 0; i < S.k.length; i++){ let again = true;
   while (again){ const j = (Math.random()*n)|0; hit(T, j, S.a[i]); const r = rapid(S.k[i], T.k[j]); again = r > 1 && Math.random() < (r-1)/r; } } };
 const compact = S => { const N = {k:[],h:[],mh:[],s:[],ms:[],a:[]}; for (let i = 0; i < S.k.length; i++) if (S.h[i] > 0) for (const f in N) N[f].push(S[f][i]); return N; };
 for (let r = 1; r <= 6; r++){ if (!a.k.length || !d.k.length) break; rounds = r;
  a.s = a.ms.slice(); d.s = d.ms.slice(); fire(a, d); fire(d, a); a = compact(a); d = compact(d); }
 const cnt = S => S.k.reduce((o,k) => (o[k] = (o[k]||0)+1, o), {});
 const winner = !a.k.length && d.k.length ? 'def' : (!d.k.length && a.k.length ? 'att' : 'draw');
 return {winner, rounds, att:cnt(a), def:cnt(d)};
}

const GAME = { CFG, BUILD, RES, SHIPS, DEF, UNIT, DRIVE_BONUS, MISSION, pid, lvlCost, capOf, sumLevels, buildTime, researchTime, unitTime,
 afford, pay, maxAfford, reqMissing, prod, caps, settle, settleR, distance, shipSpeed, fleetSpeed, flightMs, fuelFor, capacity, countUnits, battle, clone };
if (typeof module !== 'undefined' && module.exports) module.exports = GAME; else root.GAME = GAME;
})(typeof window !== 'undefined' ? window : this);
