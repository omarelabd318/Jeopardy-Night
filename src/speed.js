/* 7.47 (Omar): Speed Trivia, a buzzer race for 2 to 4 players (framework drafted 2026-10-14, then "build with look 1 and all defaults": Studio Podiums look). Every player joins once from their phone
   (buzz.html at /b?r=ROOM, one name, same join step as Imposter and Psych); the phone is the buzzer. The TV shows one clue at a time, typing in word by word (4 words a second); anyone can buzz at any moment, and the first
   buzz the relay received wins. The buzzer's phone shows 4 answer buttons (the right answer plus 3 wrong ones from the same category's other answers) or, with "Type it", a text box. A wrong answer or running out of time locks
   that player out for the rest of the clue and costs half the clue's value (7.66; it was half the round's points); the clue goes on and the others can buzz. Nobody scores if everyone is locked out or nobody buzzes 8 s after the clue is complete.
   Game: 3 rounds of 8 clues (setup: 5 to 12): Warm Up (100 and 200 clues, 6 s to answer), Speed Up (300 and 400 clues, 6 s), Lightning (500 clues, 4 s). Since 7.66 (Omar) a right answer scores the clue's value and a wrong one loses half of it; the setup also offers Marathon: 20 to 30 clues (default 25) of 200 to 500 picked at random, no rounds, same scoring. Typing gives a flat 15 s (7.66).
   From the 3rd right answer in a row, each further one adds +100; a streak breaks when you answer wrong, run out of time or somebody else wins a clue (a clue nobody gets doesn't break it). A tie for first plays
   sudden death on 500 clues: only the tied players can buzz, a wrong answer knocks you out of it, the first right answer wins (up to 8 clues, then they share the win). The winner screen plays the Siuuu clip.
   Clues come from the normal pool: text, emoji and flag categories whose answer is 30 characters or fewer (no A/B/C answers, no photo clues), picked at random from the categories chosen in setup (a clue is not repeated on this
   device until its category and value run out, jn_spSeen). Buzzing before the clue is live (the 2 s "Get ready") locks that phone's buzzer for half a second.
   The laptop is the referee: it posts the table with POST /api/crd (pub = what every phone may see: scores, who is locked, who buzzed; priv = the answer buttons, sent only to the player who buzzed) and reads the phones'
   moves from GET /api/crdacts every 0.3 s, the same generic relay Taboo and Hues and Cues use. A buzz carries the table version the phone saw, so the relay refuses every buzz after the winning one. The clue text and the
   right answer are never in a phone's table until the result. Needs the Cloudflare link (no one-screen version). Setup is saved on this device in jn_spCfg; a game is not saved. It doesn't use the clue card or the
   Jeopardy scores; app.js only calls spLeave from showHome. Phones poll every 0.3 s, so a phone that sees the live table late loses a few tenths of a second; the framework's "fastest buzz" stat was left out for that reason.
   Look: Studio Podiums (his pick of three previews: Studio Podiums, Arcade Cabinet, Race Lanes; only this one is built): a TV game show set, navy studio light, gold type, a wooden podium per player whose lamp lights in
   their colour when they buzz, and a glossy round buzzer on the phone. The TV is one stage sized by --u (100 units = the screen's width at 16:9). buzz.html (the phones) uses the same palette.
   The rules and the state of a game live in SPR below (no screen code in it, so v4work/tools/speed-test.js can load just that region).
   To remove: delete this file, buzz.html, v4work/tools/speed-test.js and speed-e2e.js, the 7.47 CSS block and #spo section in head.html, the Speed Trivia button and the modeSp entry in title.js and titlebg.js (and in
   v4work/tools/titlebg-gen.py), the /b route in worker/index.js, buzz.html in wrangler.jsonc, 'speed' in MODE_FILES in build.js and the spLeave() call in showHome. */

