/* 7.82 (Omar): Tenable, a solo list game in two editions: Normal and TenaBall (the football edition, in the Football mode greens). The TV shows a pyramid of ten hidden
   slots (1 at the top, 7 to 10 along the bottom) for a ranked list such as "Largest countries by area"; one player names as many as they can, in any order, typed on the
   laptop. A right answer fills its slot, a wrong one costs a life (3 by default; 5 or no limit in setup). The turn ends when all ten are found, the lives run out, the
   optional timer ends or the player stops; the slots still hidden are then shown one by one. 1 point per answer, +2 for all ten ("Tenable!").
   1 to 8 players take turns, each with their own list, for 1 to 5 lists each (default 3); the highest total wins and the winner screen plays the Siuuu clip.
   TenaBall's "Formations" switch (Omar, 2026-10-21) mixes famous starting lineups in at random with the lists (about one turn in three, TE.formShare; Omar asked for a mix, not lineups only), each drawn on half a pitch, with the team, the year, the occasion and the score:
   guess all 11 players. The lineups are the Formations category (v4work/out/form.json), the scores are in v4work/tenable/form-scores.json.
   Tapping a hidden slot shows one more letter each time (up to three), then gives the answer (for an answer said out loud or a spelling the checker missed).
   Matching: the main game's checker plus Speed Trivia's looser one (7.76: one slip from 4 letters, two from 7, three from 13), on the answer, its other names, or a surname.
   Lists: v4work/tenable/normal.json and football.json ({t, d, src, as, a:[[answer, value, [other names]]]}, ranked 1 to 10), checked online on 2026-10-21.
   No phones. Setup is saved on this device in jn_teCfg, and the lists already played in jn_teSeen; a game is not saved.
   The rules (the guess checker and a turn's state) live in TER below with no screen code, so v4work/tools/tenable-test.js can load just that region.
   To remove: delete this file, v4work/tenable/, v4work/tools/tenable-test.js, the 7.82 CSS block and #teo section in head.html, the Tenable button, its TT entry in title.js,
   its CF_MODES entry and the teLeave() call in showHome (src/app.js), TEN in build.js and 'tenable' in MODE_FILES. */

