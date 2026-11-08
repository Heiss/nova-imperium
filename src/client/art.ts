// The art of Nova Imperium: one drawn SVG picture per building, research,
// ship and defense (own work, version 1). Shown as data: images, which the
// Content-Security-Policy allows (img-src data:).
const stars = (seed: number, n: number): string => {
  let s = seed,
    o = '';
  const r = (): number => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++)
    o += `<circle cx="${(r() * 100).toFixed(1)}" cy="${(r() * 100).toFixed(1)}" r="${(r() * 0.7 + 0.2).toFixed(2)}" fill="#fff" opacity="${(r() * 0.6 + 0.3).toFixed(2)}"/>`;
  return o;
};
const space = (
  c1: string,
  c2: string,
  seed: number,
): string => `<defs><radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
 <linearGradient id="met" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3e8f0"/><stop offset=".5" stop-color="#8a95a8"/><stop offset="1" stop-color="#3b4352"/></linearGradient>
 <linearGradient id="dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b7486"/><stop offset="1" stop-color="#232833"/></linearGradient>
 <radialGradient id="glow"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#8fd8ff"/><stop offset="1" stop-color="#2a6cff" stop-opacity="0"/></radialGradient>
 <radialGradient id="fire"><stop offset="0" stop-color="#fff6c8"/><stop offset=".35" stop-color="#ffb347"/><stop offset="1" stop-color="#ff4d1a" stop-opacity="0"/></radialGradient></defs>
 <rect width="100" height="100" fill="url(#bg)"/>${stars(seed, 26)}`;
const ground = (col: string, col2: string): string =>
  `<path d="M-5 74 Q50 62 105 74 L105 105 L-5 105Z" fill="${col}"/><path d="M-5 80 Q50 70 105 80 L105 105 L-5 105Z" fill="${col2}" opacity=".7"/>`;
const sym = (seed: number, hue: number): string =>
  space(`hsl(${hue},55%,28%)`, `hsl(${hue},60%,6%)`, seed) +
  `<circle cx="50" cy="50" r="34" fill="none" stroke="hsl(${hue},70%,70%)" stroke-opacity=".25" stroke-width="1"/><circle cx="50" cy="50" r="40" fill="none" stroke="hsl(${hue},70%,70%)" stroke-opacity=".12" stroke-width="3"/>`;
const engine = (x: number, y: number, s = 1): string =>
  `<ellipse cx="${x - 6 * s}" cy="${y}" rx="${9 * s}" ry="${3.5 * s}" fill="url(#glow)"/>`;

