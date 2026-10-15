/* 7.44 (Omar): Hues and Cues, a colour-guessing party game as a game mode (framework drafted 2026-10-14, then "build with look 1 and your recommendations": Paint Chip look). Everyone joins once from their phone
   (hues.html at /h?r=ROOM, one name), 3 to 10 players. The board is 660 shades (30 columns of hue by 22 rows: 16 vivid rows from pale to dark, with 3 pastel rows above fading to white and 3 rows below fading to brown and black), drawn by the code, so every phone and the TV show the same colours.
   Each turn one player is the clue giver: the game deals them a card of 4 shades (at least 6 squares apart) on their phone only, they tap one as the secret target and type a one-word clue. Everyone else taps a
   square on their own copy of the board and locks it in (a tap on the small board opens a 7 x 5 close-up for the exact square). Markers stay hidden until everyone has locked in (or the timer ends), then they drop onto
   the TV board together. The clue giver, who now sees where they landed, types a second clue of one or two words and everybody places a second marker. The reveal draws the scoring frame on the TV.
   Points (kept across turns): a marker on the target 300, inside the 3 x 3 frame 200, on the ring just outside it (the 5 x 5) 100; both markers count. The clue giver gets 100 for every marker inside the 3 x 3,
   at most 900 a turn. Two markers can sit on the same square. Turns each: Auto (2 each for 3 to 6 players, 1 each for 7 to 10), 1 or 2. Timers (setup, 0 = off): send clue 1 (60 s), send clue 2 (45 s), each guess (30 s).
   Clue rules, checked on the clue giver's phone and again here: clue 1 is one word, clue 2 is one or two; no colour names (English, and Egyptian Arabic in English letters or Arabic script), no light/dark/pale/bright,
   no numbers, no board positions (top, left, corner...). For 5 s after a clue shows, every guesser's phone has a Flag button: more than half of the guessers flagging strikes the clue and the giver gets a new one;
   a second struck clue in the same turn ends the turn with no points. A clue giver who runs out of time before clue 1 skips the turn; one who misses clue 2 gets the reveal scored on the first markers only.
   The winner screen plays the Siuuu clip. Look: Paint Chip (his pick of three previews: Paint Chip, Gallery Night, Mashrabiya Tiles; only this one is built): a paint shop's colour fan, white card, square chips with white
   gaps, black Big Shoulders capitals and typewriter-style (Share Tech Mono) codes. The TV is one stage sized by --u (100 units = the screen's width at 16:9). hues.html (the phones) uses the same palette.
   The laptop is the referee. It posts the table with POST /api/crd (pub = what every phone may see, priv = the clue giver's card and secret target) and reads the phones' moves from GET /api/crdacts, the same
   generic relay Taboo, Fake Artist and the card modes use. The secret shade is only in the posted table from the reveal on (and in the clue giver's own private part). Needs the Cloudflare link: there is no
   one-screen version (the card must be private and everyone needs a finger). Setup is saved on this device in jn_hcCfg; a game is not saved. It doesn't use the clue card or the Jeopardy scores; app.js only calls hcLeave from showHome.
   The rules and the state of a game live in HCR below (no screen code in it, so v4work/tools/hues-test.js can load just that region). The banned-word check is repeated in hues.html (the phone), and the test compares the two.
   To remove: delete this file, hues.html, v4work/tools/hues-test.js and hues-e2e.js, the 7.44 CSS block and #hco section in head.html, the Hues and Cues button and the modeHc entry in title.js and titlebg.js (and in
   v4work/tools/titlebg-gen.py), the /h route in worker/index.js, hues.html in wrangler.jsonc, 'hues' in MODE_FILES in build.js and the hcLeave() call in showHome. */

