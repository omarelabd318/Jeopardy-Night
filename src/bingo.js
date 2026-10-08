/* 6.48 (Omar): Category Bingo. A 7x7 board of 49 categories; teams take turns claiming squares by answering a clue and the first to get 5 in a row
   wins. Each team has 1 or 2 steals to take an opponent's square. No points: a right answer claims, a wrong one leaves the square open.
   It reuses the clue card (openClue / renderClue) and the winner screen; app.js only calls bingoBanner, bingoAwards, bingoDone, bingoAgain,
   bingoSetupAgain and bingoLeave. Saved on this device in jn_bingo (game) and jn_bingoCfg (setup). To remove: see the 6.48 NOTES entry. */
const BG = {cfg:null, st:null};
const BG_N = 7, BG_SKIP = new Set(["spot","igf","cal","headl"]);   // A/B/C rounds are left out: a one-in-three guess would hand over a free square
const BG_LOOKS = [["classic","Classic","The game's own blue tiles with gold numbers. Claimed squares fill with the team colour."],["card","Bingo card","Paper-white squares on green felt. Claimed squares get a marker daub, like a real bingo card."],["neon","Neon","Dark board, every square glows in its section colour. Claimed squares light up solid."]];
const BG_SECS = CAT_GROUPS.filter(g => g && g[0] !== "Mixes");
const BG_TEAMCOL = ["#FFCC33","#2EC4B6","#FF6B5E","#B79CFF"];
const BG_SHORT = {egyph:"Egypt: Photos", ecin:"Egyptian Cinema", ploteg:"Plots: Egypt", quoteeg:"Quotes: Egypt", lyricar:"Lyrics: Arabic", emeg:"Emoji: Egypt", emseg:"Emoji Sent.: Egypt", ctryar:"Which Country? Arab", pl:"Premier League", ucl:"Champions League", fyear:"Year: Football", songt:"Song Titles", plot:"Bad Plots", lit:"Translated", toons:"Cartoons", blockbuster:"Blockbusters", qblank:"Fill the Quote", quote:"Movie Quotes", mb:"Money & Business", brand:"Brands", tg:"Tech & Gaming", memeeg:"Egyptian Memes", egh:"Egypt History", cairo:"Cairo", wc26:"World Cup 2026", islam:"Islam", ww2:"World War II", holi:"Holidays", cocktail:"Cocktails", ffood:"Fast Food", vgames:"Video Games", hgames:"Hunger Games", romcom:"Rom-Coms", acteg:"Act It Out: Egypt", emsen:"Emoji Sentences", pw:"One Word Clues", gk:"General Knowledge", facts:"Facts", cclub:"Common Club", path:"Career Path", mgr:"Managers", shirt:"Shirt Numbers", stad:"Stadiums", xfer:"Transfers", whoami:"Who Am I?", foodpic:"Guess the Food", gctry:"Guess the Country", actor:"Guess the Actor", footy:"Guess the Footballer", person:"Guess the Person", car:"Guess the Car", logo:"Guess the Logo", ctry:"Which Country?", shape:"Country Outlines", pin:"Map Pin", order:"Put It in Order", link:"What's the Link?", himym:"HIMYM", st:"Stranger Things", got:"Game of Thrones", hp:"Harry Potter", bb:"Breaking Bad", pb:"Prison Break", gta:"GTA V", food:"Food & Drink"};
const bgShort = id => BG_SHORT[id] || String(catById(id).name).replace(/\s*\(.*?\)/g, "");
const bgOk = id => { const c = catById(id); return !!c && !c.mode && c.type !== "mix" && c.type !== "closest" && !HIDDEN_IDS.has(id) && !BG_SKIP.has(id) && (!LOCKED_IDS.has(id) || unlocked.has(id)); };
const bgShuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const BG_LINES = (() => { const out = []; for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]) for(let r = 0; r < BG_N; r++) for(let c = 0; c < BG_N; c++){
  const L = []; for(let k = 0; k < 5; k++){ const rr = r + dr*k, cc = c + dc*k; if(rr < 0 || rr >= BG_N || cc < 0 || cc >= BG_N) break; L.push(rr*BG_N + cc); } if(L.length === 5) out.push(L); } return out; })();
const BG_CNT = (() => { const n = Array(BG_N*BG_N).fill(0); BG_LINES.forEach(L => L.forEach(i => n[i]++)); return n; })();
/* values by position: the more winning lines run through a square, the more it is worth. 8 squares of 100, 8 of 200, 12 of 300, 12 of 400, 9 of 500
   (Omar: fewer 100s, a few more 500s than 100s). Setup can switch to random or one flat value. */