/*@rules*/
const TER = (() => {
  const BONUS = 2;   // 8.40 (Omar): +2 for all ten (or all 11 in a lineup); before: 5
  const loose = (lev, g, v) => { const n = v.length; return lev(g, v) <= (n <= 3 ? 0 : n <= 5 ? 1 : n <= 8 ? 2 : n <= 12 ? 3 : 4); };   // 7.85 (Omar): more leeway for typed answers; before: 0 up to 3 letters, 1 up to 6, 2 up to 12, 3 beyond
  /* 7.86 (Omar): a slot whose answer is "A / B" (a tie at the cut) accepts either name */
  function variants(it, norm){ const out = new Set(); [it.a].concat(String(it.a).split(" / "), it.alt || []).forEach(x => { const s = norm(x); if(s) out.add(s); }); return [...out]; }
  /* how well guess g (already normalised) names item it: 0 exact, 1 close spelling, 2 the surname exactly, 3 the surname closely, Infinity not at all */
  function score(g, it, norm, lev){ let best = Infinity; const gs = g.replace(/ /g, "");
    for(const v of variants(it, norm)){ const vs = v.replace(/ /g, "");
      if(g === v || gs === vs) return 0;
      { const fw = v.split(" "); if(it.mk && fw.length > 1 && g.indexOf(" ") < 0 && lev(g, fw[0]) <= 2) continue; }   // 8.16 (Omar): a bare make such as "Toyota" or "Volkswagen" never counts for "Toyota Corolla"; undo: delete this line
      if(it.mk && g.indexOf(" ") > 0 && v.indexOf(" ") > 0){ const a = g.split(" "), b = v.split(" "); if(loose(lev, a[0], b[0]) && loose(lev, a.slice(1).join(" "), b.slice(1).join(" ")) && (a[a.length - 1] === b[b.length - 1] || Math.min(a[a.length - 1].length, b[b.length - 1].length) > 2)) best = Math.min(best, 1); continue; }   // 8.18: car lists, make and model are spelled separately so a close model ("Yaris" for "Camry") can't pass
      if(loose(lev, g, v) || loose(lev, gs, vs)) best = Math.min(best, 1);
      const w = v.split(" "), last = w[w.length - 1];
      if(!it.mk && w.length > 1 && w[0].length >= 4 && g === w[0]) best = Math.min(best, 0.4);   // 8.34 (Omar): "Nottingham" is Nottingham Forest, and beats a close spelling of another name ("Tottenham"); several slots sharing that first word make the guess vague (see Turn.guess)
      if(w.length > 1 && last.length >= 4){ if(g === last) best = Math.min(best, 2); else if(g.length >= 4 && loose(lev, g, last)) best = Math.min(best, 3); } }
    return best; }
  /* o = {items:[{a, v, alt}] (10 for a list, 11 for a lineup), lives (0 = no limit), norm, lev}. Phases: live > over (how: all | lives | time | stop) */
  function Turn(o){
    const t = {items:o.items, found:o.items.map(() => false), label:o.items.map(() => ""), lives:o.lives || 0, left:o.lives || 0, wrong:[], over:false, how:null, given:0, hints:o.items.map(() => 0), flag:o.items.map(() => false)};
    const end = how => { t.over = true; t.how = how; };
    t.n = () => t.found.filter(Boolean).length;
    t.points = () => t.n() + (t.n() === t.items.length ? BONUS : 0);
    t.match = text => { const g = o.norm(text); if(!g) return null; const sc = t.items.map(it => score(g, it, o.norm, o.lev)), m = Math.min(...sc); t.lastMin = m;
      if(m === Infinity && g.indexOf(" ") > 0){ const pre = t.items.map((it, i) => !it.mk && variants(it, o.norm).some(v => v.indexOf(g + " ") === 0) ? i : -1).filter(i => i >= 0);   // 8.34 (Omar): "Avatar Fire" is "Avatar: Fire and Ash": two or more words that start exactly one answer count
        if(pre.length === 1){ t.lastMin = 1; return pre; } }
      return m === Infinity ? [] : sc.map((s, i) => s === m ? i : -1).filter(i => i >= 0); };
    t.guess = text => {
      if(t.over) return {k:"over"}; const raw = String(text || "").trim(), hit = t.match(raw); if(hit === null) return {k:"empty"};
      if(!hit.length){ const g = o.norm(raw);
        /* 8.18 (Omar, car lists only: items with mk): a bare make ("Toyota") is not an answer and costs no life, but every hidden slot that starts with it now reads "Toyota ..." */
        const mk = g.indexOf(" ") < 0 && g.length >= 3 ? t.items.map((it, i) => { const w = o.norm(it.a).split(" "); return it.mk && !t.found[i] && w.length > 1 && o.lev(g, w[0]) <= (w[0].length >= 8 ? 2 : w[0].length >= 5 ? 1 : 0) ? i : -1; }).filter(i => i >= 0) : [];
        if(mk.length) return {k:"make", t:String(t.items[mk[0]].a).split(/\s+/)[0]};
        if(t.wrong.some(w => o.norm(w) === g)) return {k:"again", t:raw};   // the same wrong answer twice costs one life
        t.wrong.push(raw); if(t.lives){ t.left--; if(t.left <= 0) end("lives"); }
        const gw = g.split(" ")[0], mkw = g.indexOf(" ") > 0 && gw.length >= 3 ? t.items.map(it => String(it.a).split(/\s+/)[0]).find((w, i) => t.items[i].mk && t.items[i].a.indexOf(" ") > 0 && o.lev(gw, o.norm(w)) <= (w.length >= 8 ? 2 : w.length >= 5 ? 1 : 0)) : null;   // 8.18: a right make with the wrong model
        return mkw ? {k:"wrong", t:raw, mk:mkw} : {k:"wrong", t:raw}; }
      const fresh = hit.filter(i => !t.found[i]); if(!fresh.length) return {k:"dup", i:hit[0]};
      if(t.lastMin === 0.4 && new Set(fresh.map(i => o.norm(t.items[i].a))).size > 1) return {k:"vague", t:raw};   // 8.34: only a first word, and it starts several hidden answers: no life lost, say which one
      const name = o.norm(t.items[fresh[0]].a), same = fresh.filter(i => o.norm(t.items[i].a) === name);   // two players with the same name both fill
      { const parts = String(t.items[fresh[0]].a).split(" / "); if(parts.length > 2){ let bp = parts[0], bs = Infinity; parts.forEach(pt => { const sc = score(o.norm(raw), {a:pt, alt:[]}, o.norm, o.lev); if(sc < bs){ bs = sc; bp = pt; } }); same.forEach(i => t.label[i] = bp); } }   // 8.32: a slot that stands for a many-way tie shows the name that was typed, not all of them
      same.forEach(i => t.found[i] = true); if(t.found.every(Boolean)) end("all"); return {k:"right", i:same}; };
    t.give = i => { if(t.over || t.found[i] == null || t.found[i]) return false; t.found[i] = true; t.given++; if(t.found.every(Boolean)) end("all"); return true; };
    /* 7.85 (Omar): tapping a hidden slot reveals one more letter each time (first letter, then two, then three); the tap after that gives the whole answer */
    /* 8.5 (Omar): in TenaBall the first tap on a slot shows the answer's flag (items with an f code, set by teFlags), the taps after that give letters as above */
    t.tap = i => { if(t.over || t.found[i] == null || t.found[i]) return null; const len = Array.from(String(t.items[i].a)).length;
      if(t.items[i].f && !t.flag[i]){ t.flag[i] = true; return "hint"; }
      if(t.hints[i] < Math.min(3, len - 1)){ t.hints[i]++; return "hint"; } return t.give(i) ? "give" : null; };
    t.hintText = i => t.hints[i] ? Array.from(String(t.items[i].a)).slice(0, t.hints[i]).join("") + "…" : "";
    t.stop = how => { if(t.over) return false; end(how || "stop"); return true; };
    return t; }
  return {Turn, score, BONUS};
})();
/*@end-rules*/