/*@rules*/
const SPR = (() => {
  const WPS = 4, DEAD_MS = 8000, RESULT_MS = 3000, SCORES_MS = 5000, ROUND_MS = 3000, STREAK_AT = 3, BONUS = 100;
  const ROUNDS = [null, {n:1, name:"Warm Up", lv:[100, 200], right:100, wrong:50, secs:6}, {n:2, name:"Speed Up", lv:[300, 400], right:200, wrong:100, secs:6},
    {n:3, name:"Lightning", lv:[500], right:300, wrong:150, secs:4}, {n:4, name:"Sudden death", lv:[500], right:0, wrong:0, secs:6},
    {n:5, name:"Marathon", lv:[200, 300, 400, 500], right:0, wrong:0, secs:6}];   // 7.66: a clue is worth its own value (right:/wrong: above are no longer used); Marathon draws any of 200 to 500 at random
  /* o = {players:[ids] (2 to 4), per:clues per round, pen:wrong answers cost points, typed:answers are typed, wbw:clue types in word by word, draw:(lvl, round) => clue | null,
     match:(text, clue) => bool, rand:() => 0..1}. A clue is {q, a, opts:[4 answers], ci:index of the right one, ...whatever the screen shows}. Phases: round > ready > live > buzzed > (live again | result) > ready ... > scores > round ... > over. */
  function Game(o){
    const ids = o.players.slice(); if(ids.length < 2 || ids.length > 4) return null; const marathon = o.mode === "marathon";
    const rnd = o.rand || Math.random, wbw = o.wbw !== false, typed = !!o.typed, pen = o.pen !== false;
    const g = {ids, per:o.per, pen, typed, wbw, marathon, lvl:0, rd:0, ci:0, ph:"round", clue:null, lock:{}, gone:[], buz:null, shuf:[], dl:0, rdy:0, rv:0, rvT:0, rt:0, score:{}, streak:{}, maxStreak:{}, res:null, last:null,
      sd:null, sdAll:null, sdN:0, sdWin:false, winners:null, paused:false, v:0};
    ids.forEach(p => { g.score[p] = 0; g.streak[p] = 0; g.maxStreak[p] = 0; });
    const R = () => ROUNDS[g.rd], secs = () => typed ? 15 : R().secs, nw = () => g.clue ? String(g.clue.q).split(/\s+/).length : 0;
    const shown = now => Math.min(nw(), g.rv + (g.ph === "live" ? Math.max(0, now - g.rvT) / 1000 * WPS : 0));
    const fullAt = () => g.rvT + (nw() - g.rv) / WPS * 1000;
    const shuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const alive = () => ids.filter(p => !g.lock[p] && (!g.sd || g.sd.includes(p)));
    function draw(now){ const r = R(), lvl = marathon && !g.sd ? r.lv[Math.floor(rnd() * r.lv.length)] : r.lv[g.ci % r.lv.length], c = o.draw(lvl, g.rd);
      if(!c){ g.ph = "over"; g.winners = leaders(); return false; }
      g.clue = c; g.lvl = lvl; g.lock = {}; g.gone = []; g.buz = null; g.res = null; g.last = null; g.rv = wbw ? 0 : nw(); g.rvT = 0; g.ph = "ready"; g.rdy = now + (wbw ? 2000 : 1000); g.v++; return true; }
    const leaders = () => { const m = Math.max(...ids.map(p => g.score[p])); return ids.filter(p => g.score[p] === m); };
    function toResult(now){ g.ph = "result"; g.rt = now; g.v++; }
    function roundCard(now){ g.ph = "round"; g.rt = now; g.ci = 0; g.v++; }
    function afterResult(now){
      if(g.sdWin){ g.winners = g.sd.slice(); g.ph = "over"; g.v++; return; }
      if(g.sd){ if(g.res.k === "right"){ g.winners = [g.res.p]; g.ph = "over"; g.v++; return; }
        if(++g.sdN >= 8){ g.winners = g.sdAll.slice(); g.ph = "over"; g.v++; return; }
        g.sd = g.sdAll.slice(); g.ci++; draw(now); return; }
      if(++g.ci < g.per){ draw(now); return; }
      if(g.rd < 3 && !marathon){ g.ph = "scores"; g.rt = now; g.v++; return; }
      const lead = leaders(); if(lead.length === 1){ g.winners = lead; g.ph = "over"; g.v++; return; }
      g.sd = lead.slice(); g.sdAll = lead.slice(); g.sdN = 0; g.rd = 4; roundCard(now); }
    function right(p, now, guess){ g.streak[p]++; ids.forEach(x => { if(x !== p) g.streak[x] = 0; });
      const bonus = !g.sd && g.streak[p] >= STREAK_AT ? BONUS : 0, steal = !g.sd && ids.some(x => g.lock[x]), pts = (g.sd ? 0 : steal ? Math.round(g.lvl / 2) : g.lvl) + bonus; g.score[p] += pts; g.maxStreak[p] = Math.max(g.maxStreak[p], g.streak[p]);   // 7.66: a right answer after someone else got it wrong earns half
      g.res = {k:"right", p, pts, bonus, steal, guess:guess == null ? null : guess}; toResult(now); return true; }
    function wrong(p, now, a, why){ const cost = g.sd || !pen ? 0 : Math.round(g.lvl / 2); g.score[p] -= cost; g.streak[p] = 0; g.lock[p] = 1;
      if(a && a.i != null) g.gone.push(a.i);
      let win = false; if(g.sd){ g.sd = g.sd.filter(x => x !== p); if(g.sd.length === 1){ win = true; g.sdWin = true; } }
      g.last = {p, k:why, pts:-cost, guess:a && a.t != null ? String(a.t) : null, at:now};
      if(win || !alive().length){ g.res = {k:why, p, pts:-cost, dead:true, guess:g.last.guess}; toResult(now); return true; }
      g.ph = "live"; g.buz = null; g.rvT = now; g.v++; return true; }
    g.start = now => { if(g.rd) return false; g.rd = marathon ? 5 : 1; roundCard(now); return true; };
    g.shown = shown; g.R = R; g.nw = nw; g.secs = secs; g.alive = alive;
    g.fullAt = fullAt;
    g.buzz = (p, now) => { if(g.paused || g.ph !== "live" || !ids.includes(p) || g.lock[p] || (g.sd && !g.sd.includes(p))) return false;
      g.rv = shown(now); g.ph = "buzzed"; g.buz = p; g.dl = now + secs() * 1000; g.shuf = shuffle([0, 1, 2, 3].filter(i => !g.gone.includes(i))); g.v++; return true; };
    /* a = {i: answer button} or {t: typed text} */
    g.answer = (p, a, now) => { if(g.ph !== "buzzed" || p !== g.buz || !a) return false;
      if(now >= g.dl) return wrong(p, now, null, "time");
      if(a.i != null){ if(typed || !(a.i >= 0 && a.i <= 3) || g.gone.includes(a.i)) return false; return a.i === g.clue.ci ? right(p, now, g.clue.opts[a.i]) : wrong(p, now, a, "wrong"); }
      if(a.t != null && typed){ const t = String(a.t).trim().slice(0, 60); if(!t) return false; return o.match(t, g.clue) ? right(p, now, t) : wrong(p, now, {t}, "wrong"); }
      return false; };
    g.tick = now => { if(g.paused) return false;
      if(g.ph === "round" && now >= g.rt + ROUND_MS){ return draw(now) || true; }
      if(g.ph === "ready" && now >= g.rdy){ g.ph = "live"; g.rvT = now; g.v++; return true; }
      if(g.ph === "live" && shown(now) >= nw() && now >= fullAt() + DEAD_MS){ g.res = {k:"dead", p:null, pts:0}; toResult(now); return true; }
      if(g.ph === "buzzed" && now >= g.dl) return wrong(g.buz, now, null, "time");
      if(g.ph === "result" && now >= g.rt + RESULT_MS){ afterResult(now); return true; }
      if(g.ph === "scores" && now >= g.rt + SCORES_MS){ g.rd++; roundCard(now); return true; }
      return false; };
    g.skip = now => { if(g.paused) return false; if(g.ph === "round" || g.ph === "result" || g.ph === "scores"){ g.rt = 0; return g.tick(now); }
      if(g.ph === "live"){ g.res = {k:"dead", p:null, pts:0}; toResult(now); return true; } return false; };   // the host's Next
    g.add = p => { if(ids.includes(p) || ids.length >= 4 || !(g.ph === "result" || g.ph === "scores" || g.ph === "round")) return false; ids.push(p); g.score[p] = 0; g.streak[p] = 0; g.maxStreak[p] = 0; g.paused = ids.length < 2; g.v++; return true; };
    g.drop = (p, now) => { const k = ids.indexOf(p); if(k < 0) return false; ids.splice(k, 1); delete g.lock[p]; g.paused = ids.length < 2; if(g.sd) g.sd = g.sd.filter(x => x !== p);
      if(g.buz === p){ g.ph = "live"; g.buz = null; g.rvT = now || 0; } if(g.winners) g.winners = g.winners.filter(x => x !== p); g.v++; return true; };
    g.over = () => { if(g.ph === "over") return false; g.winners = leaders(); g.ph = "over"; g.v++; return true; };
    return g; }
  return {Game, ROUNDS, WPS};
})();
/*@end-rules*/

