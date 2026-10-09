/* 6.48 (Omar): Category Bingo. A 7x7 board of 49 categories; teams take turns claiming squares by answering a clue and the first to get 5 in a row
   wins. Each team has 1 or 2 steals to take an opponent's square. No points: a right answer claims, a wrong one leaves the square open.
   It reuses the clue card (openClue / renderClue) and the winner screen; app.js only calls bingoBanner, bingoAwards, bingoDone, bingoAgain,
   bingoSetupAgain and bingoLeave. Setup is saved on this device in jn_bingoCfg (the game itself is not saved since 6.50). To remove: see the 6.48 NOTES entry. */
const BG = {cfg:null, st:null};
/* 6.56 (Omar): Act It Out (both) and One Word Clues are off the board ("they would not work"); Closest Wins and Price Is Right are on it:
   every team guesses and the closest team takes the square, even when it wasn't their pick. */
const BG_N = 7, BG_SKIP = new Set(["cal","headl","act","acteg","pw"]);   // A/B/C rounds are left out: a one-in-three guess would hand over a free square. 6.58 (Omar): Spotify and Instagram are ordering rounds now, so they're on the board (6.48-6.57: "spot","igf" were first in this list)
const BG_LOOKS = [["classic","Classic","The game's own blue tiles with gold numbers. Claimed squares fill with the team colour."],["card","Bingo card","Paper-white squares on green felt. Claimed squares get a marker daub, like a real bingo card."],["neon","Neon","Dark board, every square glows in its section colour. Claimed squares light up solid."]];
const BG_SECS = CAT_GROUPS.filter(g => g && g[0] !== "Mixes");
const BG_TEAMCOL = ["#FFCC33","#2EC4B6","#FF6B5E","#B79CFF"];
const BG_SHORT = {spot:"Spotify Listeners", igf:"Instagram Followers", egyph:"Egypt: Photos", ecin:"Egyptian Cinema", ploteg:"Plots: Egypt", quoteeg:"Quotes: Egypt", lyricar:"Lyrics: Arabic", emeg:"Emoji: Egypt", emseg:"Emoji Sent.: Egypt", ctryar:"Which Country? Arab", pl:"Premier League", ucl:"Champions League", fyear:"Year: Football", songt:"Song Titles", plot:"Bad Plots", lit:"Translated", toons:"Cartoons", blockbuster:"Blockbusters", qblank:"Fill the Quote", quote:"Movie Quotes", mb:"Money & Business", brand:"Brands", tg:"Tech & Gaming", memeeg:"Egyptian Memes", egh:"Egypt History", cairo:"Cairo", wc26:"World Cup 2026", islam:"Islam", ww2:"World War II", holi:"Holidays", cocktail:"Cocktails", ffood:"Fast Food", vgames:"Video Games", hgames:"Hunger Games", romcom:"Rom-Coms", acteg:"Act It Out: Egypt", emsen:"Emoji Sentences", pw:"One Word Clues", gk:"General Knowledge", facts:"Facts", cclub:"Common Club", path:"Career Path", mgr:"Managers", shirt:"Shirt Numbers", stad:"Stadiums", xfer:"Transfers", whoami:"Who Am I?", foodpic:"Guess the Food", gctry:"Guess the Country", actor:"Guess the Actor", footy:"Guess the Footballer", person:"Guess the Person", car:"Guess the Car", logo:"Guess the Logo", ctry:"Which Country?", shape:"Country Outlines", pin:"Map Pin", order:"Put It in Order", link:"What's the Link?", himym:"HIMYM", st:"Stranger Things", got:"Game of Thrones", hp:"Harry Potter", bb:"Breaking Bad", pb:"Prison Break", gta:"GTA V", food:"Food & Drink"};
const bgShort = id => BG_SHORT[id] || String(catById(id).name).replace(/\s*\(.*?\)/g, "");
const bgOk = id => { const c = catById(id); return !!c && !c.mode && c.type !== "mix" && !HIDDEN_IDS.has(id) && !BG_SKIP.has(id) && (!LOCKED_IDS.has(id) || unlocked.has(id)); };
const bgShuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const bgMkLines = n => { const out = []; for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]) for(let r = 0; r < BG_N; r++) for(let c = 0; c < BG_N; c++){
  const L = []; for(let k = 0; k < n; k++){ const rr = r + dr*k, cc = c + dc*k; if(rr < 0 || rr >= BG_N || cc < 0 || cc >= BG_N) break; L.push(rr*BG_N + cc); } if(L.length === n) out.push(L); } return out; };