/*@rules*/
const HCR = (() => {
  const COLS = 30, ROWS = 22, FLAG_MS = 5000;
  const BAN = {   // reason -> the words (lower case, letters only); a clue is refused if any of its words is here
    colour: "red reds reddish blue blues bluish green greens greenish yellow yellows yellowish orange oranges orangey purple purples purplish violet pink pinks pinkish brown browns brownish grey greys greyish gray grays grayish black blacks blackish white whites whitish colour color colours colors shade shades hue hues tint a7mar ahmar ahmer ahmr 7amra hamra azra2 azraq azrak zar2a zarqa akhdar a5dar akhdr khadra asfar asfr safra bonni bonny bunni benni ramadi ramady rmady eswed aswad aswd sooda abyad abyadh abiad abyd beda banafsegy banafsagy banafsegi bnfsgy bembe pembe bamba bortoaly bortoali burtu2ali bortoqaly احمر حمرا ازرق زرقا اخضر خضرا اصفر صفرا اسود سودا ابيض بيضا بني برتقالي بنفسجي وردي رمادي",
    light: "light lighter lightest dark darker darkest pale paler bright brighter deep fate7 fateh fatih ghame2 ghamek ghameq ghamiq فاتح غامق",
    pos: "top bottom left right middle center centre corner edge row rows column columns"
  };
  const WHY = {colour:"No colour names.", light:"No light, dark or pale.", pos:"No board positions."};
  const SET = {}; Object.keys(BAN).forEach(k => BAN[k].split(" ").forEach(w => { SET[w] = k; }));
  const word = w => String(w).normalize("NFD").replace(/[\u0300-\u036f\u064b-\u065f]/g, "").toLowerCase().replace(/[\u0623\u0625\u0622]/g, "\u0627").replace(/[^a-z0-9\u0600-\u06ff]+/g, "");
  function check(text, max){   // "" if the clue is fine, else why not. max = 1 for the first clue, 2 for the second
    const t = String(text == null ? "" : text).trim().replace(/\s+/g, " "); if(!t) return "Type a clue.";
    const ws = t.split(" "); if(max === 1 ? ws.length !== 1 : ws.length > 2) return max === 1 ? "One word only." : "Two words at most.";
    for(const w of ws){ const k = SET[word(w)]; if(k) return WHY[k]; }
    if(/\d/.test(t)) return "No numbers."; if(t.length > 24) return "Too long."; return ""; }
  const clean = t => String(t).trim().replace(/\s+/g, " ").slice(0, 24);
  const shade = (c, r) => { const h = (c * 12) % 360; if(r < 3){ const e = [[91, 38], [84, 62], [77, 80]][r]; return `hsl(${h} ${e[1]}% ${e[0]}%)`; }   /* 7.44 (Omar, option D): rows A-C fade up to near-white, rows T-V fade down to brown and black, each column keeping its hue; the vivid part is rows D-S. Before, ROWS was 16 starting at the vivid ramp */
  if(r >= 19){ const e = [[24, 72], [17, 52], [9, 34]][r - 19]; return `hsl(${h} ${e[1]}% ${e[0]}%)`; }
  r -= 3; const t = r / 15, l = 70 - t * 40, s = 92 + t * 8;   /* vivid (Omar: "make colors more vivid"): saturation 92-100% and lightness 70 down to 30; the mockup was paler (l = 92 - t * 72, s = t < .5 ? 55 + t * 80 : 95 - (t - .5) * 60); 7.44 first build: l = 88 - t * 62, s = t < .5 ? 80 + t * 40 : 100 */
    return `hsl(${h} ${s.toFixed(1)}% ${l.toFixed(1)}%)`; };
  const dist = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  const pts = d => d === 0 ? 300 : d === 1 ? 200 : d === 2 ? 100 : 0;
  function dealCard(rnd){   // 4 shades at least 6 squares apart
    const cs = []; for(let i = 0; i < 600 && cs.length < 4; i++){ const c = [Math.floor(rnd() * COLS), Math.floor(rnd() * ROWS)]; if(cs.every(x => dist(x, c) >= 6)) cs.push(c); }
    while(cs.length < 4) cs.push([Math.floor(rnd() * COLS), Math.floor(rnd() * ROWS)]); return cs; }
  /* o = {players:[ids] (3 or more), turns:0 (auto) | 1 | 2, t1, t2, tg:seconds (0 = off), rand:() => 0..1}. Phases: pick (clue 1) > g1 (first markers) > pick2 (clue 2) > g2 > reveal > next turn or over. */
  function Game(o){
    const ids = o.players.slice(); if(ids.length < 3) return null;
    const rnd = o.rand || Math.random, T = {t1:(o.t1 == null ? 60 : o.t1) * 1000, t2:(o.t2 == null ? 45 : o.t2) * 1000, tg:(o.tg == null ? 30 : o.tg) * 1000};
    const per = o.turns || (ids.length <= 6 ? 2 : 1), seq = []; for(let k = 0; k < per; k++) ids.forEach(p => seq.push(p));
    const g = {ids, seq, ti:0, ph:"pick", giver:null, card:null, tgt:null, c1:"", c2:"", marks:[{}, {}], flags:{}, nflag:0, rej:null, tid:0, dl:0, tot:0, fl:0, kind:null, deltas:null};
    const arm = (now, ms) => { g.tot = ms; g.dl = ms ? now + ms : 0; };
    const guessers = () => ids.filter(p => p !== g.giver), live = () => g.ph === "g1" || g.ph === "g2";
    const lockedAll = () => { const m = g.marks[g.ph === "g1" ? 0 : 1]; return guessers().every(p => m[p]); };
    function deal(now){ while(g.ti < seq.length && !ids.includes(seq[g.ti])) g.ti++;
      if(g.ti >= seq.length){ g.ph = "over"; g.tid++; g.dl = 0; g.fl = 0; return; }
      Object.assign(g, {ph:"pick", giver:seq[g.ti], card:dealCard(rnd), tgt:null, c1:"", c2:"", marks:[{}, {}], flags:{}, nflag:0, rej:null, deltas:null, kind:null, fl:0}); g.tid++; arm(now, T.t1); }
    const toGuess = (now, second) => { g.ph = second ? "g2" : "g1"; g.flags = {}; g.rej = null; g.tid++; arm(now, T.tg); g.fl = now + FLAG_MS; };
    function finish(kind){ g.ph = "reveal"; g.kind = kind; g.tid++; g.dl = 0; g.fl = 0; const d = {}; ids.forEach(p => d[p] = 0); let inside = 0;
      if(kind !== "skip" && g.tgt) g.marks.forEach(m => Object.keys(m).forEach(p => { if(!ids.includes(p)) return; const k = dist(m[p], g.tgt); d[p] += pts(k); if(k <= 1) inside++; }));
      d[g.giver] = Math.min(900, inside * 100); g.deltas = d; }
    const endGuess = now => { if(g.ph === "g1"){ g.ph = "pick2"; g.flags = {}; g.rej = null; g.tid++; arm(now, T.t2); g.fl = 0; } else finish("done"); };
    g.begin = now => { deal(now); return true; };
    g.pick = (p, i, text, now) => { if(g.ph !== "pick" || p !== g.giver) return false; if(!g.tgt && !(i >= 0 && i < 4)) return false;
      const why = check(text, 1); if(why){ g.rej = {tid:g.tid, why}; return false; }
      if(!g.tgt) g.tgt = g.card[i]; g.c1 = clean(text); toGuess(now, false); return true; };
    g.clue2 = (p, text, now) => { if(g.ph !== "pick2" || p !== g.giver) return false; const why = check(text, 2); if(why){ g.rej = {tid:g.tid, why}; return false; }
      g.c2 = clean(text); toGuess(now, true); return true; };
    g.mark = (p, c, r, now) => { if(!live() || p === g.giver || !ids.includes(p)) return false; if(!Number.isInteger(c) || !Number.isInteger(r) || c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
      const m = g.marks[g.ph === "g1" ? 0 : 1]; if(m[p]) return false; m[p] = [c, r]; if(lockedAll()) endGuess(now); return true; };
    g.flag = (p, now) => { if(!live() || p === g.giver || !ids.includes(p) || g.flags[p] || (g.fl && now > g.fl)) return false; g.flags[p] = 1;
      if(Object.keys(g.flags).length * 2 <= guessers().length) return true;
      g.nflag++; if(g.nflag >= 2){ finish("skip"); return true; }
      const first = g.ph === "g1"; if(first){ g.ph = "pick"; g.c1 = ""; g.marks[0] = {}; } else { g.ph = "pick2"; g.c2 = ""; g.marks[1] = {}; }
      g.flags = {}; g.tid++; g.rej = {tid:g.tid, why:"Your clue was flagged. Send a new one."}; arm(now, (first ? T.t1 : T.t2) ? 30000 : 0); g.fl = 0; return true; };
    g.timeout = now => { if(g.ph === "pick") finish("skip"); else if(g.ph === "pick2") finish("late"); else if(live()) endGuess(now); else return false; return true; };
    g.tick = now => g.dl && now >= g.dl ? g.timeout(now) : false;
    g.next = now => { if(g.ph !== "reveal") return false; g.ti++; deal(now); return true; };
    g.drop = (p, now) => { const i = ids.indexOf(p); if(i < 0) return false; ids.splice(i, 1);
      if(ids.length < 3){ g.ph = "over"; g.tid++; g.dl = 0; g.fl = 0; return true; }
      if(p === g.giver && g.ph !== "reveal" && g.ph !== "over") finish("skip"); else if(live() && lockedAll()) endGuess(now); return true; };
    return g; }
  return {Game, check, shade, dist, pts, BAN, COLS, ROWS, FLAG_MS, word};
})();
/*@end-rules*/

const HC = {cfg:null, room:null, players:[], col:{}, scores:{}, g:null, over:false, since:0, busy:false, poll:null, tmr:null, psig:"", relay:null, sung:false, n:0, vc:0, scored:0, anim:null, raf:0};
HC.cfg = Object.assign({turns:0, t1:60, t2:45, tg:30}, store.get("jn_hcCfg", {}));
const hcSave = () => store.set("jn_hcCfg", HC.cfg);
const HC_COL = ["#ff2e4c", "#1e90ff", "#1fcf5a", "#ffb300", "#a64dff", "#ff4fb8", "#00d4d4", "#ff7a1a", "#c6ff3d", "#8a8f98"];
const HC_LET = "ABCDEFGHIJKLMNOPQRSTUV";
const hcUrl = () => new URL(`h?r=${HC.room}`, location.href).href;
const hcName = p => { const x = HC.players.find(y => y.p === p); return x ? x.n : ""; };
const hcCol = p => HC_COL[(HC.col[p] || 0) % HC_COL.length];
const hcCode = t => t ? HC_LET[t[1]] + (t[0] + 1) : "";
const hcInit = p => (hcName(p).trim().charAt(0) || "?").toUpperCase();

/* ---------- players ---------- */
function hcSync(){   // every player keeps one colour for the whole night; a colour frees up when its player leaves
  const ids = new Set(HC.players.map(x => x.p)); Object.keys(HC.col).forEach(p => { if(!ids.has(p)) delete HC.col[p]; }); Object.keys(HC.scores).forEach(p => { if(!ids.has(p) && !HC.g) delete HC.scores[p]; });
  HC.players.forEach(x => { if(HC.col[x.p] != null) return; const used = new Set(Object.values(HC.col)); let k = 0; while(used.has(k)) k++; HC.col[x.p] = k; }); }

/* ---------- talking to the phones ---------- */
function hcPub(){
  const g = HC.g, names = {}; HC.players.forEach(x => names[x.p] = x.n);
  const pub = {ph:HC.over ? "over" : g ? g.ph : "lobby", names, col:HC.col, scores:HC.scores, ban:HCR.BAN};
  if(!g) return pub;
  const now = Date.now(); Object.assign(pub, {giver:g.giver, tid:g.tid, turn:g.ti + 1, turns:g.seq.length, c1:g.c1, c2:g.c2, flags:Object.keys(g.flags).length, nflag:g.nflag, struck:g.nflag > 0});
  if(g.rej && g.rej.tid === g.tid) pub.rej = g.rej.why;
  if(g.dl){ pub.left = Math.max(0, (g.dl - now) / 1000); pub.tot = g.tot / 1000; }
  if(g.fl) pub.fl = Math.max(0, (g.fl - now) / 1000);
  if(g.ph === "g1") pub.locked = Object.keys(g.marks[0]); if(g.ph === "g2") pub.locked = Object.keys(g.marks[1]);
  if(g.ph === "pick2" || g.ph === "g2" || g.ph === "reveal") pub.m1 = g.marks[0];
  if(g.ph === "reveal"){ Object.assign(pub, {m2:g.marks[1], tgt:g.tgt, kind:g.kind, deltas:g.deltas, last:g.ti === g.seq.length - 1}); }
  if(HC.over) pub.winners = hcWinners();
  return pub; }
function hcPost(){
  if(RELAY !== true) return; const g = HC.g, priv = {}, pub = hcPub(); pub.v = ++HC.vc;
  if(g && g.ph !== "reveal" && g.ph !== "over" && g.giver) priv[g.giver] = {giver:1, card:g.card, tgt:g.tgt};
  fetch("api/crd", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:HC.room, crd:{pub, priv}})}).catch(() => {}); }