const SP = {cfg:null, room:null, players:[], phase:"lobby", g:null, vc:0, since:0, busy:false, poll:null, tmr:null, relay:null, psig:"", n:0, sung:false, flash:null, rc:-1, seen:store.get("jn_spSeen", {})};
if(/[?&]spdebug\b/.test(location.search)) window.__SP = SP;   // 7.47: test hook for v4work/tools/speed-e2e.js, only with ?spdebug
SP.cfg = Object.assign({per:8, mara:false, mn:25, typed:false, wbw:true, pen:true, off:{}}, store.get("jn_spCfg", {}));
const spSave = () => store.set("jn_spCfg", SP.cfg);
const SP_COL = ["#e8413a", "#2f7bf0", "#22b45f", "#f2b31b"];
const spUrl = () => new URL(`b?r=${SP.room}`, location.href).href;
const spPick = a => a[Math.floor(Math.random() * a.length)];
const spShuf = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const spName = p => { const x = SP.players.find(y => y.p === p); return x ? x.n : "Someone"; };
const spCol = p => { const g = SP.g, i = (g ? g.ids : SP.players.slice(0, 4).map(x => x.p)).indexOf(p); return SP_COL[i < 0 ? 0 : i]; };
const spSigned = n => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);

/* ---------- clues ---------- */
const SP_Q = {emov:"Name the film or TV show.", emeg:"Name the Egyptian film, series or play.", emseg:"Decode the Egyptian phrase or saying."};
function spEntry(cat, lvl, i){   // {q, a, kind, ...} for one pool entry, or null when it doesn't suit a buzzer (long answer, A/B/C, a photo)
  const c = catById(cat), e = DATA[cat][lvl][i]; let q, a, x = {};
  if(c.type === "text"){ if(typeof e[2] === "string") return null; q = e[0]; a = e[1]; }
  else if(c.type === "emoji"){ q = SP_Q[cat] || "Decode the phrase or proverb."; a = e[1]; x = {kind:"emoji", emoji:e[0]}; }
  else if(c.type === "flag"){ if(!F[e]) return null; q = "Name the country this flag belongs to."; a = F[e][0]; x = {kind:"flag", flag:e}; }
  else return null;
  if(typeof a !== "string" || !q || q.length > 220 || a.length > 30 || a.indexOf("\n") >= 0 || /^[A-Ca-c]\)/.test(a)) return null;
  return Object.assign({cat, catName:c.name, q, a}, x); }