/* 6.55 (Omar): the win can be 5 or 6 in a row (setup "Win with"). Square values by position still come from the 5-in-a-row lines. */
const BG_LINES = bgMkLines(5), BG_LINES6 = bgMkLines(6), bgRun = () => BG.cfg.row === 6 ? BG_LINES6 : BG_LINES, bgRowN = () => BG.cfg.row === 6 ? 6 : 5;
const BG_CNT = (() => { const n = Array(BG_N*BG_N).fill(0); BG_LINES.forEach(L => L.forEach(i => n[i]++)); return n; })();
/* values by position: the more winning lines run through a square, the more it is worth. 8 squares of 100, 8 of 200, 12 of 300, 12 of 400, 9 of 500
   (Omar: fewer 100s, a few more 500s than 100s). Setup can switch to random or one flat value. */
const bgPosVal = i => { const n = BG_CNT[i], r = Math.floor(i / BG_N), c = i % BG_N; return n === 3 ? 100 : n === 4 ? (r === 3 || c === 3 ? 100 : 200) : n <= 6 ? 300 : n === 7 ? 400 : 500; };
function bgDefaults(){ return {teams: S.teams.slice(0, 4).map(t => t.name).concat(["Team A","Team B"]).slice(0, Math.max(2, Math.min(4, S.teams.length))), steals:2, fill:"random", sections:BG_SECS.map((_, i) => i), picks:[], values:"pos", flat:300, auto:true, photos:true, row:5, start:"random", look:"classic"}; }
BG.cfg = Object.assign(bgDefaults(), store.get("jn_bingoCfg", {}));
if(BG.cfg.fill === "balanced") BG.cfg.fill = "random";   // 6.56 (Omar): Balanced (7 per section) became Random from every category
const bgSave = () => { store.set("jn_bingoCfg", BG.cfg); };
/* Photo rounds switch (Omar): off takes the whole Photo Rounds section, plus Egypt: Photo Edition, off the board. Egypt, Football, Entertainment and Knowledge each have 14+ categories, so
   one of them fills the seventh group of squares (picked at random) and the board stays 49 different-feeling squares. */
const BG_PHOTO = BG_SECS.findIndex(g => g[0] === "Photo Rounds"), BG_PHOTO_EXTRA = new Set(["egyph"]);
const bgSecIds = () => BG_SECS.map((g, i) => BG.cfg.photos === false ? (i === BG_PHOTO ? [] : g[1].filter(id => bgOk(id) && !BG_PHOTO_EXTRA.has(id))) : g[1].filter(bgOk));
const bgShares = (a, b) => { const ra = Math.floor(a / BG_N), ca = a % BG_N, rb = Math.floor(b / BG_N), cb = b % BG_N; return ra === rb || ca === cb || ra - ca === rb - cb || ra + ca === rb + cb; };
function bgFill(cfg){
  const secs = bgSecIds(), all = secs.map((_, i) => i).filter(i => secs[i].length);
  const chosen = cfg.fill === "sections" && cfg.sections.filter(i => secs[i] && secs[i].length).length ? cfg.sections.filter(i => secs[i] && secs[i].length) : all;
  const perm = bgShuffle(chosen.slice());
  while(perm.length < BG_N){ const big = chosen.filter(si => secs[si].length >= 2 * Math.ceil(BG_N / chosen.length) + 6), pool = big.length ? big : chosen; perm.push(pool[Math.floor(Math.random() * pool.length)]); }
  const want = new Set(cfg.fill === "hand" ? cfg.picks : []), seq = {};
  const draw = si => { if(!seq[si] || !seq[si].length) seq[si] = bgShuffle(secs[si].filter(id => want.has(id))).concat(bgShuffle(secs[si].filter(id => !want.has(id)))); return seq[si].shift(); };
  const cells = [];
  /* 6.56 (Omar): Random draws the 49 squares from every category available (after the photo switch), not 7 per section */
  if(cfg.fill === "random"){ const pool = bgShuffle(secs.flatMap((ids, si) => ids.map(id => [id, si])));
    for(let i = 0; i < BG_N*BG_N; i++){ const [cat, ss] = pool[i % pool.length];
      cells.push({cat, ss, v: cfg.values === "flat" ? cfg.flat : cfg.values === "random" ? 100 * (1 + Math.floor(Math.random() * 5)) : bgPosVal(i), own:null}); } }
  else for(let i = 0; i < BG_N*BG_N; i++){ const g = (2*Math.floor(i / BG_N) + i % BG_N) % BG_N, ss = perm[g];
    cells.push({cat:draw(ss), ss, v: cfg.values === "flat" ? cfg.flat : cfg.values === "random" ? 100 * (1 + Math.floor(Math.random() * 5)) : bgPosVal(i), own:null}); }
  /* with fewer than 7 sections a category can repeat; move twins out of each other's row, column and diagonals */
  const bad = () => { let n = 0; for(let a = 0; a < cells.length; a++) for(let b = a + 1; b < cells.length; b++) if(cells[a].cat === cells[b].cat && bgShares(a, b)) n++; return n; };
  let cur = bad();
  for(let t = 0; t < 400 && cur > 0; t++){ const a = Math.floor(Math.random() * cells.length), b = Math.floor(Math.random() * cells.length);
    if(a === b || cells[a].ss !== cells[b].ss || cells[a].cat === cells[b].cat) continue;
    [cells[a].cat, cells[b].cat] = [cells[b].cat, cells[a].cat]; const n = bad(); if(n <= cur) cur = n; else [cells[a].cat, cells[b].cat] = [cells[b].cat, cells[a].cat]; }
  return cells;
}
const bgWinLine = t => bgRun().find(L => L.every(i => BG.st.cells[i].own === t));
const bgInit = () => ({v:1, cells:bgFill(BG.cfg), teams:BG.cfg.teams.map(n => ({name:n, steals:BG.cfg.steals, lock:null})), turn:0, pend:null, stealing:false, preview:true, over:false, winner:null, line:null});