async function hcPoll(){ if($("#hco").hidden || HC.busy) return; HC.busy = true;
  try{
    if(HC.relay !== RELAY){ HC.relay = RELAY; if(!HC.g) hcRender(); }
    if(RELAY !== true) return;
    if(!HC.g || ++HC.n % 5 === 0){   // the player list changes rarely: every poll in the lobby, every fifth one in a game (the moves are read on every poll)
      const j = await (await fetch(`api/players?r=${encodeURIComponent(HC.room)}`, {cache:"no-store"})).json(), ps = (j.players || []).map(x => ({p:x.p, n:x.n})), sig = JSON.stringify(ps);
      if(sig !== HC.psig){ HC.psig = sig; HC.players = ps; hcSync(); if(!HC.g){ hcRender(); hcPost(); } else hcRender(); } }
    const a = await (await fetch(`api/crdacts?r=${encodeURIComponent(HC.room)}&since=${HC.since}`, {cache:"no-store"})).json(); HC.since = a.n; let r = 0;
    for(const x of a.acts || []){ if(!HC.g || !HC.players.some(y => y.p === x.p)) continue; r = Math.max(r, hcAct(x.p, x.a || {})); }
    if(r === 2) hcChanged(); else if(r === 1) hcRender(); }
  catch(e){} finally { HC.busy = false; } }