SP.elig = {};
function spElig(id){ if(SP.elig[id] !== undefined) return SP.elig[id]; const c = catById(id); let n = 0;
  if(c && !HIDDEN_IDS.has(id) && id !== "x18" && ["text", "emoji", "flag"].includes(c.type)) LV.forEach(l => DATA[id][l].forEach((_, i) => { if(spEntry(id, l, i)) n++; }));
  return SP.elig[id] = n >= 12; }
function spCats(){   // category ids offered by the chosen groups that have enough usable clues
  const out = []; CAT_GROUPS.forEach(([name, list]) => { if(name === "Mixes" || SP.cfg.off[name]) return; list.forEach(id => { if(spElig(id) && !out.includes(id)) out.push(id); }); }); return out; }
const spGroups = () => CAT_GROUPS.filter(([n, l]) => n !== "Mixes" && l.some(spElig)).map(([n]) => n);
function spDraw(lvl){
  const cats = spCats(); if(!cats.length) return null; const last = SP.lastCat;
  for(let tries = 0; tries < 40; tries++){
    const cat = spPick(cats.length > 1 ? cats.filter(x => x !== last) : cats), n = DATA[cat][lvl].length, key = `${cat}-${lvl}`, done = SP.seen[key] || [];
    let ok = [...Array(n).keys()].filter(i => !done.includes(i)); if(!ok.length){ SP.seen[key] = []; ok = [...Array(n).keys()]; }
    for(let k = 0; k < 12 && ok.length; k++){ const j = Math.floor(Math.random() * ok.length), i = ok.splice(j, 1)[0], c = spEntry(cat, lvl, i); if(!c) continue;
      const others = []; LV.forEach(l => DATA[cat][l].forEach((_, ii) => { if(l === lvl && ii === i) return; const d = spEntry(cat, l, ii);
        if(d && ansNorm(d.a) !== ansNorm(c.a) && !ansMatch(d.a, c.a) && !ansMatch(c.a, d.a) && !others.some(z => ansNorm(z) === ansNorm(d.a))) others.push(d.a); }));
      if(others.length < 3) continue;
      const num = /^[\d\-+$]/.test(c.a), same = others.filter(z => /^[\d\-+$]/.test(z) === num), pickFrom = same.length >= 3 ? same : others;   // a year gets other years, a name other names
      const opts = spShuf(spShuf(pickFrom).slice(0, 3).concat(c.a)); c.opts = opts; c.ci = opts.indexOf(c.a); c.lvl = lvl;
      (SP.seen[key] = SP.seen[key] || []).push(i); store.set("jn_spSeen", SP.seen); SP.lastCat = cat; return c; } }
  return null; }
const spMatch = (t, c) => ansMatch(t, c.a);