/* ---------- screens ---------- */
function bingoEnter(){ if(S.mode === "bingo") return; S.preMode = {power:S.power, wager:S.wager, steal:S.steal, ffa:S.ffa, qrAns:S.qrAns, skipPhones:S.skipPhones}; S.power = S.wager = S.steal = S.ffa = false; S.mode = "bingo"; }
/* 6.50 (Omar): no resuming a Bingo game. It isn't saved any more, and an old save is cleared. To undo: restore this function,
   bgPersist and the #bingoResume click handler from 6.49, the #bingoResume button in head.html, and the plain bgHome handler. */
function bingoResumeBtn(){ try{ localStorage.removeItem("jn_bingo"); }catch(e){} }
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
    <div><div class="eyebrow">Game mode</div><h1>Category <span>Bingo</span></h1><p class="sub">A 7x7 board of 49 categories. Teams take turns picking a square and answering its clue; get it right and the square is yours. First to ${bgRowN()} in a row (across, down or diagonal) wins. Each team has a few steals to take an opponent's square.</p></div>
    <div class="panel opt"><div class="eyebrow">Teams</div><div class="bteams">${c.teams.map((n, i) => `<div class="bteam"><i style="background:${BG_TEAMCOL[i]}"></i><input type="text" data-bn="${i}" value="${esc(n)}" maxlength="24" aria-label="Team ${i + 1} name">${c.teams.length > 2 ? `<button class="btn small" data-rm="${i}">Remove</button>` : ""}</div>`).join("")}</div>${c.teams.length < 4 ? `<div class="row"><button class="btn small" id="bgAddTeam">Add a team</button></div>` : ""}</div>
    <div class="panel opt"><div class="eyebrow">Look of the board</div><div class="looks">${BG_LOOKS.map(([k, n, d]) => `<button class="look" data-set="look" data-v="${k}" aria-pressed="${c.look === k}"><b>${n}</b><span class="d">${d}</span>${bgSwatch(k)}</button>`).join("")}</div><p class="note">You can also flip between the looks on the board with the Look button.</p></div>
    <div class="panel opt"><div class="eyebrow">Win with</div>${seg("row", [[5, "5 in a row"], [6, "6 in a row (longer game)"]], bgRowN())}</div>
    <div class="panel opt"><div class="eyebrow">Steals per team</div>${seg("steals", [[1, "1 steal"], [2, "2 steals"]], c.steals)}</div>
    <div class="panel opt"><div class="eyebrow">Photo rounds</div>${seg("photos", [["true", "On: photo rounds on the board"], ["false", "Off: no photo rounds"]], c.photos !== false)}${c.photos === false ? `<p class="note">Takes Guess the Car, Actor, Footballer, Person, Food, Logo and Country, and Egypt: Photo Edition, off the board. One of the other sections gets two groups of squares instead.</p>` : ""}</div>
    <div class="panel opt"><div class="eyebrow">Filling the board</div>${seg("fill", [["random", "Random from every category"], ["sections", "Pick sections"], ["hand", "Hand-pick categories"]], c.fill)}
      ${c.fill === "sections" ? `<div class="seg">${BG_SECS.map((g, i) => !secs[i].length ? "" : `<button data-sec="${i}" aria-pressed="${c.sections.includes(i)}">${esc(g[0])}</button>`).join("")}</div><p class="note">The 49 squares are shared out evenly between the sections you tick; a category can appear more than once, never in the same row, column or diagonal if it can be helped.</p>` : ""}
      ${c.fill === "hand" ? `<p class="note">Tap the categories you want on the board (${c.picks.length} picked). The rest of the board is topped up from each section.</p><div class="hp">${BG_SECS.map((g, i) => !secs[i].length ? "" : `<div><h4>${esc(g[0])}</h4><div class="seg">${secs[i].map(id => `<button data-pick="${id}" aria-pressed="${c.picks.includes(id)}">${esc(bgShort(id))}</button>`).join("")}</div></div>`).join("")}</div>` : ""}</div>
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
  if(set){ const k = set.dataset.set; let v = set.dataset.v; if(k === "steals" || k === "flat" || k === "row") v = +v; if(k === "auto" || k === "photos") v = v === "true"; c[k] = v; bgSave(); renderBingoSetup(); return; }
  const sec = e.target.closest("[data-sec]"); if(sec){ const i = +sec.dataset.sec; c.sections = c.sections.includes(i) ? c.sections.filter(x => x !== i) : c.sections.concat(i); if(!c.sections.length) c.sections = [i]; bgSave(); renderBingoSetup(); return; }
  const pk = e.target.closest("[data-pick]"); if(pk){ const id = pk.dataset.pick; c.picks = c.picks.includes(id) ? c.picks.filter(x => x !== id) : c.picks.concat(id); bgSave(); renderBingoSetup(); return; }
  const rm = e.target.closest("[data-rm]"); if(rm){ c.teams.splice(+rm.dataset.rm, 1); bgSave(); renderBingoSetup(); return; }
  if(e.target.closest("#bgAddTeam")){ c.teams.push("Team " + "ABCD"[c.teams.length]); bgSave(); renderBingoSetup(); return; }
  if(e.target.closest("#bgBack")){ showHome(); return; }
  if(e.target.closest("#bgPreview")){ c.teams = c.teams.map((n, i) => n.trim() || "Team " + "ABCD"[i]); bgSave(); BG.st = bgInit(); bingoBoardShow(); }
});
$("#bingoSetup").addEventListener("input", e => { const i = e.target.dataset && e.target.dataset.bn; if(i !== undefined){ BG.cfg.teams[+i] = e.target.value; bgSave(); } });
$("#modeBingo").onclick = bingoSetupShow;
$("#bgHome").onclick = () => { const st = BG.st; if(st && !st.over && !st.preview && st.cells.some(x => x.own != null)) askConfirm("Leave this game?", "Going to the title screen ends this Bingo game. It can't be resumed.", "Go to title", showHome, true); else showHome(); };
$("#bgLook").onclick = () => { const i = BG_LOOKS.findIndex(x => x[0] === BG.cfg.look); BG.cfg.look = BG_LOOKS[(i + 1) % BG_LOOKS.length][0]; bgSave(); Snd.blip(); renderBingo(); };