function hcAct(p, a){   // 0 = nothing happened, 2 = the table changed (redraw and post it)
  const g = HC.g; if(!g || a.t !== g.tid) return 0; const now = Date.now();
  if(a.k === "pick"){ const ok = g.pick(p, +a.i, String(a.w == null ? "" : a.w), now); return ok || (g.rej && p === g.giver) ? 2 : 0; }
  if(a.k === "clue2"){ const ok = g.clue2(p, String(a.w == null ? "" : a.w), now); return ok || (g.rej && p === g.giver) ? 2 : 0; }
  if(a.k === "mark"){ if(!g.mark(p, +a.c, +a.r, now)) return 0; HC.anim = {t0:performance.now()}; return 2; }
  if(a.k === "flag") return g.flag(p, now) ? 2 : 0;
  return 0; }

/* ---------- the flow ---------- */
function hcStart(){
  if(RELAY !== true || HC.players.length < 3 || HC.players.length > 10) return; stopSiu(); hcSync();
  HC.g = HCR.Game({players:HC.players.map(x => x.p), turns:HC.cfg.turns, t1:HC.cfg.t1, t2:HC.cfg.t2, tg:HC.cfg.tg}); HC.g.begin(Date.now());
  HC.over = false; HC.sung = false; HC.scored = 0; HC.anim = null; hcChanged(); }