/* ---------- talking to the phones ---------- */
function spPub(){
  const g = SP.g, ids = SP.players.slice(0, 4).map(x => x.p), names = {}; SP.players.forEach(x => names[x.p] = x.n);
  if(!g) return {ph:"lobby", ids, names};
  const r = g.R(), pub = {ph:g.ph, ids:g.ids, names, rd:g.rd, rname:r.name, val:g.lvl, pen:g.pen, mara:g.marathon, ci:g.ci + 1, of:g.sd ? 1 : g.per, cat:g.clue ? g.clue.catName : "", typed:g.typed, secs:g.secs(),
    score:g.score, streak:g.streak, lock:Object.keys(g.lock).filter(p => g.lock[p]), sd:g.sd, buz:g.buz, left:g.ph === "buzzed" ? Math.max(0, (g.dl - Date.now()) / 1000) : g.secs(), last:g.last ? {p:g.last.p, k:g.last.k, pts:g.last.pts} : null};
  if(g.ph === "result"){ pub.res = {k:g.res.k, p:g.res.p, pts:g.res.pts, bonus:g.res.bonus || 0, steal:!!g.res.steal}; pub.ans = g.clue.a; }
  if(g.ph === "over") pub.winners = g.winners;
  return pub; }
function spPost(){
  if(RELAY !== true) return; const g = SP.g, priv = {}, pub = spPub(); pub.v = ++SP.vc;
  if(g && g.ph === "buzzed") priv[g.buz] = g.typed ? {typed:true} : {opts:g.shuf.map(i => ({i, t:g.clue.opts[i]}))};
  fetch("api/crd", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:SP.room, crd:{pub, priv}})}).catch(() => {}); }
async function spPoll(){ if($("#spo").hidden || SP.busy) return; SP.busy = true;
  try{
    if(SP.relay !== RELAY){ SP.relay = RELAY; if(!SP.g) spRender(); }
    if(RELAY !== true) return;
    if(!SP.g || ++SP.n % 6 === 0){   // the player list changes rarely: every poll in the lobby, every sixth one in a game (the moves are read on every poll)
      const j = await (await fetch(`api/players?r=${encodeURIComponent(SP.room)}`, {cache:"no-store"})).json(), ps = (j.players || []).map(x => ({p:x.p, n:x.n})), sig = JSON.stringify(ps);
      const gone = sig !== SP.psig ? SP.players.filter(x => !ps.some(y => y.p === x.p)) : []; if(sig !== SP.psig){ SP.psig = sig; SP.players = ps; if(!SP.g){ spRender(); spPost(); } }
      if(SP.g){ const g = SP.g; let ch = false; gone.forEach(x => { if(g.drop(x.p, Date.now())) ch = true; });
        ps.slice(0, 4).forEach(x => { if(!g.ids.includes(x.p) && g.add(x.p)) ch = true; });   // a late joiner is added between clues
        if(ch) spChanged(); } }
    const a = await (await fetch(`api/crdacts?r=${encodeURIComponent(SP.room)}&since=${SP.since}`, {cache:"no-store"})).json(); SP.since = a.n;
    for(const x of a.acts || []){ const g = SP.g; if(!g || x.v !== SP.vc || !g.ids.includes(x.p)) continue;
      if(spAct(x.p, x.a || {})){ spChanged(); break; } } }   // one move per version: the table has moved on after the first
  catch(e){} finally { SP.busy = false; } }
function spAct(p, a){ const g = SP.g, now = Date.now();
  if(a.k === "buzz"){ const ok = g.buzz(p, now); if(ok){ try{ Snd.blip(); }catch(e){} } return ok; }
  if(a.k === "ans") return g.answer(p, a.t != null ? {t:a.t} : {i:a.i | 0}, now);
  return false; }

/* ---------- the flow ---------- */
function spStart(){
  const ps = SP.players.slice(0, 4); if(RELAY !== true || ps.length < 2 || !spCats().length) return; stopSiu(); try{ Snd.unlock(); }catch(e){} SP.lastCat = null; SP.fAt = 0; SP.rV = -1;
  SP.g = SPR.Game({players:ps.map(x => x.p), mode:SP.cfg.mara ? "marathon" : "rounds", per:SP.cfg.mara ? SP.cfg.mn : SP.cfg.per, pen:SP.cfg.pen, typed:SP.cfg.typed, wbw:SP.cfg.wbw, draw:spDraw, match:spMatch});
  SP.phase = "play"; SP.sung = false; SP.flash = null; SP.g.start(Date.now()); spChanged(); }
function spChanged(){ const g = SP.g;
  if(g.ph === "over" && !SP.sung){ SP.sung = true; playWinSiu(); }
  if(g.last && g.last.at !== SP.fAt){ SP.fAt = g.last.at; try{ Snd.buzz(); }catch(e){} if(g.ph === "live") SP.flash = {p:g.last.p, k:g.last.k, pts:g.last.pts, until:Date.now() + 2200}; }
  else if(g.ph === "result" && g.res.k === "right" && SP.rV !== g.v){ SP.rV = g.v; try{ Snd.chime(); }catch(e){} }
  spPost(); spRender(); }