const bgPosVal = i => { const n = BG_CNT[i], r = Math.floor(i / BG_N), c = i % BG_N; return n === 3 ? 100 : n === 4 ? (r === 3 || c === 3 ? 100 : 200) : n <= 6 ? 300 : n === 7 ? 400 : 500; };
function bgDefaults(){ return {teams: S.teams.slice(0, 4).map(t => t.name).concat(["Team A","Team B"]).slice(0, Math.max(2, Math.min(4, S.teams.length))), steals:2, fill:"balanced", sections:BG_SECS.map((_, i) => i), picks:[], values:"pos", flat:300, auto:true, start:"random", look:"classic"}; }
BG.cfg = Object.assign(bgDefaults(), store.get("jn_bingoCfg", {}));
const bgSave = () => { store.set("jn_bingoCfg", BG.cfg); };
const bgSecIds = () => BG_SECS.map(g => g[1].filter(bgOk));
const bgShares = (a, b) => { const ra = Math.floor(a / BG_N), ca = a % BG_N, rb = Math.floor(b / BG_N), cb = b % BG_N; return ra === rb || ca === cb || ra - ca === rb - cb || ra + ca === rb + cb; };
function bgFill(cfg){
  const secs = bgSecIds(), all = secs.map((_, i) => i).filter(i => secs[i].length);
  const chosen = cfg.fill === "sections" && cfg.sections.filter(i => secs[i] && secs[i].length).length ? cfg.sections.filter(i => secs[i] && secs[i].length) : all;
  const perm = bgShuffle(chosen.slice()), want = new Set(cfg.fill === "hand" ? cfg.picks : []), seq = {};
  const draw = si => { if(!seq[si] || !seq[si].length) seq[si] = bgShuffle(secs[si].filter(id => want.has(id))).concat(bgShuffle(secs[si].filter(id => !want.has(id)))); return seq[si].shift(); };
  const cells = [];
  for(let i = 0; i < BG_N*BG_N; i++){ const g = (2*Math.floor(i / BG_N) + i % BG_N) % BG_N, ss = perm[g % perm.length];
    cells.push({cat:draw(ss), ss, v: cfg.values === "flat" ? cfg.flat : cfg.values === "random" ? 100 * (1 + Math.floor(Math.random() * 5)) : bgPosVal(i), own:null}); }
  /* with fewer than 7 sections a category can repeat; move twins out of each other's row, column and diagonals */
  const bad = () => { let n = 0; for(let a = 0; a < cells.length; a++) for(let b = a + 1; b < cells.length; b++) if(cells[a].cat === cells[b].cat && bgShares(a, b)) n++; return n; };
  let cur = bad();
  for(let t = 0; t < 400 && cur > 0; t++){ const a = Math.floor(Math.random() * cells.length), b = Math.floor(Math.random() * cells.length);
    if(a === b || cells[a].ss !== cells[b].ss || cells[a].cat === cells[b].cat) continue;
    [cells[a].cat, cells[b].cat] = [cells[b].cat, cells[a].cat]; const n = bad(); if(n <= cur) cur = n; else [cells[a].cat, cells[b].cat] = [cells[b].cat, cells[a].cat]; }
  return cells;
}
const bgWinLine = t => BG_LINES.find(L => L.every(i => BG.st.cells[i].own === t));
const bgInit = () => ({v:1, cells:bgFill(BG.cfg), teams:BG.cfg.teams.map(n => ({name:n, steals:BG.cfg.steals, lock:null})), turn:0, pend:null, stealing:false, preview:true, over:false, winner:null, line:null});

/* ---------- screens ---------- */
function bingoEnter(){ if(S.mode === "bingo") return; S.preMode = {power:S.power, wager:S.wager, steal:S.steal, ffa:S.ffa, qrAns:S.qrAns, skipPhones:S.skipPhones}; S.power = S.wager = S.steal = S.ffa = false; S.mode = "bingo"; }
function bingoResumeBtn(){ const b = $("#bingoResume"); if(!b) return; const g = store.get("jn_bingo", null); b.hidden = !(g && !g.over && !g.preview); }
function bingoLeave(){ bingoResumeBtn(); if(S.mode !== "bingo") return;
  closeCard(); Object.assign(S, S.preMode || {}); S.mode = null; S.preMode = null; $("#bingo").hidden = true; $("#bingoSetup").hidden = true; $("#winEyebrow").textContent = "Final scores"; $("#playAgain").textContent = "Play again";
  try{ syncFfaOpt(); }catch(e){} }