const ART: Record<string, string> = {
  /* ---------- Gebäude ---------- */
  metal:
    space('#3a3328', '#0b0906', 1) +
    ground('#5b4a36', '#3a2e22') +
    `<path d="M30 74 L40 30 L50 30 L60 74Z" fill="none" stroke="url(#met)" stroke-width="2.5"/><path d="M34 58 L56 58 M37 45 L53 45" stroke="#9aa3b3" stroke-width="1.5"/>
 <rect x="41" y="22" width="8" height="10" fill="url(#met)"/><path d="M45 32 L45 80" stroke="#c9ced8" stroke-width="2"/><path d="M42 80 L45 88 L48 80Z" fill="#d0d5de"/>
 <path d="M64 80 Q72 70 82 80Z" fill="#8c8f99"/><path d="M68 80 Q74 73 80 80Z" fill="#b3b7c2"/><path d="M14 82 Q20 74 28 82Z" fill="#7f838e"/><circle cx="45" cy="21" r="2" fill="#ffcc55"/>`,
  crystal:
    space('#1d3a55', '#04101c', 2) +
    ground('#2c3d52', '#1a2636') +
    `<path d="M50 78 L42 50 L50 22 L58 50Z" fill="#6fd3ff" opacity=".95"/><path d="M50 22 L58 50 L50 78Z" fill="#2c8fd0"/>
 <path d="M36 80 L28 60 L33 42 L40 60Z" fill="#9ee4ff"/><path d="M33 42 L40 60 L36 80Z" fill="#3a9fdc"/>
 <path d="M64 80 L60 62 L66 46 L72 62Z" fill="#8adcff"/><path d="M66 46 L72 62 L64 80Z" fill="#3290cc"/>
 <circle cx="50" cy="40" r="18" fill="url(#glow)" opacity=".45"/><path d="M47 30 L49 44" stroke="#fff" stroke-width="1.2" opacity=".8"/>`,
  deut:
    space('#173a2c', '#030f0a', 3) +
    ground('#2b3a33', '#1b2621') +
    `<rect x="22" y="44" width="22" height="34" rx="3" fill="url(#met)"/><rect x="26" y="50" width="14" height="22" rx="2" fill="#1f6b48"/><rect x="26" y="58" width="14" height="14" rx="2" fill="#4ff0a0"/>
 <circle cx="66" cy="54" r="16" fill="url(#met)"/><circle cx="66" cy="54" r="11" fill="#1f6b48"/><path d="M55 58 A11 11 0 0 0 77 58Z" fill="#4ff0a0"/>
 <path d="M44 66 L56 66 M66 70 L66 80 M33 44 L33 36 L66 36 L66 38" stroke="#9aa3b3" stroke-width="2.2" fill="none"/><circle cx="66" cy="54" r="20" fill="#4ff0a0" opacity=".08"/>`,
  solar:
    space('#3b3415', '#0d0b03', 4) +
    ground('#4a4636', '#2e2b20') +
    `<circle cx="78" cy="20" r="9" fill="#ffd95a"/><circle cx="78" cy="20" r="16" fill="#ffd95a" opacity=".2"/>
 <g transform="skewX(-18)"><rect x="30" y="50" width="26" height="16" fill="#1d3f8a" stroke="#9fb6e8" stroke-width="1"/><path d="M38.7 50 V66 M47.3 50 V66 M30 58 H56" stroke="#9fb6e8" stroke-width=".7"/>
 <rect x="58" y="56" width="24" height="14" fill="#1d3f8a" stroke="#9fb6e8" stroke-width="1"/><path d="M66 56 V70 M74 56 V70 M58 63 H82" stroke="#9fb6e8" stroke-width=".7"/></g>
 <path d="M30 66 L30 78 M57 70 L57 80" stroke="#8a95a8" stroke-width="2"/><path d="M20 58 L40 52" stroke="#fff" stroke-width=".8" opacity=".5"/>`,
  robot:
    space('#352b3e', '#0b0810', 5) +
    ground('#444050', '#2b2833') +
    `<path d="M14 76 L14 46 L30 38 L30 46 L46 38 L46 46 L62 38 L62 76Z" fill="url(#dark)" stroke="#8a95a8" stroke-width="1"/>
 <rect x="20" y="58" width="8" height="6" fill="#ffcc55"/><rect x="36" y="58" width="8" height="6" fill="#ffcc55"/><rect x="66" y="30" width="6" height="46" fill="url(#met)"/>
 <path d="M69 38 L82 50 L76 62" stroke="#ff9a3c" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="82" cy="50" r="3.5" fill="#d0d5de"/><path d="M73 62 L79 62 M76 62 L76 67" stroke="#d0d5de" stroke-width="2"/>
 <circle cx="69" cy="38" r="3" fill="#d0d5de"/><path d="M50 30 Q53 22 50 14" stroke="#9aa3b3" stroke-width="2" fill="none" opacity=".5"/>`,
  yard:
    space('#1c2a45', '#03060e', 6) +
    ground('#333a48', '#20252f') +
    `<path d="M12 78 L12 26 L88 26 L88 78" fill="none" stroke="#ffb347" stroke-width="3"/><path d="M12 26 L24 38 M88 26 L76 38 M12 40 L20 34 M88 40 L80 34" stroke="#ffb347" stroke-width="1.5"/>
 <path d="M28 58 L62 50 L76 56 L62 62 L28 60Z" fill="url(#met)"/><path d="M40 55 L36 46 L48 52Z" fill="#9aa3b3"/><path d="M40 61 L36 68 L48 62Z" fill="#9aa3b3"/>
 <path d="M50 26 L50 46" stroke="#cfd6e3" stroke-width="1"/><circle cx="50" cy="48" r="2" fill="#7fe0ff"/><circle cx="50" cy="48" r="6" fill="url(#glow)" opacity=".7"/>`,
  lab:
    space('#2c2346', '#07050f', 7) +
    ground('#3a3650', '#262335') +
    `<path d="M24 74 A26 26 0 0 1 76 74Z" fill="url(#met)"/><path d="M30 74 A20 20 0 0 1 70 74" fill="none" stroke="#5d6a80" stroke-width="1"/>
 <path d="M40 74 A10 10 0 0 1 60 74" fill="#7fe0ff" opacity=".9"/><path d="M50 48 L50 30" stroke="#cfd6e3" stroke-width="2"/><path d="M42 30 Q50 22 58 30" fill="none" stroke="#cfd6e3" stroke-width="2"/>
 <circle cx="50" cy="30" r="2" fill="#ff6b6b"/><path d="M60 22 Q66 26 64 32 M64 18 Q72 24 69 34" stroke="#8fd8ff" stroke-width="1" fill="none" opacity=".7"/>`,
  smetal:
    space('#33302c', '#0a0908', 8) +
    ground('#4c4740', '#302c27') +
    `<rect x="22" y="36" width="24" height="42" rx="4" fill="url(#met)"/><rect x="54" y="44" width="24" height="34" rx="4" fill="url(#met)"/><path d="M22 48 H46 M22 60 H46 M54 56 H78 M54 66 H78" stroke="#5d6676" stroke-width="1.5"/><rect x="30" y="30" width="8" height="6" fill="#8a95a8"/>`,
  scrystal:
    space('#1b3046', '#040b14', 9) +
    ground('#2c3d52', '#1a2636') +
    `<rect x="22" y="36" width="24" height="42" rx="4" fill="url(#met)"/><rect x="54" y="44" width="24" height="34" rx="4" fill="url(#met)"/><rect x="27" y="44" width="14" height="28" rx="2" fill="#4fb8ff" opacity=".85"/><rect x="59" y="52" width="14" height="20" rx="2" fill="#4fb8ff" opacity=".85"/><path d="M34 48 L30 58 L38 58Z M66 56 L62 64 L70 64Z" fill="#c8f0ff"/>`,
  sdeut:
    space('#17342a', '#030c08', 10) +
    ground('#2b3a33', '#1b2621') +
    `<ellipse cx="50" cy="58" rx="30" ry="20" fill="url(#met)"/><ellipse cx="50" cy="60" rx="22" ry="13" fill="#1f6b48"/><path d="M28 62 A22 13 0 0 0 72 62 L72 60 A22 6 0 0 1 28 60Z" fill="#4ff0a0"/><path d="M24 76 L30 70 M76 76 L70 70 M50 78 L50 72" stroke="#8a95a8" stroke-width="3"/>`,

  /* ---------- Forschung ---------- */
  energy:
    sym(11, 45) +
    `<path d="M56 18 L36 54 L50 54 L42 82 L66 42 L52 42Z" fill="#ffd95a" stroke="#fff3c0" stroke-width="1.2"/><circle cx="50" cy="50" r="30" fill="#ffd95a" opacity=".08"/>`,
  laser:
    sym(12, 0) +
    `<path d="M10 50 L46 50" stroke="#ff5050" stroke-width="2"/><ellipse cx="50" cy="50" rx="5" ry="16" fill="#9fd8ff" opacity=".75" stroke="#dff" stroke-width="1"/><path d="M54 50 L92 50" stroke="#ff2a2a" stroke-width="5"/><path d="M54 50 L92 50" stroke="#fff" stroke-width="1.5"/><circle cx="90" cy="50" r="7" fill="#ff5050" opacity=".4"/>`,
  comb:
    sym(13, 20) +
    `<path d="M24 38 L52 42 L52 58 L24 62Z" fill="url(#met)"/><path d="M52 40 L60 34 L60 66 L52 60Z" fill="url(#dark)"/><ellipse cx="74" cy="50" rx="16" ry="11" fill="url(#fire)"/><ellipse cx="66" cy="50" rx="7" ry="6" fill="#fff6c8" opacity=".8"/>`,
  impulse:
    sym(14, 200) +
    `<path d="M22 40 L48 44 L48 56 L22 60Z" fill="url(#met)"/><ellipse cx="54" cy="50" rx="3" ry="12" fill="none" stroke="#8fd8ff" stroke-width="2.5"/><ellipse cx="64" cy="50" rx="3" ry="16" fill="none" stroke="#8fd8ff" stroke-width="2" opacity=".7"/><ellipse cx="76" cy="50" rx="3" ry="20" fill="none" stroke="#8fd8ff" stroke-width="1.5" opacity=".4"/><circle cx="50" cy="50" r="6" fill="url(#glow)"/>`,
  hyper:
    sym(15, 270) +
    `<g fill="none" stroke="#c8a2ff" stroke-width="1"><ellipse cx="50" cy="50" rx="34" ry="14"/><ellipse cx="50" cy="50" rx="24" ry="9" opacity=".8"/><ellipse cx="50" cy="50" rx="14" ry="5" opacity=".6"/><path d="M16 50 Q50 30 84 50 M16 50 Q50 70 84 50" opacity=".5"/></g><circle cx="50" cy="50" r="5" fill="#fff"/><circle cx="50" cy="50" r="12" fill="#b38cff" opacity=".4"/>`,
  hdrive:
    sym(16, 285) +
    `<path d="M50 50 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 1 1 8 8 a12 12 0 1 1 -12 -12 a16 16 0 1 1 16 16 a20 20 0 1 1 -20 -20 a24 24 0 1 1 24 24" fill="none" stroke="#d6b8ff" stroke-width="2"/><circle cx="50" cy="50" r="3" fill="#fff"/>`,
  spy:
    sym(17, 30) +
    `<path d="M14 50 Q50 18 86 50 Q50 82 14 50Z" fill="#1a1a24" stroke="#ffb347" stroke-width="2"/><circle cx="50" cy="50" r="14" fill="#ffb347"/><circle cx="50" cy="50" r="7" fill="#120d05"/><circle cx="46" cy="46" r="2.5" fill="#fff"/>`,
  computer:
    sym(18, 160) +
    `<rect x="30" y="30" width="40" height="40" rx="3" fill="#163a35" stroke="#5fe0c8" stroke-width="1.5"/><rect x="40" y="40" width="20" height="20" fill="#5fe0c8" opacity=".85"/><g stroke="#5fe0c8" stroke-width="2"><path d="M36 30 V20 M44 30 V20 M52 30 V20 M60 30 V20 M36 70 V80 M44 70 V80 M52 70 V80 M60 70 V80 M30 38 H20 M30 46 H20 M30 54 H20 M30 62 H20 M70 38 H80 M70 46 H80 M70 54 H80 M70 62 H80"/></g>`,
  weapons:
    sym(19, 355) +
    `<circle cx="50" cy="50" r="22" fill="none" stroke="#ff6b6b" stroke-width="2.5"/><circle cx="50" cy="50" r="10" fill="none" stroke="#ff6b6b" stroke-width="1.5"/><path d="M50 18 V36 M50 64 V82 M18 50 H36 M64 50 H82" stroke="#ff6b6b" stroke-width="2.5"/><circle cx="50" cy="50" r="2.5" fill="#fff"/>`,
  shield:
    sym(20, 205) +
    `<path d="M50 16 L78 26 L76 54 Q70 74 50 84 Q30 74 24 54 L22 26Z" fill="#2a6cff" fill-opacity=".35" stroke="#8fd8ff" stroke-width="2.5"/><path d="M50 30 L62 37 L62 51 L50 58 L38 51 L38 37Z" fill="none" stroke="#cdeeff" stroke-width="1.5"/>`,
  armor:
    sym(21, 215) +
    `<path d="M20 32 L50 22 L80 32 L80 46 L50 36 L20 46Z" fill="url(#met)"/><path d="M20 50 L50 40 L80 50 L80 64 L50 54 L20 64Z" fill="url(#met)"/><path d="M20 68 L50 58 L80 68 L80 74 L50 84 L20 74Z" fill="url(#met)"/><g fill="#3b4352"><circle cx="28" cy="38" r="1.5"/><circle cx="72" cy="38" r="1.5"/><circle cx="28" cy="56" r="1.5"/><circle cx="72" cy="56" r="1.5"/></g>`,

  /* ---------- Schiffe ---------- */
  sc:
    space('#14233d', '#02050c', 31) +
    engine(30, 52) +
    `<path d="M30 46 L64 44 L76 52 L64 60 L30 58Z" fill="url(#met)"/><rect x="38" y="47" width="18" height="10" fill="#c88a3a" stroke="#6b4a1e" stroke-width=".8"/><path d="M64 48 L72 52 L64 56Z" fill="#7fe0ff"/>`,
  lc:
    space('#14233d', '#02050c', 32) +
    engine(18, 46, 1.2) +
    engine(18, 60, 1.2) +
    `<path d="M18 40 L68 38 L86 53 L68 68 L18 66Z" fill="url(#met)"/><rect x="26" y="43" width="14" height="20" fill="#c88a3a" stroke="#6b4a1e" stroke-width=".8"/><rect x="42" y="43" width="14" height="20" fill="#c88a3a" stroke="#6b4a1e" stroke-width=".8"/><path d="M68 46 L80 53 L68 60Z" fill="#7fe0ff"/>`,
  colony:
    space('#183c3e', '#050b14', 38) +
    engine(20, 42, 1.1) +
    engine(20, 58, 1.1) +
    `<path d="M19 37 L58 33 L86 50 L58 67 L19 63Z" fill="url(#met)"/><path d="M25 40 L36 23 L64 35 M25 60 L36 77 L64 65" fill="url(#dark)"/>
 <path d="M38 49 Q38 35 52 35 Q66 35 66 49 L66 55 L38 55Z" fill="#71d6ab" stroke="#d3ece8"/><path d="M35 57 H69 M41 62 H63" stroke="#27474d" stroke-width="3"/><path d="M71 46 L81 50 L71 54Z" fill="#7fe0ff"/>`,
  lf:
    space('#1a1f3d', '#03040c', 33) +
    engine(30, 50) +
    `<path d="M30 48 L58 46 L76 50 L58 54 L30 52Z" fill="url(#met)"/><path d="M40 47 L32 30 L48 46Z M40 53 L32 70 L48 54Z" fill="#8a95a8"/><path d="M58 48 L66 50 L58 52Z" fill="#7fe0ff"/><path d="M33 31 L33 36 M33 69 L33 64" stroke="#ff6b6b" stroke-width="2"/>`,
  hf:
    space('#1a1f3d', '#03040c', 34) +
    engine(26, 44) +
    engine(26, 56) +
    `<path d="M26 42 L60 42 L80 50 L60 58 L26 58Z" fill="url(#met)"/><path d="M36 42 L28 22 L54 42Z M36 58 L28 78 L54 58Z" fill="url(#dark)"/><path d="M60 46 L72 50 L60 54Z" fill="#7fe0ff"/><path d="M29 24 L50 24 M29 76 L50 76" stroke="#ff6b6b" stroke-width="2"/>`,
  cr:
    space('#25173d', '#06030c', 35) +
    engine(14, 50, 1.3) +
    `<path d="M14 44 L70 42 L92 50 L70 58 L14 56Z" fill="url(#met)"/><path d="M28 44 L22 32 L50 43Z M28 56 L22 68 L50 57Z" fill="url(#dark)"/><rect x="40" y="46" width="22" height="8" fill="#3b4352"/><path d="M48 42 L48 36 L60 36" stroke="#cfd6e3" stroke-width="2" fill="none"/><path d="M70 47 L84 50 L70 53Z" fill="#7fe0ff"/>`,
  bs:
    space('#2a1530', '#07030a', 36) +
    engine(10, 40, 1.3) +
    engine(10, 60, 1.3) +
    engine(12, 50, 1.1) +
    `<path d="M10 36 L66 32 L94 50 L66 68 L10 64Z" fill="url(#met)"/><path d="M24 36 L18 20 L56 34Z M24 64 L18 80 L56 66Z" fill="url(#dark)"/><rect x="30" y="44" width="34" height="12" fill="#3b4352"/><path d="M40 38 L62 38 M40 62 L62 62" stroke="#cfd6e3" stroke-width="3"/><path d="M66 44 L86 50 L66 56Z" fill="#7fe0ff"/><circle cx="36" cy="50" r="2" fill="#ff6b6b"/>`,
  probe:
    space('#14233d', '#02050c', 37) +
    `<circle cx="50" cy="50" r="12" fill="url(#met)"/><circle cx="50" cy="50" r="5" fill="#ff6b6b"/><circle cx="50" cy="50" r="9" fill="#ff6b6b" opacity=".25"/><path d="M50 38 L50 20 M41 58 L28 74 M59 58 L72 74 M38 46 L22 40" stroke="#cfd6e3" stroke-width="1.5"/><circle cx="50" cy="19" r="2" fill="#7fe0ff"/><path d="M58 22 Q66 26 64 34" stroke="#7fe0ff" stroke-width="1" fill="none" opacity=".6"/>`,

  /* ---------- Verteidigung ---------- */
  rl:
    space('#2f2520', '#0a0706', 41) +
    ground('#4a4036', '#2e2822') +
    `<rect x="30" y="64" width="40" height="12" rx="2" fill="url(#dark)"/><g transform="rotate(-30 50 60)"><rect x="34" y="46" width="32" height="18" rx="2" fill="url(#met)"/><g fill="#2a2f3a"><circle cx="42" cy="52" r="2.5"/><circle cx="50" cy="52" r="2.5"/><circle cx="58" cy="52" r="2.5"/><circle cx="42" cy="59" r="2.5"/><circle cx="50" cy="59" r="2.5"/><circle cx="58" cy="59" r="2.5"/></g></g><path d="M66 30 L78 20" stroke="#ffb347" stroke-width="2"/><circle cx="80" cy="18" r="4" fill="url(#fire)"/>`,
  ll:
    space('#2f2020', '#0a0606', 42) +
    ground('#4a3a36', '#2e2522') +
    `<path d="M34 76 L40 60 L60 60 L66 76Z" fill="url(#dark)"/><circle cx="50" cy="58" r="10" fill="url(#met)"/><path d="M56 54 L80 38" stroke="#cfd6e3" stroke-width="4" stroke-linecap="round"/><path d="M80 38 L96 28" stroke="#ff3a3a" stroke-width="2.5"/><circle cx="82" cy="37" r="4" fill="#ff5050" opacity=".6"/>`,
  hl:
    space('#331a1a', '#0c0505', 43) +
    ground('#4a3a36', '#2e2522') +
    `<path d="M26 78 L34 58 L66 58 L74 78Z" fill="url(#dark)"/><circle cx="50" cy="54" r="15" fill="url(#met)"/><path d="M58 48 L86 30" stroke="#cfd6e3" stroke-width="7" stroke-linecap="round"/><path d="M58 52 L86 34" stroke="#3b4352" stroke-width="2"/><path d="M86 30 L100 21" stroke="#ff2a2a" stroke-width="4"/><path d="M86 30 L100 21" stroke="#fff" stroke-width="1"/><circle cx="50" cy="54" r="5" fill="#ff5050"/>`,
  gauss:
    space('#1a2333', '#04070c', 44) +
    ground('#3a4250', '#252a33') +
    `<path d="M24 78 L32 60 L68 60 L76 78Z" fill="url(#dark)"/><rect x="38" y="48" width="22" height="16" rx="3" fill="url(#met)"/><g transform="rotate(-24 50 56)"><rect x="56" y="50" width="42" height="5" fill="url(#met)"/><rect x="56" y="57" width="42" height="5" fill="url(#met)"/><path d="M62 56 H96" stroke="#7fe0ff" stroke-width="1.5"/><path d="M66 49 V63 M74 49 V63 M82 49 V63" stroke="#3b4352" stroke-width="1.5"/></g><circle cx="94" cy="36" r="6" fill="url(#glow)"/>`,
};
const cache: Record<string, string> = {};

export function artURI(key: string): string | null {
  const svg = ART[key];
  if (!svg) return null;
  cache[key] ??=
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${svg}</svg>`,
    );
  return cache[key];
}

export const ART_KEYS = Object.keys(ART);