function hcWinners(){ const mx = Math.max(...Object.values(HC.scores), 0); return Object.keys(HC.scores).filter(p => HC.scores[p] === mx && HC.players.some(x => x.p === p)); }
function hcChanged(){ const g = HC.g;
  if(g && g.ph === "reveal" && HC.scored !== g.tid){ HC.scored = g.tid; Object.entries(g.deltas).forEach(([p, d]) => { HC.scores[p] = (HC.scores[p] || 0) + d; }); }
  if(g && g.ph === "over") HC.over = true;
  if(HC.over && !HC.sung){ HC.sung = true; playWinSiu(); }
  hcPost(); hcRender(); }
function hcAgain(){ stopSiu(); HC.g = null; HC.over = false; HC.scores = {}; HC.scored = 0; HC.anim = null; hcRender(); hcPost(); }
function hcTick(){ const g = HC.g; if(!g) return; const now = Date.now(); if(g.tick(now)){ hcChanged(); return; }
  const bar = $("#hcBar"); if(bar){ bar.style.width = g.dl && g.tot ? Math.max(0, Math.min(100, (g.dl - now) / g.tot * 100)) + "%" : "100%"; } }

/* ---------- the board on the TV ---------- */
function hcPaint(){
  const cv = $("#hcCv"), g = HC.g; if(!cv || !g) return; const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1); if(!W || !H) return;
  if(cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)){ cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  const C = HCR.COLS, R = HCR.ROWS, padL = Math.max(14, H * .045), padT = Math.max(12, H * .04), cell = Math.min((W - padL - 6) / C, (H - padT - 6) / R), bw = cell * C, bh = cell * R, ox = padL + (W - padL - bw) / 2, oy = padT + (H - padT - bh) / 2, gp = cell * .16;
  c.fillStyle = "#6b6f76"; c.font = `600 ${Math.max(8, cell * .42)}px "Share Tech Mono",monospace`; c.textAlign = "center"; c.textBaseline = "middle";
  for(let i = 0; i < C; i++) if(cell >= 17 || i % 2 === 0) c.fillText(i + 1, ox + (i + .5) * cell, oy - padT * .55);
  for(let j = 0; j < R; j++) c.fillText(HC_LET[j], ox - padL * .55, oy + (j + .5) * cell);
  for(let i = 0; i < C; i++) for(let j = 0; j < R; j++){ c.fillStyle = HCR.shade(i, j); c.fillRect(ox + i * cell + gp / 2, oy + j * cell + gp / 2, cell - gp, cell - gp); }
  const X = i => ox + (i + .5) * cell, Y = j => oy + (j + .5) * cell, reveal = g.ph === "reveal", t = g.tgt;
  if(reveal && t && g.kind !== "skip"){
    c.fillStyle = "rgba(244,245,243,.32)"; c.beginPath(); c.rect(ox, oy, bw, bh);
    const x0 = Math.max(0, t[0] - 2), x1 = Math.min(C - 1, t[0] + 2), y0 = Math.max(0, t[1] - 2), y1 = Math.min(R - 1, t[1] + 2); c.rect(ox + (x1 + 1) * cell, oy + y0 * cell, -(x1 - x0 + 1) * cell, (y1 - y0 + 1) * cell); c.fill("evenodd");
    c.strokeStyle = "#111"; c.lineWidth = Math.max(2.5, cell * .16); c.strokeRect(X(t[0] - 1.5) + 0, Y(t[1] - 1.5) + 0, cell * 3, cell * 3);
    c.setLineDash([cell * .25, cell * .2]); c.lineWidth = Math.max(1.2, cell * .07); c.strokeRect(X(t[0] - 2.5), Y(t[1] - 2.5), cell * 5, cell * 5); c.setLineDash([]);
    c.strokeStyle = "#fff"; c.lineWidth = Math.max(2, cell * .1); c.strokeRect(X(t[0] - .5) + 2, Y(t[1] - .5) + 2, cell - 4, cell - 4); }
  const marks = []; const add = (m, two) => Object.keys(m || {}).forEach(p => marks.push({p, c:m[p][0], r:m[p][1], two}));
  if(g.ph === "pick2" || g.ph === "g2") add(g.marks[0], false); if(reveal){ add(g.marks[0], false); add(g.marks[1], true); }
  const rad = cell * .44, drop = HC.anim ? Math.min(1, (performance.now() - HC.anim.t0) / 450) : 1;
  marks.forEach((m, mi) => { const x = X(m.c), y = Y(m.r), col = hcCol(m.p); c.beginPath(); c.arc(x, y, rad + Math.max(1.5, rad * .22), 0, 7); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 1; c.strokeStyle = "rgba(0,0,0,.6)"; c.stroke();
    c.beginPath(); c.arc(x, y, rad, 0, 7); c.fillStyle = col; c.fill(); c.fillStyle = "#fff"; c.font = `800 ${rad * 1.15}px Manrope,sans-serif`; c.fillText(hcInit(m.p), x, y + rad * .05);
    if(m.two){ c.beginPath(); c.arc(x + rad, y - rad, rad * .5, 0, 7); c.fillStyle = "#fff"; c.fill(); c.fillStyle = "#111"; c.font = `800 ${rad * .7}px Manrope,sans-serif`; c.fillText("2", x + rad, y - rad); }
    if(reveal && t){ const v = HCR.pts(HCR.dist([m.c, m.r], t)); if(v){ const tx = "+" + v, fs = Math.max(9, cell * .42); c.font = `800 ${fs}px Manrope,sans-serif`; const tw = c.measureText(tx).width + fs * .7, bx = x - tw / 2, by = y - rad - fs * (1.9 + (mi % 2) * 1.5);
      c.fillStyle = "#111"; c.fillRect(bx, by, tw, fs * 1.3); c.fillStyle = "#f4f5f3"; c.fillText(tx, x, by + fs * .68); } } });
  if(HC.anim && drop < 1){ cancelAnimationFrame(HC.raf); HC.raf = requestAnimationFrame(hcPaint); } else HC.anim = null; }