function bgHideAll(){ ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup"].forEach(s => { const e = $(s); if(e) e.hidden = true; }); }
function bingoSetupShow(){ bingoEnter(); bgHideAll(); $("#bingoSetup").hidden = false; renderBingoSetup(); window.scrollTo(0, 0); }
function bingoBoardShow(){ bingoEnter(); bgHideAll(); $("#bingo").hidden = false; renderBingo(); window.scrollTo(0, 0); }
function bgLookBtn(){ const l = BG_LOOKS.find(x => x[0] === BG.cfg.look) || BG_LOOKS[0]; $("#bgLook").textContent = "Look: " + l[1]; }
function renderBingoSetup(){
  const c = BG.cfg, seg = (key, opts, cur) => `<div class="seg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
  const secs = bgSecIds();
  $("#bingoSetup").innerHTML = `
    <div><div class="eyebrow">Game mode</div><h1>Category <span>Bingo</span></h1><p class="sub">A 7x7 board of 49 categories. Teams take turns picking a square and answering its clue; get it right and the square is yours. First to 5 in a row (across, down or diagonal) wins. Each team has a few steals to take an opponent's square.</p></div>
    <div class="panel opt"><div class="eyebrow">Teams</div><div class="bteams">${c.teams.map((n, i) => `<div class="bteam"><i style="background:${BG_TEAMCOL[i]}"></i><input type="text" data-bn="${i}" value="${esc(n)}" maxlength="24" aria-label="Team ${i + 1} name">${c.teams.length > 2 ? `<button class="btn small" data-rm="${i}">Remove</button>` : ""}</div>`).join("")}</div>${c.teams.length < 4 ? `<div class="row"><button class="btn small" id="bgAddTeam">Add a team</button></div>` : ""}</div>
    <div class="panel opt"><div class="eyebrow">Look of the board</div><div class="looks">${BG_LOOKS.map(([k, n, d]) => `<button class="look" data-set="look" data-v="${k}" aria-pressed="${c.look === k}"><b>${n}</b><span class="d">${d}</span>${bgSwatch(k)}</button>`).join("")}</div><p class="note">You can also flip between the looks on the board with the Look button.</p></div>
    <div class="panel opt"><div class="eyebrow">Steals per team</div>${seg("steals", [[1, "1 steal"], [2, "2 steals"]], c.steals)}</div>
    <div class="panel opt"><div class="eyebrow">Filling the board</div>${seg("fill", [["balanced", "Balanced (7 from each section)"], ["sections", "Pick sections"], ["hand", "Hand-pick categories"]], c.fill)}
      ${c.fill === "sections" ? `<div class="seg">${BG_SECS.map((g, i) => `<button data-sec="${i}" aria-pressed="${c.sections.includes(i)}">${esc(g[0])}</button>`).join("")}</div><p class="note">The 49 squares are shared out evenly between the sections you tick; a category can appear more than once, never in the same row, column or diagonal if it can be helped.</p>` : ""}
      ${c.fill === "hand" ? `<p class="note">Tap the categories you want on the board (${c.picks.length} picked). The rest of the board is topped up from each section.</p><div class="hp">${BG_SECS.map((g, i) => `<div><h4>${esc(g[0])}</h4><div class="seg">${secs[i].map(id => `<button data-pick="${id}" aria-pressed="${c.picks.includes(id)}">${esc(bgShort(id))}</button>`).join("")}</div></div>`).join("")}</div>` : ""}</div>
    <div class="panel opt"><div class="eyebrow">Square values</div>${seg("values", [["pos", "By position (centre is 500)"], ["random", "Random"], ["flat", "All the same"]], c.values)}
      ${c.values === "flat" ? seg("flat", [100, 200, 300, 400, 500].map(v => [v, v]), c.flat) : ""}</div>
    <div class="panel opt"><div class="eyebrow">Clue timer</div>${seg("auto", [["true", "Starts by itself"], ["false", "Host starts it"]], c.auto)}</div>
    <div class="panel opt"><div class="eyebrow">Who starts</div>${seg("start", [["random", "Random team"], ["first", "First team"]], c.start)}</div>
    <div class="row"><button class="btn" id="bgBack">Back to title</button><button class="btn primary" id="bgPreview">Preview the board</button></div>`;
}
function bgSwatch(k){ const bg = {classic:"#000", card:"#0E5A3B", neon:"#05060f"}[k], sq = {classic:"#060CE9", card:"#FBF6E9", neon:"#0b0e22"}[k], cols = ["#4DA3FF", "#FF8A4D", "#34D3A5", "#FF6FA8"];
  return `<div class="swatch" style="background:${bg}">${cols.map((c, i) => `<i style="background:${i === 1 ? BG_TEAMCOL[0] : sq};border:2px solid ${k === "neon" ? c : k === "card" ? "#d9cfb4" : "#2B36B8"}${k === "card" && i === 1 ? ";box-shadow:inset 0 0 0 5px " + BG_TEAMCOL[0] + "cc" : ""}"></i>`).join("")}</div>`; }
$("#bingoSetup").addEventListener("click", e => {
  const c = BG.cfg, set = e.target.closest("[data-set]");
  if(set){ const k = set.dataset.set; let v = set.dataset.v; if(k === "steals" || k === "flat") v = +v; if(k === "auto") v = v === "true"; c[k] = v; bgSave(); renderBingoSetup(); return; }
  const sec = e.target.closest("[data-sec]"); if(sec){ const i = +sec.dataset.sec; c.sections = c.sections.includes(i) ? c.sections.filter(x => x !== i) : c.sections.concat(i); if(!c.sections.length) c.sections = [i]; bgSave(); renderBingoSetup(); return; }
  const pk = e.target.closest("[data-pick]"); if(pk){ const id = pk.dataset.pick; c.picks = c.picks.includes(id) ? c.picks.filter(x => x !== id) : c.picks.concat(id); bgSave(); renderBingoSetup(); return; }
  const rm = e.target.closest("[data-rm]"); if(rm){ c.teams.splice(+rm.dataset.rm, 1); bgSave(); renderBingoSetup(); return; }
  if(e.target.closest("#bgAddTeam")){ c.teams.push("Team " + "ABCD"[c.teams.length]); bgSave(); renderBingoSetup(); return; }
  if(e.target.closest("#bgBack")){ showHome(); return; }
  if(e.target.closest("#bgPreview")){ c.teams = c.teams.map((n, i) => n.trim() || "Team " + "ABCD"[i]); bgSave(); BG.st = bgInit(); bingoBoardShow(); }
});
$("#bingoSetup").addEventListener("input", e => { const i = e.target.dataset && e.target.dataset.bn; if(i !== undefined){ BG.cfg.teams[+i] = e.target.value; bgSave(); } });
$("#modeBingo").onclick = bingoSetupShow;
$("#bingoResume").onclick = () => { const g = store.get("jn_bingo", null); if(!g) return; BG.st = g; bingoEnter(); bingoBoardShow(); };
$("#bgHome").onclick = () => showHome();
$("#bgLook").onclick = () => { const i = BG_LOOKS.findIndex(x => x[0] === BG.cfg.look); BG.cfg.look = BG_LOOKS[(i + 1) % BG_LOOKS.length][0]; bgSave(); Snd.blip(); renderBingo(); };

/* ---------- board ---------- */
function bgThreat(){ const st = BG.st, thr = new Set(); st.teams.forEach((_, t) => BG_LINES.forEach(L => { const mine = L.filter(i => st.cells[i].own === t); if(mine.length === 4){ const f = L.find(i => st.cells[i].own !== t); if(st.cells[f].own == null || st.cells[f].own !== t) thr.add(f); } })); return thr; }
function renderBingo(){
  const st = BG.st, root = $("#bingo"); if(!st) return;
  root.dataset.look = BG.cfg.look; root.classList.toggle("stealing", !!st.stealing); bgLookBtn();
  const t = st.turn, thr = st.preview ? new Set() : bgThreat(), winSet = new Set(st.line || []), team = st.teams[t];
  const own = i => st.cells.filter(c => c.own === i).length;
  const anyOpp = st.cells.some(c => c.own != null && c.own !== t);
  const bar = st.preview ? "" : `<div class="bteams">${st.teams.map((m, i) => `<div class="bt${i === t && !st.over ? " on" : ""}" style="--tc:${BG_TEAMCOL[i]}"><i></i>${esc(m.name)}<b>${own(i)}</b><span class="stl" title="Steals left">${"★".repeat(m.steals)}${"☆".repeat(Math.max(0, BG.cfg.steals - m.steals))}</span></div>`).join("")}</div>`;
  const stat = st.preview ? `<div class="bstat">Preview. Tap a square to swap its category, or shuffle the whole board.</div>`
    : st.over ? `<div class="bstat">Game over.</div>`
    : st.stealing ? `<div class="bstat" style="color:${BG_TEAMCOL[t]}">${esc(team.name)}: tap an opponent's square to steal it <span class="row"><button class="btn small" data-b="nosteal">Cancel steal</button></span></div>`
    : `<div class="bstat" style="color:${BG_TEAMCOL[t]}">${esc(team.name)}'s turn: pick an open square <span class="row"><button class="btn small" data-b="steal" ${team.steals > 0 && anyOpp ? "" : "disabled"}>Steal (${team.steals} left)</button></span></div>`;
  const grid = st.cells.map((c, i) => { const cat = catById(c.cat), nm = bgShort(c.cat), long = nm.length > 15 || nm.split(/\s+/).some(w => w.length > 9), o = c.own;
    const cls = ["sq", o != null ? "own" : "", o != null && o !== t ? "opp" : "", thr.has(i) ? "thr" : "", winSet.has(i) ? "win" : "", !st.preview && team.lock === i && o != null ? "lk" : "", st.preview ? "pv" : ""].filter(Boolean).join(" ");
    return `<button class="${cls}" data-i="${i}" style="--sc:var(--s${c.ss});${o != null ? `--tc:${BG_TEAMCOL[o]}` : ""}" aria-label="${esc(cat.name)} for ${c.v}${o != null ? ", owned by " + esc(st.teams[o].name) : ""}"><span class="sec"></span><span class="v">${c.v}</span><span class="nm${long ? " l" : ""}">${esc(nm)}</span><span class="who">${o != null ? bgInit1(st, o) : ""}</span></button>`; }).join("");
  const foot = st.preview ? `<div class="bbar"><button class="btn" data-b="back">Back to setup</button><button class="btn" data-b="shuffle">Shuffle board</button><button class="btn primary" data-b="start">Start game</button></div>`
    : st.over ? `<div class="bbar"><button class="btn" data-b="again">New board</button><button class="btn" data-b="back">Setup</button></div>` : "";
  $("#bingoBody").innerHTML = bar + stat + `<div class="bgrid">${grid}</div>` + foot;
}
$("#bingoBody").addEventListener("click", e => {
  const st = BG.st; if(!st) return;
  const b = e.target.closest("[data-b]");
  if(b){ const a = b.dataset.b;
    if(a === "steal"){ st.stealing = true; renderBingo(); } else if(a === "nosteal"){ st.stealing = false; renderBingo(); }
    else if(a === "back"){ bingoSetupShow(); } else if(a === "again"){ bingoAgain(); }
    else if(a === "shuffle"){ st.cells = bgFill(BG.cfg); renderBingo(); }
    else if(a === "start"){ st.preview = false; st.turn = BG.cfg.start === "random" ? Math.floor(Math.random() * st.teams.length) : 0; Snd.blip(); bgPersist(); renderBingo(); }
    return; }
  const q = e.target.closest(".sq"); if(!q) return; bingoClickSq(+q.dataset.i);
});
function bingoClickSq(i){
  const st = BG.st, cell = st.cells[i], t = st.turn; if(st.over) return;
  if(st.preview){ const used = new Set(st.cells.map(c => c.cat)), opts = bgSecIds()[cell.ss].filter(id => !used.has(id)); if(opts.length){ cell.cat = opts[Math.floor(Math.random() * opts.length)]; renderBingo(); } return; }
  if(st.stealing){ if(cell.own == null || cell.own === t) return; if(st.teams[t].lock === i){ Snd.blip(); return; } st.pend = {sq:i, kind:"steal"}; }
  else { if(cell.own != null) return; st.pend = {sq:i, kind:"pick"}; }
  S.turn = t; openClue(cell.cat, cell.v);
  if(!BG.cfg.auto && S.cur){ stopTimer(); S.cur.running = false; renderClue(); }
}
const bgInit1 = (st, i) => { const l = n => (n.trim()[0] || "?").toUpperCase(), m = st.teams[i], dup = st.teams.some((x, k) => k !== i && l(x.name) === l(m.name)); return esc(dup ? String(i + 1) : l(m.name)); };
const bgPersist = () => store.set("jn_bingo", BG.st);
function bingoBanner(c){ const st = BG.st, p = st && st.pend; if(!p) return ""; const t = st.teams[st.turn], from = st.cells[p.sq].own;
  return `<p class="note" style="margin:0;font-weight:700;color:${BG_TEAMCOL[st.turn]}">${p.kind === "steal" ? `${esc(t.name)} is stealing this square from ${esc(st.teams[from].name)}. Wrong and the steal is gone and ${esc(t.name)} can't pick it next turn.` : `${esc(t.name)} is going for this square.`}</p>`; }
function bingoAwards(c){ const st = BG.st, i = st.turn, t = st.teams[i], p = st.pend;
  return `<div class="award"><div class="grp"><span>${esc(t.name)}</span><button class="y${c.awards[i] === 1 ? " on" : ""}" data-aw="${i}" data-v="1">${p && p.kind === "steal" ? "Correct: steal it" : "Correct: claim it"}</button><button class="n${c.awards[i] === -1 ? " on" : ""}" data-aw="${i}" data-v="-1">Wrong</button></div></div>`; }
function bingoDone(c){
  const st = BG.st, p = st.pend, t = st.turn, v = c.awards[t];
  S.used.add(`${c.cat}-${c.lvl}-${c.idx}`); store.set("jn_used", [...S.used]); histNote();
  closeCard();
  if(!p || v === undefined){ st.pend = null; renderBingo(); return; }   // closed with no result: nothing changes, same team picks again
  const cell = st.cells[p.sq], team = st.teams[t], prev = team.lock;
  if(v === 1){ cell.own = t; if(p.kind === "steal") team.steals--; team.lock = null; Snd.blip(); }
  else if(p.kind === "steal"){ team.steals--; team.lock = p.sq; }
  else if(prev != null) team.lock = null;
  st.pend = null; st.stealing = false;
  const line = v === 1 ? bgWinLine(t) : null;
  if(line){ st.over = true; st.winner = t; st.line = line; bgPersist(); renderBingo(); setTimeout(() => bingoWinner(), 1800); return; }
  if(!st.cells.some(x => x.own == null)){ st.over = true; bgPersist(); renderBingo(); setTimeout(() => bingoWinner(), 600); return; }
  st.turn = (t + 1) % st.teams.length; bgPersist(); renderBingo();
}
function bingoWinner(){
  const st = BG.st; if(!st || !st.over) return;
  const line = st.winner != null;
  const rows = st.teams.map((m, i) => ({name:m.name, n:st.cells.filter(c => c.own === i).length, i})).sort((a, b) => (line ? (b.i === st.winner) - (a.i === st.winner) : 0) || b.n - a.n);
  const top = line ? [rows[0]] : rows.filter(r => r.n === rows[0].n);
  $("#winEyebrow").textContent = "Category Bingo";
  $("#winTitle").innerHTML = line ? `${esc(st.teams[st.winner].name)}<br><span>BINGO!</span>` : top.length > 1 ? `It's a tie!<br><span>${esc(top.map(r => r.name).join(" & "))}</span>` : `${esc(top[0].name)}<br><span>win!</span>`;
  const rankOf = r => line ? (r.i === st.winner ? 1 : 2 + rows.filter(x => x.i !== st.winner && x.n > r.n).length) : 1 + rows.filter(x => x.n > r.n).length;
  $("#podium").innerHTML = rows.slice(0, 3).map(r => { const k = rankOf(r); return `<div class="pod p${Math.min(k, 3)}"><div class="who">${esc(r.name)}</div><div class="pts">${r.n}</div><div class="step">${k}${["th","st","nd","rd"][(k % 100 > 10 && k % 100 < 14) || k % 10 > 3 ? 0 : k % 10]}</div></div>`; }).join("");
  $("#podium").hidden = false;
  $("#standings").innerHTML = rows.length > 3 ? rows.slice(3).map(r => `<li><span>${rankOf(r)}. ${esc(r.name)}</span><b>${r.n}</b></li>`).join("") : "";
  $("#winBoard").hidden = false; $("#winBox").hidden = false; $("#playAgain").focus(); $("#playAgain").textContent = "New board";
  confetti(); ledStart(); if(S.sound) playEnd(NORMAL_INTRO);
}
function bingoAgain(){ hideWinner(); $("#playAgain").textContent = "Play again"; if(!BG.st) return; BG.st = bgInit(); bingoBoardShow(); }
function bingoSetupAgain(){ hideWinner(); $("#playAgain").textContent = "Play again"; bingoSetupShow(); }