/* ---------- board ---------- */
function bgThreat(){ const st = BG.st, thr = new Set(); st.teams.forEach((_, t) => bgRun().forEach(L => { const mine = L.filter(i => st.cells[i].own === t); if(mine.length === L.length - 1){ const f = L.find(i => st.cells[i].own !== t); if(st.cells[f].own == null || st.cells[f].own !== t) thr.add(f); } })); return thr; }
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
    return `<button class="${cls}" data-i="${i}" style="--sc:var(--s${c.ss});${o != null ? `--tc:${BG_TEAMCOL[o]}` : ""}" aria-label="${"ABCDEFG"[i % BG_N] + (Math.floor(i / BG_N) + 1)}: ${esc(cat.name)} for ${c.v}${o != null ? ", owned by " + esc(st.teams[o].name) : ""}"><span class="sec"></span><span class="v">${c.v}</span><span class="nm${long ? " l" : ""}">${esc(nm)}</span><span class="who">${o != null ? bgInit1(st, o) : ""}</span></button>`; }).join("");
  const foot = st.preview ? `<div class="bbar"><button class="btn" data-b="back">Back to setup</button><button class="btn" data-b="shuffle">Shuffle board</button><button class="btn primary" data-b="start">Start game</button></div>`
    : st.over ? `<div class="bbar"><button class="btn" data-b="again">New board</button><button class="btn" data-b="back">Setup</button></div>` : "";
  const lets = `<div class="bax h">${[..."ABCDEFG"].map(l => `<i>${l}</i>`).join("")}</div>`, nums = `<div class="bax v">${[1, 2, 3, 4, 5, 6, 7].map(n => `<i>${n}</i>`).join("")}</div>`;   // faint letter x number guide on the top and left (Omar) so squares can be called out like C4
  $("#bingoBody").innerHTML = bar + stat + `<div class="bframe"><span></span>${lets}${nums}<div class="bgrid">${grid}</div></div>` + foot;
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
const bgName = i => "ABCDEFG"[i % BG_N] + (Math.floor(i / BG_N) + 1);
const bgPersist = () => {};   // 6.50: Bingo games aren't saved (was store.set("jn_bingo", BG.st))
function bingoBanner(c){ const st = BG.st, p = st && st.pend; if(!p) return ""; const t = st.teams[st.turn], from = st.cells[p.sq].own;
  return `<p class="note" style="margin:0;font-weight:700;color:${BG_TEAMCOL[st.turn]}">${p.kind === "steal" ? `${esc(t.name)} is stealing ${bgName(p.sq)} from ${esc(st.teams[from].name)}. Wrong and the steal is gone and ${esc(t.name)} can't pick it next turn.` : `${esc(t.name)} is going for ${bgName(p.sq)}.`}</p>`; }
function bingoAwards(c){ const st = BG.st, i = st.turn, t = st.teams[i], p = st.pend;
  if(c.type === "closest") return `<div class="award">${st.teams.map((m, k) => `<div class="grp"><span>${esc(m.name)}</span><button class="y${c.awards[k] === 1 ? " on" : ""}" data-aw="${k}" data-v="1">Closest</button></div>`).join("")}</div>
    <p class="note">${p && p.kind === "steal" ? `The steal works only if ${esc(t.name)} is closest.` : `The closest team takes ${bgName(p ? p.sq : 0)}. On a tie, ${esc(t.name)} wins it if they're in the tie.`} Tap to change who was closest.</p>`;
  return `<div class="award"><div class="grp"><span>${esc(t.name)}</span><button class="y${c.awards[i] === 1 ? " on" : ""}" data-aw="${i}" data-v="1">${p && p.kind === "steal" ? "Correct: steal it" : "Correct: claim it"}</button><button class="n${c.awards[i] === -1 ? " on" : ""}" data-aw="${i}" data-v="-1">Wrong</button></div></div>`; }
function bingoDone(c){
  const st = BG.st, p = st.pend, t = st.turn; let v = c.awards[t];
  S.used.add(`${c.cat}-${c.lvl}-${c.idx}`); store.set("jn_used", [...S.used]); histNote();
  closeCard();
  if(c.type === "closest" && p && c.revealed){   // 6.56: closest team takes the square (picker wins a tie); a steal needs the stealer to be closest
    const near = Object.keys(c.awards).filter(k => c.awards[k] === 1).map(Number), who = near.includes(t) ? t : near.length === 1 && p.kind !== "steal" ? near[0] : null;
    if(who != null && who !== t){ const cell = st.cells[p.sq]; cell.own = who; Snd.blip(); if(st.teams[t].lock != null) st.teams[t].lock = null; st.pend = null; st.stealing = false;
      const line = bgWinLine(who); if(line){ st.over = true; st.winner = who; st.line = line; renderBingo(); setTimeout(() => bingoWinner(), 1800); return; }
      if(!st.cells.some(x => x.own == null)){ st.over = true; renderBingo(); setTimeout(() => bingoWinner(), 600); return; }
      st.turn = (t + 1) % st.teams.length; renderBingo(); return; }
    v = who === t ? 1 : -1; }
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