/* ---------- screens ---------- */
function hcEnter(){ if(S.mode === "hues") return; S.mode = "hues"; document.body.classList.add("hcmode"); }
function hcLeave(){ if(S.mode !== "hues") return; stopSiu(); clearInterval(HC.poll); clearInterval(HC.tmr); cancelAnimationFrame(HC.raf); HC.poll = HC.tmr = null; HC.g = null; HC.over = false; S.mode = null; document.body.classList.remove("hcmode"); $("#hco").hidden = true; }
function hcShow(){ hcEnter();
  ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#survival","#survSetup","#hotSeat","#hotseat","#hsSetup","#lobby","#impo","#psyo","#esto","#tno","#cno","#dco","#lbo","#slo","#hdo","#tbo","#fao"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  HC.room = newRoom(); HC.players = []; HC.col = {}; HC.scores = {}; HC.g = null; HC.over = false; HC.since = 0; HC.relay = RELAY; HC.psig = ""; HC.sung = false; HC.vc = 0; HC.scored = 0; HC.anim = null;
  $("#hco").hidden = false; hcRender(); window.scrollTo(0, 0); hcPost();
  clearInterval(HC.poll); HC.poll = setInterval(hcPoll, 400); clearInterval(HC.tmr); HC.tmr = setInterval(hcTick, 250); hcPoll(); }