function spAgain(){ stopSiu(); SP.g = null; SP.phase = "lobby"; SP.flash = null; spRender(); spPost(); }
function spTick(){ const g = SP.g; if(!g) return; const now = Date.now();
  if(SP.flash && now >= SP.flash.until){ SP.flash = null; spRender(); }
  if(g.tick(now)){ spChanged(); return; }
  if(g.ph === "live" || g.ph === "ready" || g.ph === "buzzed"){ const q = $("#spQ"); if(q && g.clue){ const w = String(g.clue.q).split(/\s+/), n = Math.floor(g.shown(now) + 1e-6); if(+q.dataset.n !== n){ q.dataset.n = n; q.innerHTML = spWords(w, n); } }
    if(g.ph === "buzzed"){ const b = $("#spBar"), l = $("#spLeft"); if(b) b.style.width = Math.max(0, Math.min(100, (g.dl - now) / (g.secs() * 10))) + "%"; if(l) l.textContent = Math.max(0, Math.ceil((g.dl - now) / 1000)); } } }
const spWords = (w, n) => w.map((x, i) => i < n ? esc(x) : `<i>${esc(x)}</i>`).join(" ");

/* ---------- screens ---------- */
function spEnter(){ if(S.mode === "speed") return; S.mode = "speed"; document.body.classList.add("spmode"); }
function spLeave(){ if(S.mode !== "speed") return; stopSiu(); clearInterval(SP.poll); clearInterval(SP.tmr); SP.poll = SP.tmr = null; SP.g = null; SP.phase = "lobby"; S.mode = null; document.body.classList.remove("spmode"); $("#spo").hidden = true; }
function spShow(){ spEnter();
  ["#titleScreen", "#setup", "#game", "#scores"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  SP.room = newRoom(); SP.players = []; SP.phase = "lobby"; SP.g = null; SP.since = 0; SP.relay = RELAY; SP.psig = ""; SP.sung = false; SP.flash = null; SP.vc = 0;
  $("#spo").hidden = false; spRender(); window.scrollTo(0, 0); spPost();
  clearInterval(SP.poll); SP.poll = setInterval(spPoll, 300); clearInterval(SP.tmr); SP.tmr = setInterval(spTick, 150); spPoll(); }
const spSeg = (key, opts, cur) => `<div class="spseg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
function spPods(g){ const ph = g.ph; return `<div class="sppods">${g.ids.map(p => { const lk = g.lock[p] || (g.sd && !g.sd.includes(p)), dim = ph === "buzzed" && g.buz !== p;
    return `<div class="sppod${g.buz === p && ph === "buzzed" ? " on" : ""}${lk && (ph === "live" || ph === "buzzed") ? " lock" : ""}${dim ? " dim" : ""}" style="--c:${spCol(p)}">${g.streak[p] >= 3 ? `<div class="st">${g.streak[p]} IN A ROW</div>` : ""}<div class="lamp"></div><div class="nm">${esc(spName(p))}</div><div class="sc${g.score[p] < 0 ? " neg" : ""}">${g.score[p]}</div></div>`; }).join("")}</div>`; }
function spOver(g){ const rows = g.ids.map(p => ({p, s:g.score[p], st:g.maxStreak[p]})).sort((a, b) => b.s - a.s), w = g.winners.map(p => esc(spName(p))).join(" and ");
  const best = rows.slice().sort((a, b) => b.st - a.st)[0];
  return `<div class="spover"><div class="spwin">${w}<span>${g.winners.length > 1 ? "share the win" : "wins the night"}</span></div>
    <ol class="spplace">${rows.map((r, i) => `<li style="--c:${spCol(r.p)}"><b>${i + 1}</b><span>${esc(spName(r.p))}</span><em class="${r.s < 0 ? "neg" : ""}">${r.s}</em></li>`).join("")}</ol>
    <p class="spbrag">${best && best.st >= 2 ? `Longest streak: <b>${esc(spName(best.p))}</b> (${best.st} in a row)` : "No streaks this game"}</p></div>`; }
function spMid(g){
  const r = g.R();
  if(g.ph === "round") return `<div class="spcard"><small>${g.rd === 4 ? "Tied at the top" : "Get ready"}</small><h2>${g.rd === 4 ? "Sudden death" : g.marathon ? `Marathon · ${g.per} clues` : `Round ${r.n} · ${esc(r.name)}`}</h2><p>${g.rd === 4 ? `${g.sd.map(p => esc(spName(p))).join(" and ")}: first right answer wins. A wrong answer puts you out.` : `${g.marathon ? "200 to 500 clues, picked at random" : `${r.lv.join(" and ")} clues`} · right = the clue's value (half after someone else's wrong answer)${g.pen ? ", wrong = lose half of it" : ""} · ${g.secs()} s to answer`}</p></div>`;
  if(g.ph === "scores"){ const rows = g.ids.slice().sort((a, b) => g.score[b] - g.score[a]);
    return `<div class="spcard"><small>After round ${r.n}</small><h2>Scores</h2><ol class="spplace">${rows.map((p, i) => `<li style="--c:${spCol(p)}"><b>${i + 1}</b><span>${esc(spName(p))}</span><em class="${g.score[p] < 0 ? "neg" : ""}">${g.score[p]}</em></li>`).join("")}</ol></div>`; }
  const c = g.clue, media = c.kind === "emoji" ? `<div class="spemoji">${esc(c.emoji)}</div>` : c.kind === "flag" ? `<div class="spflag">${flagSVG(c.flag)}</div>` : "";
  const n = g.ph === "result" || g.ph === "ready" && !g.wbw ? 999 : Math.floor(g.shown(Date.now()) + 1e-6), w = String(c.q).split(/\s+/);
  let status = "";
  if(g.ph === "ready") status = `<div class="spstat">Get ready…</div>`;
  else if(g.ph === "live") status = SP.flash ? `<div class="spstat bad"><b>${esc(spName(SP.flash.p))}</b> ${SP.flash.k === "time" ? "ran out of time" : "got it wrong"}${SP.flash.pts ? ` (${spSigned(SP.flash.pts)})` : ""}. Everyone else, buzz!</div>` : `<div class="spstat go">BUZZ IN!</div>`;
  else if(g.ph === "buzzed") status = `<div class="spstat"><b style="color:${spCol(g.buz)}">${esc(spName(g.buz).toUpperCase())}</b> BUZZED · <span id="spLeft">${Math.ceil((g.dl - Date.now()) / 1000)}</span> S</div><div class="spbar"><i id="spBar" style="width:${Math.max(0, Math.min(100, (g.dl - Date.now()) / (g.secs() * 10)))}%"></i></div>`;
  else if(g.ph === "result"){ const x = g.res, who = x.p ? esc(spName(x.p)) : "";
    status = `<div class="spans"><small>The answer</small><b>${esc(c.a)}</b></div>
      <ul class="spopts">${c.opts.map((t, i) => `<li class="${i === c.ci ? "ok" : ""}">${esc(t)}</li>`).join("")}</ul>
      <div class="spstat ${x.k === "right" ? "go" : "bad"}">${x.k === "right" ? `<b>${who}</b> gets it! ${spSigned(x.pts)}${x.steal ? " (half, after a wrong answer)" : ""}${x.bonus ? ` (streak bonus +${x.bonus})` : ""}` : x.k === "dead" ? "Nobody got it." : `<b>${who}</b> ${x.k === "time" ? "ran out of time" : "got it wrong"}${x.pts ? ` (${spSigned(x.pts)})` : ""}. Nobody else left to buzz.`}</div>`; }
  return `<div class="spcat">${esc(c.catName)}${g.sd ? "" : ` · ${g.lvl}`}</div>${media}<div class="spq${String(c.q).length > 90 ? " long" : ""}" id="spQ" data-n="${n}">${spWords(w, n)}</div>${status}`; }
function spCtl(g){ const out = [];
  if(g.ph === "round" || g.ph === "result" || g.ph === "scores" || g.ph === "live") out.push(`<button class="spbtn small" data-act="next">${g.ph === "live" ? "Skip clue" : "Next"}</button>`);
  if(g.ph === "over") out.push(`<button class="spbtn go small" data-act="again">Play again</button>`);
  out.push(`<span class="gap"></span><button class="spbtn ghost small" data-act="end">End game</button>`); return out.join(""); }
function spRender(){
  const el = $("#spBody"), g = SP.g;
  if(!g){ const off = RELAY !== true, ps = SP.players, c = SP.cfg, shown = ps.slice(0, 4), many = ps.length > 4, ok = !off && shown.length >= 2 && spCats().length, groups = spGroups();
    el.innerHTML = `<div class="sphead"><div class="spbadge">Game mode</div><h1>Speed Trivia</h1><p class="sub">Your phone is the buzzer. The clue types onto the TV, buzz in the moment you know it, then pick the answer. A wrong answer locks you out and costs points.</p></div>
      <div class="spgrid">
      <div class="sppanel">${off
        ? `<div class="speye">${RELAY === null ? "Checking the connection…" : "Needs the Cloudflare link"}</div><p class="note">${RELAY === null ? "Hold on a second." : "Buzzers are phones that talk to the game through the Cloudflare link. Open the game from there to play Speed Trivia."}</p>`
        : `<div class="speye">Scan to join</div><div id="spQr" class="spqr"></div><p class="note">Everyone scans once and types a name. Keep the page open for the whole game.</p>`}</div>
      <div class="sppanel"><div class="speye">Players · ${shown.length} of 4</div>${shown.length ? `<ul class="spnames">${shown.map(p => `<li><button data-kick="${esc(p.p)}" title="Remove ${esc(p.n)}" style="--c:${SP_COL[shown.indexOf(p)]}"><i></i>${esc(p.n)}</button></li>`).join("")}</ul><p class="note">Tap a name to remove that player.${many ? " Phones past the fourth are told the game is full." : ""}</p>` : `<p class="note">Waiting for players… you need 2 to 4.</p>`}</div>
      <div class="sppanel"><div class="speye">Game</div>${spSeg("mara", [[0, "3 rounds"], [1, "Marathon"]], c.mara ? 1 : 0)}
        <div class="speye">${c.mara ? "Clues in the game" : "Clues per round"}</div>${c.mara ? spSeg("mn", [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map(n => [n, n]), c.mn) : spSeg("per", [5, 6, 7, 8, 9, 10, 11, 12].map(n => [n, n]), c.per)}
        <div class="speye">Answers</div>${spSeg("typed", [[0, "Multiple choice"], [1, "Type it"]], c.typed ? 1 : 0)}
        <p class="note">Time to answer after buzzing: ${c.typed ? "15 s, in every round" : c.mara ? "6 s on every clue" : "6 s (4 s in Lightning)"}.</p>
        <div class="speye">The clue</div>${spSeg("wbw", [[1, "Word by word"], [0, "All at once"]], c.wbw ? 1 : 0)}
        <div class="speye">Wrong answer</div>${spSeg("pen", [[1, "Costs points"], [0, "Only locks you out"]], c.pen ? 1 : 0)}
        <div class="speye">Categories</div><div class="spseg">${groups.map(n => `<button data-grp="${esc(n)}" aria-pressed="${!c.off[n]}">${esc(n)}</button>`).join("")}</div>
        <p class="note">${c.mara ? `${c.mn} clues from 200 to 500 at random, no rounds.` : `3 rounds of ${c.per} clues: Warm Up (100 and 200), Speed Up (300 and 400), Lightning (500).`} Right answers score the clue's value (half if someone got it wrong first)${c.pen ? " and wrong ones lose half of it" : ""}. A tie for first plays sudden death.</p>
        <button class="spbtn go" id="spGo" ${ok ? "" : "disabled"}>Start</button></div></div>`;
    const q = $("#spQr"); if(q){ const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(!SP.g && !$("#spo").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
      q.innerHTML = ""; try{ new QRCode(q, {text:spUrl(), width:230, height:230, correctLevel:QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } }; draw(); }
    return; }
  const r = g.R(), top = g.ph === "over" ? "Final scores" : g.rd === 4 ? "Sudden death" : g.marathon ? "Marathon" : `Round ${r.n} · ${esc(r.name)}`, cnt = g.ph === "over" || g.ph === "round" || g.ph === "scores" ? "" : g.sd ? "" : `Clue ${g.ci + 1} of ${g.per}`;
  el.innerHTML = `<div class="sptv"><div class="spin"><div class="sptop"><span>${top}</span><span>${cnt}${g.paused ? " · Waiting for players" : ""}</span></div>
    <div class="spmid">${g.ph === "over" ? spOver(g) : spMid(g)}</div>${(g.ph === "over" || g.ph === "scores") ? "" : spPods(g)}
    <div class="spctl">${spCtl(g)}</div></div></div>`; spTick(); }
$("#spo").addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if(set){ const k = set.dataset.set, v = +set.dataset.v; SP.cfg[k] = k === "per" || k === "mn" ? v : !!v; spSave(); spRender(); return; }
  const grp = e.target.closest("[data-grp]"); if(grp){ const n = grp.dataset.grp; SP.cfg.off[n] = !SP.cfg.off[n]; if(!spCats().length) SP.cfg.off[n] = false; spSave(); spRender(); return; }
  const kick = e.target.closest("[data-kick]"); if(kick){ fetch("api/kick", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:SP.room, p:kick.dataset.kick})}).catch(() => {});
    SP.players = SP.players.filter(x => x.p !== kick.dataset.kick); SP.psig = JSON.stringify(SP.players.map(x => ({p:x.p, n:x.n}))); spRender(); spPost(); return; }
  if(e.target.closest("#spGo")){ spStart(); return; }
  if(e.target.closest("#spHome")){ showHome(); return; }
  const act = e.target.closest("[data-act]"); if(!act) return; const a = act.dataset.act, g = SP.g;
  if(a === "again"){ spAgain(); return; } if(!g) return;
  if(a === "next"){ if(g.skip(Date.now())) spChanged(); }
  else if(a === "end") spAgain(); });
$("#modeSp").onclick = spShow;