const TE = {cfg:null, phase:"setup", turns:[], ti:0, t:null, item:null, flash:null, rev:0, revT:null, tmr:null, dl:0, sung:false};
const TE_DEF = {sub:"n", form:false, players:["Player 1"], per:3, lives:3, secs:0, choose:false};
const teClock = n => { n = Math.max(0, Math.ceil(n)); return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0"); };
TE.cfg = Object.assign({}, TE_DEF, store.get("jn_teCfg", {})); if(!Array.isArray(TE.cfg.players) || !TE.cfg.players.length) TE.cfg.players = ["Player 1"];
if(![0, 120, 180, 300, 600].includes(TE.cfg.secs)) TE.cfg.secs = 0;   /* 8.25 (Omar): timer buttons read Off 2 3 5 10 under "Timer per list (in minutes)"; before: "2 minutes", "3 minutes", "5 minutes" and no 10 */   /* 7.93: older saves held 60/90/120 s */
const teSave = () => store.set("jn_teCfg", TE.cfg);
const teMix = () => TE.cfg.sub === "m";   // 7.86 (Omar): the Mix edition deals Tenable and TenaBall lists in one game; each list wears its own edition's look
const teBall = () => TE.cfg.sub === "f" || (["ready", "play", "done"].includes(TE.phase) && !!TE.turns[TE.ti] && !!TE.turns[TE.ti].list && TE.turns[TE.ti].list.ed === "f"), teForm = () => (TE.cfg.sub === "f" || teMix()) && TE.cfg.form;
const teName = () => teBall() ? "TenaBall" : teMix() && (!["ready", "play", "done"].includes(TE.phase) || (TE.turns[TE.ti] && !TE.turns[TE.ti].list)) ? "Tenable Mix" : "Tenable";   // 8.42 (Omar): the Choose list grid in Mix says Tenable Mix too
const teShuf = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- the lists ---------- */
const tePad = n => String(n).padStart(3, "0");   // 8.32 (Omar): both editions have 100 lists, so IDs start from 001 (NM#001, FM#001); before: two digits (NM#01), set in 7.84
/* 8.5 (Omar): flags for the first tap. v4work/tenable/flags.json holds one comma list of flag codes per list or lineup (same order as the answers); a list where every answer has the same flag gets none, and neither does one with no data */
function teFlags(items, codes){ const c = String(codes || "").split(","); if(c.length !== items.length || new Set(c.filter(Boolean)).size < 2) return items; c.forEach((x, i) => { if(x) items[i].f = x; }); return items; }
function teLineups(){ const d = (typeof DATA !== "undefined" && DATA.form) || {}, out = [];
  const all = []; Object.keys(d).forEach(v => (d[v] || []).forEach(x => all.push(x)));
  (Array.isArray(TEN.lx) ? TEN.lx : []).forEach(x => all.push(x));   // 8.1 (Omar): Tenable-only lineups from v4work/tenable/lineups.json, after the Formations ones so the FMF# numbers stay put
  all.forEach(([q, a]) => { const ln = String(q).split("\n"), m = String(a).match(/^(.*?), (\S+) \((.*)\)$/);
    const rows = ln.slice(1).map(r => r.split(" · ").map(s => s.trim()).filter(Boolean));
    if(rows.flat().length !== 11) return;
    out.push({ed:"f", key:a, id:"FMF#" + String(out.length + 1).padStart(3, "0"), form:ln[0], rows, t:m ? m[1] : a, yr:m ? m[2] : "", d:m ? m[3] : "", score:(TEN.fs || {})[a] || "", items:teFlags(rows.flat().map(n => ({a:n})), ((TEN.fl || {}).x || {})[a])}); });
  return out; }
const teLists = ed => (ed === "f" ? TEN.f : TEN.n).map((L, i) => ({ed, id:(ed === "f" ? "FM#" : "NM#") + tePad(i + 1), key:L.t, t:L.t, d:L.d, src:L.src, as:L.as, items:ed === "f" ? teFlags(L.a.map(([a, v, alt]) => ({a, v, alt:alt || []})), ((TEN.fl || {}).l || {})[L.t]) : L.a.map(([a, v, alt]) => ({a, v, alt:alt || [], mk:!!L.mk}))}));   // 8.18: mk = the list is made of make + model answers (the car lists)
TE.formShare = 1 / 3;   // 7.82 (Omar): with Formations on, lineups are mixed in at random with the football lists (about one turn in three), not lineups only
function teDraw(pool, k, seen){   // a list not played on this device yet (all of them again once every one has been played)
  const s = new Set(seen[k] || []); let fresh = pool.filter(L => !s.has(L.key)); if(!fresh.length){ s.clear(); fresh = pool; }
  const L = fresh[Math.floor(Math.random() * fresh.length)]; s.add(L.key); seen[k] = [...s]; return L; }
function teDeal(n){
  const seen = store.get("jn_teSeen", {}), lineups = teForm() ? teLineups() : [], out = [];
  for(let i = 0; i < n; i++) { const ed = teMix() ? (Math.random() < 0.5 ? "n" : "f") : TE.cfg.sub; out.push(lineups.length && ed === "f" && Math.random() < TE.formShare ? teDraw(lineups, "fm", seen) : teDraw(teLists(ed), ed, seen)); }   // 8.41: in Mix only the football half can turn into a lineup (before: any card could, so Tenable got about a third)
  store.set("jn_teSeen", seen); return out; }
/* 8.37 (Omar): "Choose list" switch. Each turn opens on a 3 by 3 grid of 9 lists (not played on this device yet where possible) and the player picks one; only the picked list counts as played */
/* 8.41 (Omar): in Mix the grid is close to half and half: 3 to 6 Tenable lists (mostly 4 or 5), the rest football, and only football cards can be lineups. Before: each card was a coin flip and lineups also took Tenable's places, so Tenable often got only 2 or 3 of 9 */
const teMixPlan = n => { const k = [3, 4, 4, 5, 5, 6][Math.floor(Math.random() * 6)]; return teShuf(Array.from({length:n}, (_, i) => i < Math.round(k * n / 9) ? "n" : "f")); };
function teOffer(n){ const seen = store.get("jn_teSeen", {}), lineups = teForm() ? teLineups() : [], out = [], keys = new Set(), plan = teMix() ? teMixPlan(n) : [];
  for(let k = 0; k < n * 6 && out.length < n; k++){ const ed = teMix() ? plan[out.length] : TE.cfg.sub, fm = lineups.length && ed === "f" && Math.random() < TE.formShare;
    const pool = fm ? lineups : teLists(ed), s = new Set(seen[fm ? "fm" : ed] || []); let fresh = pool.filter(L => !s.has(L.key) && !keys.has(L.key)); if(!fresh.length) fresh = pool.filter(L => !keys.has(L.key)); if(!fresh.length) continue;
    const L = fresh[Math.floor(Math.random() * fresh.length)]; keys.add(L.key); out.push(L); }
  return out; }
function teMark(L){ const seen = store.get("jn_teSeen", {}), k = L.rows ? "fm" : L.ed, s = new Set(seen[k] || []); s.add(L.key); seen[k] = [...s]; store.set("jn_teSeen", seen); }
function teChoose(i){ const tu = TE.turns[TE.ti], L = tu && tu.opts && tu.opts[i]; if(!L) return; tu.list = L; tu.opts = null; teMark(L); teGo(); }

/* ---------- the flow ---------- */
function teStart(){
  const ps = TE.cfg.players.map(p => String(p).trim()).filter(Boolean).slice(0, 8); if(!ps.length) return; TE.cfg.players = ps; if(!TE.pick) teSave();
  stopSiu(); try{ Snd.unlock(); }catch(e){}
  const solo = ps.length === 1, lists = TE.cfg.choose ? Array(solo ? 1 : ps.length * TE.cfg.per).fill(null) : teDeal(solo ? 1 : ps.length * TE.cfg.per); TE.turns = [];   // 7.82 (Omar): a solo player isn't limited to a number of lists: the next one is dealt when they press Next, until they press Finish
  if(solo) TE.turns.push({p:0, r:0, list:lists[0], pts:0, n:0});
  else for(let r = 0; r < TE.cfg.per; r++) ps.forEach((p, i) => TE.turns.push({p:i, r, list:lists[(r * ps.length + i) % lists.length], pts:0, n:0}));
  TE.scores = ps.map(() => 0); TE.ti = 0; TE.sung = false; teReady(); }
function teReady(){ TE.phase = "ready"; TE.t = null; TE.flash = null; clearInterval(TE.revT); const tu = TE.turns[TE.ti]; if(tu && !tu.list) tu.opts = teOffer(9); teRender(); }
function teGo(){ const tu = TE.turns[TE.ti];
  TE.t = TER.Turn({items:tu.list.items, lives:TE.cfg.lives, norm:ansNorm, lev}); TE.phase = "play"; TE.flash = null; TE.rev = 0;
  TE.dl = TE.cfg.secs ? Date.now() + TE.cfg.secs * 1000 : 0; TE.tk = null; teRender(); const i = $("#teIn"); if(i) i.focus(); }
function teEnd(){ const tu = TE.turns[TE.ti], t = TE.t; tu.n = t.n(); tu.pts = t.points(); TE.scores[tu.p] += tu.pts; TE.phase = "done";
  if(t.how === "all"){ try{ Snd.fanfare(); }catch(e){} } else { try{ Snd.buzz(); }catch(e){} }
  const hid = t.found.map((f, i) => f ? -1 : i).filter(i => i >= 0); TE.rev = 0; clearInterval(TE.revT);
  if(hid.length) TE.revT = setInterval(() => { TE.rev++; teRender(); if(TE.rev >= hid.length) clearInterval(TE.revT); }, 380);   // the missed answers appear one by one
  teRender(); }
function teNext(){ clearInterval(TE.revT); if(TE.cfg.players.length === 1 && TE.ti + 1 >= TE.turns.length) TE.turns.push({p:0, r:TE.ti + 1, list:TE.cfg.choose ? null : teDeal(1)[0], pts:0, n:0}); TE.ti++; if(TE.ti >= TE.turns.length){ TE.phase = "over"; if(!TE.sung){ TE.sung = true; playWinSiu(); } teRender(); return; } teReady(); }
/* 7.86 (Omar): the Next button (top right) skips to the next list right away: no answers are shown, whatever was found still scores */
function teSkip(){ if(TE.phase !== "play" || !TE.t) return; const tu = TE.turns[TE.ti], t = TE.t; t.stop("skip"); tu.n = t.n(); tu.pts = t.points(); TE.scores[tu.p] += tu.pts; TE.phase = "done";
  teNext(); if(TE.phase === "ready" && TE.cfg.players.length === 1 && TE.turns[TE.ti].list) teGo(); }
/* 8.0 (Omar): with two or more players the Next button is Swap: the same player gets a fresh list straight away (new lives and timer); nothing found on the swapped list scores */
function teSwap(){ if(TE.phase !== "play" || !TE.t) return; const tu = TE.turns[TE.ti]; TE.t.stop("swap"); if(TE.cfg.choose){ tu.list = null; teReady(); return; } let L = teDeal(1)[0];
  for(let k = 0; k < 5 && L.key === tu.list.key; k++) L = teDeal(1)[0];
  tu.list = L; teGo(); }
function teGuess(){ const inp = $("#teIn"); if(!inp || !TE.t || TE.phase !== "play") return; const txt = inp.value; inp.value = ""; const r = TE.t.guess(txt);
  if(r.k === "empty") return;
  if(r.k === "right"){ try{ Snd.rise(); }catch(e){} TE.flash = {k:"ok", i:r.i}; }
  else if(r.k === "wrong"){ try{ Snd.fall(); }catch(e){} TE.flash = {k:"bad", t:r.t, mk:r.mk}; }
  else if(r.k === "make") TE.flash = {k:"make", t:r.t};
  else if(r.k === "vague") TE.flash = {k:"vague", t:r.t};
  else TE.flash = {k:r.k === "dup" ? "dup" : "again", t:r.k === "dup" ? (String(TE.t.items[r.i].a).indexOf(" / ") > -1 ? txt : TE.t.items[r.i].a) : r.t};   // 8.32: a tie slot ("A / B") has a long answer, so say the name that was typed
  if(TE.t.over) teEnd(); else { teRender(); const i = $("#teIn"); if(i) i.focus(); } }
function teTick(){ if(TE.phase !== "play" || !TE.dl) return; const left = TE.dl - Date.now(), b = $("#teBar"), l = $("#teLeft");
  if(b) b.style.width = Math.max(0, Math.min(100, left / (TE.cfg.secs * 10))) + "%"; if(l) l.textContent = teClock(left / 1000);
  /* 7.94 (Omar): the timer is only a clock for the room. At zero nothing happens on the board (it used to stop the list); the last 10 seconds tick and zero gives one chime. Old: if(left <= 0){ TE.t.stop("time"); teEnd(); } */
  const sec = Math.max(0, Math.ceil(left / 1000));
  if(TE.tk !== sec){ TE.tk = sec; try{ if(sec >= 1 && sec <= 10) Snd.tick(); else if(sec === 0) Snd.chime(); }catch(e){} } }

/* ---------- screens ---------- */
function teEnter(){ if(S.mode === "tenable") return; S.mode = "tenable"; document.body.classList.add("temode"); }
function teLeave(){ if(S.mode !== "tenable") return; stopSiu(); clearInterval(TE.tmr); clearInterval(TE.revT); TE.tmr = null; TE.phase = "setup"; TE.t = null;
  S.mode = null; document.body.classList.remove("temode", "teball"); $("#teo").hidden = true; }
function teShow(){ teEnter(); teUnpick(); ["#titleScreen", "#setup", "#game", "#scores"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  TE.phase = "setup"; $("#teo").hidden = false; teRender(); window.scrollTo(0, 0); clearInterval(TE.tmr); TE.tmr = setInterval(teTick, 200); }
const teSeg = (key, opts, cur) => `<div class="teseg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
const teLives = t => !t.lives ? `<span class="telives inf">No life limit</span>` : `<span class="telives">${Array.from({length:t.lives}, (_, i) => `<i class="${i < t.left ? "on" : ""}"></i>`).join("")}</span>`;
function teSlot(tu, t, i, rk){ const it = tu.list.items[i], f = t ? t.found[i] : false, done = TE.phase === "done";
  const hid = t ? t.found.map((x, j) => x ? -1 : j).filter(j => j >= 0) : [], shown = done && hid.indexOf(i) > -1 && hid.indexOf(i) < TE.rev;
  const flg = !f && !shown && t && t.flag[i] && it.f ? `<img class="teflag" src="photos/flags/${it.f}.svg" alt="">` : "";
  const cls = !f && !shown && t && (t.hints[i] || flg) ? "hint" : f ? "ok" + (TE.flash && TE.flash.k === "ok" && TE.flash.i.includes(i) ? " new" : "") : shown ? "miss" : "";
  const hnt = !f && !shown && t && t.hints[i] ? t.hintText(i) : "";
  const nm = f && t && t.label[i] ? t.label[i] : it.a;
  const txt = f || shown ? `<b>${esc(nm)}</b>${it.v ? `<small>${esc(it.v)}</small>` : ""}` : hnt || flg ? `${flg}${hnt ? `<b class="tehintl">${esc(hnt)}</b>` : ""}` : "";
  return `<button class="teslot ${cls}" data-give="${i}" ${f || shown || TE.phase !== "play" ? "tabindex=-1" : `title="Tap for a letter, again for more, then the answer"`}><em>${rk}</em><span class="${String(nm).length > 30 ? "long xlong" : String(nm).length > 16 ? "long" : ""}">${txt}</span></button>`; }
function tePyramid(tu, t){ let i = 0, h = ""; [1, 2, 3, 4].forEach(n => { h += `<div class="terow">`; for(let k = 0; k < n; k++, i++) h += teSlot(tu, t, i, i + 1); h += `</div>`; }); return `<div class="tepyr">${h}</div>`; }
function tePitch(tu, t){ const rows = tu.list.rows, n = rows.length; let i = 0, h = "";
  rows.forEach((r, ri) => { const y = n > 1 ? 13 + ri * (72 / (n - 1)) : 50;
    r.forEach((_, k) => { const x = (r.length - k) * 100 / (r.length + 1), idx = i++, it = tu.list.items[idx], f = t ? t.found[idx] : false;
      const hid = t ? t.found.map((z, j) => z ? -1 : j).filter(j => j >= 0) : [], shown = TE.phase === "done" && hid.indexOf(idx) > -1 && hid.indexOf(idx) < TE.rev;
      h += `<button class="teman ${f ? "ok" : shown ? "miss" : ""}${f && TE.flash && TE.flash.k === "ok" && TE.flash.i.includes(idx) ? " new" : ""}" data-give="${idx}" style="left:${x}%;top:${ri === n - 1 ? 87 : y}%"><i${!f && !shown && t && t.flag[idx] && it.f ? ` class="fl" style="background-image:url(photos/flags/${it.f}.svg)"` : ""}></i><span>${f || shown ? esc(it.a) : (t && t.hints[idx] ? esc(t.hintText(idx)) : "?")}</span></button>`; }); });
  return `<div class="tepitch"><div class="telines"><b class="box"></b><b class="six"></b><b class="arc"></b><b class="mid"></b></div>${h}</div>`; }   /* 8.46 (Omar): no formation label (e.g. 5-3-2) in the pitch's top left. Was: ${h}<div class="tecap"><div class="tefm">${esc(tu.list.form)}</div></div></div> */
function teBoard(){ const ps = TE.cfg.players; if(ps.length < 2) return "";
  return `<div class="tescore">${ps.map((p, i) => `<span class="${TE.turns[TE.ti] && TE.turns[TE.ti].p === i && TE.phase !== "over" ? "cur" : ""}">${esc(p)} <b>${TE.scores[i]}</b></span>`).join("")}</div>`; }
function teHead(tu){ const L = tu.list;
  return L.rows ? `<div class="tehd form"><div class="tet">${esc(L.t)} <span>${esc(L.yr)}</span></div><div class="ted">${esc(L.d)}</div>${L.score ? `<div class="tesc">${esc(L.score)}</div>` : ""}<div class="tegoal">Name all 11 starters</div></div>`
    : `<div class="tehd"><div class="tet">${esc(L.t)}</div><div class="ted">${esc(L.d || "")}</div></div>`; }
function teListsShow(){   // 7.98 (Omar): every list with its ID and title, newest first, split into sections that start collapsed; tapping one plays it as a solo game
  const sec = (name, k, rows) => `<details><summary>${name}<small>${rows.length}</small></summary><ol>${rows.map((L, i) => [L, i]).reverse().map(([L, i]) => `<li><button data-pk="${k}|${i}"><b>${L.id}</b><span>${esc(L.t)}${L.yr ? " " + esc(L.yr) : ""}</span></button></li>`).join("")}</ol></details>`;
  let ov = $("#teLs"); if(!ov){ ov = document.createElement("div"); ov.id = "teLs"; ov.className = "tels"; $("#teo").appendChild(ov); }
  ov.innerHTML = `<div role="dialog" aria-label="Lists"><header><h2>Lists</h2><button class="tebtn ghost small" data-lsx="1">Close</button></header><p class="note">Newest first. Tap a list to play it now as a solo game.</p>${sec("Tenable", "n", teLists("n"))}${sec("TenaBall", "f", teLists("f"))}${sec("TenaBall Formations", "fm", teLineups())}</div>`;
  ov.hidden = false; }
function tePick(k, i){   // a solo game that opens with the chosen list (the setup's players come back on return to setup)
  const L = (k === "fm" ? teLineups() : teLists(k))[i]; if(!L) return; if(!TE.pick) TE.pick = TE.cfg.players.slice();
  TE.cfg.players = [String(TE.pick[0] || "").trim() || "Player 1"]; $("#teLs").hidden = true; stopSiu(); try{ Snd.unlock(); }catch(e){}
  TE.turns = [{p:0, r:0, list:L, pts:0, n:0}]; TE.scores = [0]; TE.ti = 0; TE.sung = false; teReady(); }
const teUnpick = () => { if(TE.pick){ TE.cfg.players = TE.pick; TE.pick = null; } };
function teRender(){
  const el = $("#teBody"); if(!el) return; document.body.classList.toggle("teball", teBall()); const c = TE.cfg, ball = teBall() || teMix(); const sk = $("#teSkip"); if(sk){ sk.hidden = TE.phase !== "play"; sk.textContent = c.players.length > 1 ? "Swap" : "Next"; } const lb = $("#teListsBtn"); if(lb) lb.hidden = TE.phase !== "setup";
  if(TE.phase === "setup"){
    const nLists = teMix() ? TEN.n.length + TEN.f.length : (ball ? TEN.f : TEN.n).length, nForm = teLineups().length;
    el.innerHTML = `<div class="tehead"><div class="tebadge">Game mode</div><h1>${teName()}</h1><p class="sub">${teMix() ? "Top-ten lists from both editions in one game: general knowledge in the Tenable look, football in the TenaBall look. Name as many as you can, in any order." : teForm() ? "Football top tens, with a famous starting lineup mixed in now and then: drawn on half a pitch with the team, the year and the score, name all 11 players. Any order, every time." : "A top-ten list hides behind a pyramid of ten slots. Name as many as you can, in any order. Every right answer fills its slot; every wrong one costs a life."}</p></div>
      <div class="tegrid">
      <div class="tepanel"><div class="teeye">Edition</div>${teSeg("sub", [["n", "Tenable"], ["f", "TenaBall"], ["m", "Mix"]], c.sub)}
        <p class="note">${teMix() ? `Mix deals ${nLists} top tens from both editions in one game: Tenable lists and TenaBall football lists, each in its own look.` : ball ? `TenaBall is the football edition: ${nLists} football top tens.` : `${nLists} top tens: countries, films, music, the internet, science and more.`}</p>
        ${ball ? `<div class="teeye">Formations</div>${teSeg("form", [[0, "Off"], [1, "On"]], c.form ? 1 : 0)}<p class="note">On: famous starting lineups (${nForm} of them) are mixed in at random with the top tens, about one turn in three. Name all 11 players from the lineup on half a pitch.</p>` : ""}</div>
      <div class="tepanel"><div class="teeye">Players · ${c.players.length} of 8</div>
        <div class="tenames">${c.players.map((p, i) => `<div class="tename"><input data-pl="${i}" value="${esc(p)}" maxlength="18" aria-label="Player ${i + 1} name">${c.players.length > 1 ? `<button data-rm="${i}" aria-label="Remove ${esc(p)}">×</button>` : ""}</div>`).join("")}</div>
        ${c.players.length < 8 ? `<button class="tebtn small ghost" data-add="1">Add a player</button>` : ""}
        <p class="note">One player is a solo game. With more, players take turns, each with their own list.</p></div>
      <div class="tepanel">${c.players.length > 1 ? `<div class="teeye">Lists each</div>${teSeg("per", [1, 2, 3, 4, 5].map(n => [n, n]), c.per)}` : `<div class="teeye">Lists</div><p class="note">Solo play never runs out: keep going list after list, and press Finish when you want to stop.</p>`}
        <div class="teeye">Lives</div>${teSeg("lives", [[3, "3"], [5, "5"], [0, "No limit"]], c.lives)}
        <div class="teeye">Choose list</div>${teSeg("choose", [[0, "Off"], [1, "On"]], c.choose ? 1 : 0)}<p class="note">On: each turn starts with 9 lists in a 3 by 3 grid, and the player picks the one to play.</p>
        <div class="teeye">Timer per list (in minutes)</div>${teSeg("secs", [[0, "Off"], [120, "2"], [180, "3"], [300, "5"], [600, "10"]], c.secs)}
        <p class="note">Type each guess on this laptop and press Enter. A wrong guess costs a life. 1 point per answer, +${TER.BONUS} for getting them all. Spelling doesn't have to be perfect, and surnames are enough. For a clue, tap a hidden slot: each tap shows one more letter (up to three), and the next tap gives the whole answer. The timer is just a clock for the room: the last 10 seconds tick, and at zero nothing stops on the board.</p>
        <button class="tebtn go" id="teGo">Start</button></div></div>`;
    return; }
  if(TE.phase === "over"){ const ps = c.players, rows = ps.map((p, i) => ({p, s:TE.scores[i], n:TE.turns.filter(t => t.p === i).reduce((a, t) => a + t.n, 0), all:TE.turns.filter(t => t.p === i && t.list && t.n === t.list.items.length).length})).sort((a, b) => b.s - a.s);
    const top = rows[0].s, win = rows.filter(r => r.s === top), max = TE.turns.filter(t => t.p === 0).reduce((a, t) => a + (t.list ? t.list.items.length : 0), 0);
    el.innerHTML = `<div class="tetv"><div class="teover"><div class="tebadge">${teName()}</div>
      <div class="tewin">${ps.length === 1 ? `${rows[0].n} of ${max}` : win.map(r => esc(r.p)).join(" and ")}<span>${ps.length === 1 ? `found by ${esc(rows[0].p)} · ${top} points` : win.length > 1 ? "share the win" : "wins the night"}</span></div>
      ${ps.length > 1 ? `<ol class="teplace">${rows.map((r, i) => `<li><b>${i + 1}</b><span>${esc(r.p)}</span><small>${r.n} found${r.all ? ` · ${r.all}× all` : ""}</small><em>${r.s}</em></li>`).join("")}</ol>` : rows[0].all ? `<p class="note">${rows[0].all === 1 ? "One full house" : rows[0].all + " full houses"}: every answer found.</p>` : ""}
      <div class="tectl"><button class="tebtn go" data-act="again">Play again</button><button class="tebtn ghost" data-act="setup">Change setup</button></div></div></div>`;
    return; }
  const tu = TE.turns[TE.ti], t = TE.t, p = c.players[tu.p], tot = TE.turns.length;
  const top = `<div class="tetop"><span class="telogo">${teName()}</span><span></span><span>${c.players.length > 1 && TE.phase !== "ready" ? `<b class="tepl">${esc(p)}</b>` : ""}${t ? teLives(t) : ""}${TE.dl && TE.phase === "play" ? ` <span class="teclock"><span id="teLeft">${teClock((TE.dl - Date.now()) / 1000)}</span></span>` : ""}</span></div>
    ${TE.dl && TE.phase === "play" ? `<div class="tebar"><i id="teBar" style="width:${Math.max(0, Math.min(100, (TE.dl - Date.now()) / (c.secs * 10)))}%"></i></div>` : ""}`;
  if(TE.phase === "ready" && !tu.list){
    el.innerHTML = `<div class="tetv">${top}<div class="tepick"><small>${c.players.length > 1 ? "Next up" : "Your pick"}</small><h2>${esc(p)}, choose a list</h2>
      <div class="techo">${(tu.opts || []).map((L, i) => `<button data-cho="${i}" class="${L.ed === "f" ? "ball" : ""}"><em>${L.id}</em><b>${esc(L.t)}${L.yr ? " " + esc(L.yr) : ""}</b>${L.rows ? `<small>Lineup</small>` : ""}</button>`).join("")}</div></div><div class="tectl"><span class="gap"></span><button class="tebtn small ghost" data-act="end">End game</button></div>${teBoard()}</div>`; return; }
  if(TE.phase === "ready"){
    el.innerHTML = `<div class="tetv">${top}<div class="teready"><small>${c.players.length > 1 ? "Next up" : "Ready?"}</small><h2>${esc(p)}</h2>
      <p>${!!tu.list.rows ? "A lineup is coming: name all 11 players." : "A top ten is coming: name all ten."} ${c.lives ? `${c.lives} lives.` : "No life limit."}${c.secs ? ` ${c.secs / 60} minutes.` : ""}</p>
      <button class="tebtn go" data-act="go">Show the ${!!tu.list.rows ? "lineup" : "list"}</button></div>${teBoard()}</div>`; return; }
  const fl = TE.flash, msg = TE.phase === "done"
    ? `<div class="teflash ${t.how === "all" ? "ok" : "bad"}">${t.how === "all" ? `${teName().toUpperCase()}! All ${t.items.length} found` : `${t.how === "lives" ? "Out of lives" : t.how === "time" ? "Time's up" : "Stopped"}: ${t.n()} of ${t.items.length} found`} · <b>+${tu.pts}</b></div>`
    : fl ? `<div class="teflash ${fl.k === "ok" ? "ok" : fl.k === "bad" ? "bad" : ""}">${fl.k === "ok" ? `Yes! <b>${esc(t.label[fl.i[0]] || tu.list.items[fl.i[0]].a)}</b>${!!tu.list.rows ? "" : ` is number ${fl.i[0] + 1}`}` : fl.k === "bad" && fl.mk ? `<b>${esc(fl.t)}</b> isn't the right ${esc(fl.mk)} model` : fl.k === "bad" ? `<b>${esc(fl.t)}</b> isn't ${!!tu.list.rows ? "in the lineup" : "on the list"}` : fl.k === "dup" ? `<b>${esc(fl.t)}</b> is already up there` : fl.k === "make" ? `<b>${esc(fl.t)}</b> alone isn't a model: say which one (no life lost)` : fl.k === "vague" ? `<b>${esc(fl.t)}</b> could be more than one: say the full name (no life lost)` : `<b>${esc(fl.t)}</b> was already guessed wrong (no life lost)`}</div>`
    : `<div class="teflash">${t.n()} of ${t.items.length} found</div>`;
  const lid = tu.list.id ? `<span class="teid">${tu.list.id}</span>` : "";   // 7.84 (Omar): every list has a fixed ID (NM#1.. Normal, FM#1.. TenaBall; lineups follow the football lists) so he can tell which have been played; solo shows only the ID
  const no = `<span class="telistno">${c.players.length > 1 ? `<span>${!!tu.list.rows ? "Lineup" : "List"} ${TE.ti + 1} of ${tot}</span>` : ""}${lid}</span>`;
  const ctl = TE.phase === "play"
    ? `<div class="tein"><input id="teIn" autocomplete="off" spellcheck="false" placeholder="Type a guess and press Enter"><button class="tebtn go" data-act="guess">Guess</button></div>
       <div class="tectl">${no}<button class="tebtn small ghost" data-act="stop">Stop here</button><span class="gap"></span><span class="tehint">Tap a hidden slot for a hint</span><button class="tebtn small ghost" data-act="end">End game</button></div>`
    : `<div class="tectl done">${no}<button class="tebtn go" data-act="next">${c.players.length === 1 ? "Next list" : TE.ti + 1 >= TE.turns.length ? "See the results" : `Next: ${esc(c.players[TE.turns[TE.ti + 1].p])}`}</button>${c.players.length === 1 ? `<button class="tebtn ghost" data-act="finish">Finish</button>` : ""}<span class="gap"></span></div>`;
  el.innerHTML = `<div class="tetv${!!tu.list.rows ? " fm" : ""}">${top}<div class="temain">${teHead(tu)}${!!tu.list.rows ? tePitch(tu, t) : tePyramid(tu, t)}</div>${msg}
    ${t.wrong.length ? `<div class="tewrong">${t.wrong.slice(-8).map(w => `<s>${esc(w)}</s>`).join("")}</div>` : ""}${ctl}${teBoard()}</div>`; }
$("#teo").addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if(set){ const k = set.dataset.set, v = set.dataset.v; TE.cfg[k] = k === "sub" ? v : k === "form" || k === "choose" ? v === "1" : +v; teSave(); teRender(); return; }
  if(e.target.closest("[data-add]")){ TE.cfg.players.push("Player " + (TE.cfg.players.length + 1)); teSave(); teRender(); const ins = document.querySelectorAll("#teo [data-pl]"); const l = ins[ins.length - 1]; if(l){ l.focus(); l.select(); } return; }
  const rm = e.target.closest("[data-rm]"); if(rm){ TE.cfg.players.splice(+rm.dataset.rm, 1); teSave(); teRender(); return; }
  if(e.target.closest("#teListsBtn")){ teListsShow(); return; }
  if(e.target.closest("[data-lsx]") || e.target.id === "teLs"){ $("#teLs").hidden = true; return; }
  const cho = e.target.closest("[data-cho]"); if(cho){ teChoose(+cho.dataset.cho); return; }
  const pk = e.target.closest("[data-pk]"); if(pk){ const [k, i] = pk.dataset.pk.split("|"); tePick(k, +i); return; }
  if(e.target.closest("#teGo")){ teStart(); return; }
  if(e.target.closest("#teSkip")){ if(TE.cfg.players.length > 1) teSwap(); else teSkip(); return; }
  if(e.target.closest("#teHome")){ leaveAsk(TE.phase === "ready" || TE.phase === "play" || TE.phase === "done", teName()); return; }
  const gv = e.target.closest("[data-give]"); if(gv && TE.phase === "play" && TE.t){ const r = TE.t.tap(+gv.dataset.give); if(r === "give"){ try{ Snd.rise(); }catch(e){} TE.flash = {k:"ok", i:[+gv.dataset.give]}; if(TE.t.over) teEnd(); else teRender(); } else if(r === "hint"){ TE.flash = null; teRender(); } return; }
  const act = e.target.closest("[data-act]"); if(!act) return; const a = act.dataset.act;
  if(a === "go") teGo();
  else if(a === "guess") teGuess();
  else if(a === "stop"){ if(TE.t && TE.t.stop("stop")) teEnd(); }
  else if(a === "next") teNext();
  else if(a === "finish"){ TE.phase = "over"; if(!TE.sung){ TE.sung = true; playWinSiu(); } teRender(); }
  else if(a === "again"){ stopSiu(); teStart(); }
  else if(a === "setup" || a === "end"){ stopSiu(); clearInterval(TE.revT); teUnpick(); TE.phase = "setup"; teRender(); } });
$("#teo").addEventListener("input", e => { const i = e.target.closest("[data-pl]"); if(i){ TE.cfg.players[+i.dataset.pl] = i.value; teSave(); } });
$("#teo").addEventListener("keydown", e => { if(e.key === "Enter" && e.target.id === "teIn"){ e.preventDefault(); teGuess(); } });
$("#modeTen").onclick = teShow;