const hcSeg = (key, opts, cur) => `<div class="hcseg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
const hcDot = p => `<i style="background:${hcCol(p)}"></i>`;
function hcStrip(g, over){ const ps = HC.players.slice().sort((a, b) => (HC.scores[b.p] || 0) - (HC.scores[a.p] || 0)), lk = g && (g.ph === "g1" ? g.marks[0] : g.ph === "g2" ? g.marks[1] : {}), d = g && g.ph === "reveal" ? g.deltas : null;
  return `<div class="hcstrip">${ps.map(x => `<span class="hcp${g && x.p === g.giver && g.ph !== "over" ? " giver" : ""}">${hcDot(x.p)}<span>${esc(x.n)}</span><b>${HC.scores[x.p] || 0}</b>${d && d[x.p] ? `<em>+${d[x.p]}</em>` : ""}${lk && lk[x.p] ? `<u>✓</u>` : ""}</span>`).join("")}</div>`; }
function hcOver(){ const ws = hcWinners(), order = HC.players.slice().sort((a, b) => (HC.scores[b.p] || 0) - (HC.scores[a.p] || 0));
  return `<div class="hcover"><div class="hcwin">${ws.map(p => esc(hcName(p))).join(" and ")}<span>${ws.length > 1 ? "share the best eye" : "has the best eye"}</span></div>
    <ol class="hcplace">${order.map((x, i) => `<li><b>${i + 1}</b>${hcDot(x.p)}<span>${esc(x.n)}</span><em>${HC.scores[x.p] || 0}</em></li>`).join("")}</ol></div>`; }
function hcRender(){
  const el = $("#hcBody"), g = HC.g;
  if(!g){ const off = RELAY !== true, ps = HC.players, c = HC.cfg, ok = !off && ps.length >= 3 && ps.length <= 10, per = c.turns || (ps.length <= 6 ? 2 : 1);
    const sec = k => [[k === "t1" ? 45 : k === "t2" ? 30 : 20, ""], [k === "t1" ? 60 : k === "t2" ? 45 : 30, ""], [k === "t1" ? 90 : k === "t2" ? 60 : 45, ""], [0, ""]].map(([v]) => [v, v ? v + " s" : "Off"]);
    el.innerHTML = `<div class="hchead"><div class="hcbadge">Game mode</div><h1>Hues and Cues</h1><p class="sub">One player picks a secret shade on a 660-colour board and gives a one-word clue. Everyone else taps where they think it is on their phone. The closer you land, the more you score.</p></div>
      <div class="hcgrid">
      <div class="hcpanel">${off
        ? `<div class="hceye">${RELAY === null ? "Checking the connection…" : "Needs the Cloudflare link"}</div><p class="note">${RELAY === null ? "Hold on a second." : "Every player guesses on their own phone and the clue giver's secret has to stay private, so Hues and Cues only runs where everyone can join with a code."}</p>`
        : `<div class="hceye">Scan to join</div><div id="hcQr" class="hcqr"></div><p class="note">Everyone scans once and types a name. You get a colour that stays yours all night. Keep the page open for the whole game.</p>`}</div>
      <div class="hcpanel"><div class="hceye">Players · ${ps.length}</div>${ps.length ? `<ul class="hcnames">${ps.map(x => `<li><button data-kick="${esc(x.p)}" title="Remove ${esc(x.n)}">${hcDot(x.p)}${esc(x.n)}</button></li>`).join("")}</ul><p class="note">Tap a name to remove that player.</p>` : `<p class="note">Nobody has joined yet. Three to ten players.</p>`}
        ${ps.length > 10 ? `<p class="note warn">Ten players at most. Remove ${ps.length - 10}.</p>` : ""}</div>
      <div class="hcpanel"><div class="hceye">Turns each as clue giver</div>${hcSeg("turns", [[0, "Auto"], [1, "1"], [2, "2"]], c.turns)}<p class="note">${c.turns ? "" : "Auto: 2 turns each for 3 to 6 players, 1 each for 7 to 10. "}That is ${per * (ps.length || 0)} turns with ${ps.length || "these"} players.</p>
        <div class="hceye">Send clue 1</div>${hcSeg("t1", sec("t1"), c.t1)}
        <div class="hceye">Send clue 2</div>${hcSeg("t2", sec("t2"), c.t2)}
        <div class="hceye">Each guess</div>${hcSeg("tg", sec("tg"), c.tg)}
        <p class="note">Clue 1 is one word, clue 2 up to two. No colour names, light or dark, numbers or positions: the phone checks, and players can flag a clue.</p>
        ${ps.length && ps.length < 3 && !off ? `<p class="note warn">You need at least 3 players to start.</p>` : ""}
        <button class="hcbtn go" id="hcGo" ${ok ? "" : "disabled"}>Start</button></div></div>`;
    const q = $("#hcQr"); if(q){ const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(!HC.g && !$("#hco").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
      q.innerHTML = ""; try{ new QRCode(q, {text:hcUrl(), width:230, height:230, correctLevel:QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } }; draw(); }
    return; }
  const ph = HC.over ? "over" : g.ph, gv = g.giver, nm = esc(hcName(gv)), gcol = hcCol(gv);
  let head = "", ctl = "", hint = "", mid = "";
  const clues = `${g.c1 ? `<div class="hcc1">${esc(g.c1)}</div>` : ""}${g.c2 ? `<div class="hcc2">${esc(g.c2)}</div>` : ""}`;
  if(ph === "pick"){ head = `<div class="hcwho"><span class="hctag" style="background:${gcol}">${nm}</span> is the clue giver</div><div class="hcc1 soft">${g.struck && g.rej ? "Clue struck. Waiting for a new one…" : "Choosing a shade and a one-word clue…"}</div>`; hint = "Look at your phone only if it's your turn."; ctl = `<button class="hcbtn small" data-act="skip">Skip turn</button>`; }
  else if(ph === "g1" || ph === "g2"){ const lk = Object.keys(g.marks[ph === "g1" ? 0 : 1]).length, tot = g.ids.length - 1, fl = Object.keys(g.flags).length;
    head = `<div class="hcwho"><span class="hctag" style="background:${gcol}">${nm}</span> gives the clue · turn ${g.ti + 1} of ${g.seq.length}</div>${clues}`; hint = `${lk} of ${tot} have placed a marker. Tap the small board on your phone, then Lock in.${fl ? ` Flags: ${fl}.` : ""}`; ctl = `<button class="hcbtn small" data-act="skip">${lk ? "Show markers now" : "Skip turn"}</button>`; }
  else if(ph === "pick2"){ head = `<div class="hcwho"><span class="hctag" style="background:${gcol}">${nm}</span> is writing clue 2</div>${clues}`; hint = "Everyone's first marker is on the board."; ctl = `<button class="hcbtn small" data-act="skip">Skip clue 2</button>`; }
  else if(ph === "reveal"){ const k = g.kind; head = `<div class="hcwho"><span class="hctag" style="background:${gcol}">${nm}</span> ${k === "skip" ? "turn skipped" : "gave the clues"}</div>${clues}`;
    hint = k === "skip" ? "No points this turn." : k === "late" ? "No second clue, so only the first markers scored." : ""; ctl = `<button class="hcbtn go small" data-act="next">${g.ti === g.seq.length - 1 ? "See the winner" : "Next turn"}</button>`; }
  else if(ph === "over"){ mid = hcOver(); ctl = `<button class="hcbtn go small" data-act="again">Play again</button>`; }
  const target = ph === "reveal" && g.tgt ? `<div class="hctarget">The shade was<b>${hcCode(g.tgt)}</b><i style="background:${HCR.shade(g.tgt[0], g.tgt[1])}"></i></div>` : "";
  ctl += `<button class="hcbtn ghost small" data-act="end-game">End game</button>`;
  el.innerHTML = `<div class="hctv"><div class="hcin">
    ${ph === "over" ? mid + `<div class="hcctl">${ctl}</div>` : `<div class="hctop"><div class="hcclue">${head}</div>${target}<div class="hcctl">${ctl}</div></div>${ph === "pick" || ph === "g1" || ph === "g2" || ph === "pick2" ? `<div class="hcbar"><i id="hcBar"></i></div>` : ""}<div class="hcmain"><div class="hcboard"><canvas id="hcCv"></canvas></div><div class="hcfoot">${hcStrip(g)}${hint ? `<p class="hchint">${esc(hint)}</p>` : ""}</div></div>`}
    </div></div>`;
  if(ph !== "over") hcPaint(); hcTick(); }
$("#hco").addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if(set){ HC.cfg[set.dataset.set] = +set.dataset.v; hcSave(); hcRender(); return; }
  const kick = e.target.closest("[data-kick]"); if(kick){ const p = kick.dataset.kick; fetch("api/kick", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:HC.room, p})}).catch(() => {});
    HC.players = HC.players.filter(x => x.p !== p); hcSync(); if(HC.g) HC.g.drop(p, Date.now()); hcChanged(); return; }
  if(e.target.closest("#hcGo")){ hcStart(); return; }
  if(e.target.closest("#hcHome")){ showHome(); return; }
  const act = e.target.closest("[data-act]"); if(!act || !HC.g) return; const a = act.dataset.act, g = HC.g, now = Date.now();
  if(a === "skip"){ if(g.timeout(now)) hcChanged(); }
  else if(a === "next"){ if(g.next(now)) hcChanged(); }
  else if(a === "again" || a === "end-game") hcAgain(); });
window.addEventListener("resize", () => { if(HC.g && !$("#hco").hidden) hcPaint(); });
$("#modeHc").onclick = hcShow;
