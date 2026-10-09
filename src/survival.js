/* 6.60 (Omar): Survival, a last-team-standing mode. Every team starts with 2 or 3 lives and loses one for each wrong clue; the last team standing wins.
   Eight rounds on a fixed ladder (100s, then 200/300, 200/300, 300/400, 400/500, 400/500, 500, 500); round 1 asks one clue and every later round three.
   Each round announces one category, drawn at random from the Bidding Wars titles (so football doesn't come up four times running). Setup chooses turn by turn
   (default: each team answers its own clue) or all at once (every team answers the same clue and the host marks each one). If every team misses the same clue
   nobody loses a life. No lives come back. After round 8, if more than one team is left, sudden death rounds follow (one 500 clue each).
   Cairo Cinema Poster look (his pick of five previews): yellow sunburst, red banner, paper-ticket team cards with hard shadows, an OUT stamp.
   It reuses the clue card and the winner screen; app.js only calls survBanner, survAwards, survDone, survAgain, survSetupAgain and survLeave.
   Setup is saved on this device in jn_survCfg; the game is not saved. To remove: see the 6.60 NOTES entry. */
const SV = {cfg:null, st:null};
const SV_LADDER = [[100],[200,300],[200,300],[300,400],[400,500],[400,500],[500],[500]], SV_ROUNDS = SV_LADDER.length;
const SV_WINNOTE = $("#winNote").textContent;
const svShuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const svCats = t => t[2].filter(id => catById(id) && !HIDDEN_IDS.has(id) && (SV.cfg.photos || !BW_PHOTO_CATS.has(id)));
const svTitleOn = t => SV.cfg.titles[t[0]] !== undefined ? SV.cfg.titles[t[0]] : t[3] !== "off";
function svDefaults(){ const names = S.teams.map(t => t.name).slice(0, 6); while(names.length < 2) names.push("Team " + "ABCDEF"[names.length]);
  return {teams:names, lives:3, mode:"turn", photos:true, titles:{}}; }
SV.cfg = Object.assign(svDefaults(), store.get("jn_survCfg", {}));
const svSave = () => store.set("jn_survCfg", SV.cfg);

/* ---------- dealing ---------- */
function svIdx(cat, lvl, taken){   // an unplayed clue not already used this round; with photo rounds off, never one that shows a photo
  const n = (pool(cat, lvl) || []).length; if(!n) return null;
  const key = i => `${cat}-${lvl}-${i}`;
  if(catById(cat).type === "photo"){ if(!SV.cfg.photos) return null; let i = pickIdx(cat, lvl); for(let t = 0; t < 6 && taken.has(key(i)); t++) i = pickIdx(cat, lvl); return i; }
  const ok = [...Array(n).keys()].filter(i => SV.cfg.photos || !imgRefFor(cat, lvl, i)); if(!ok.length) return null;
  const fresh = ok.filter(i => !S.used.has(key(i)) && !taken.has(key(i))), from = fresh.length ? fresh : ok.filter(i => !taken.has(key(i)));
  const use = from.length ? from : ok; return use[Math.floor(Math.random() * use.length)]; }
function svPickCat(vals, prev, seen){
  const titles = BW_TITLES.filter(t => svTitleOn(t) && svCats(t).length);
  let opts = titles.filter(t => t[0] !== prev && !seen.has(t[0])); if(!opts.length){ seen.clear(); opts = titles.filter(t => t[0] !== prev); } if(!opts.length) opts = titles;
  for(let tries = 0; tries < 40; tries++){ const t = opts[Math.floor(Math.random() * opts.length)], cats = svCats(t), cat = cats[Math.floor(Math.random() * cats.length)];
    if(vals.every(v => svIdx(cat, v, new Set()) != null)){ seen.add(t[0]); return {title:t[0], cat}; } }
  return null; }
const svAlive = () => SV.st.teams.map((t, i) => i).filter(i => SV.st.teams[i].lives > 0);
function svInit(){ const st = {v:1, teams:SV.cfg.teams.map(n => ({name:n, lives:SV.cfg.lives, out:null, dots:[]})), round:-1, seen:new Set(), prevTitle:null, outSeq:0, over:false, splash:null, taken:new Set()};
  SV.st = st; svStartRound(); return st; }
function svStartRound(){ const st = SV.st; st.round++; const r = st.round, sd = r >= SV_ROUNDS;
  st.k = r === 0 || sd ? 1 : 3; const opts = sd ? [500] : SV_LADDER[r];
  st.vals = Array.from({length:st.k}, () => opts[Math.floor(Math.random() * opts.length)]); st.taken = new Set();
  const pk = svPickCat(st.vals, st.prevTitle, st.seen) || svPickCat([st.vals[0]], null, new Set()) ;
  st.title = pk.title; st.cat = pk.cat; st.prevTitle = pk.title; st.teams.forEach(t => t.dots = []); st.n = -1; svStartGroup(); }
function svStartGroup(){ const st = SV.st; st.n++; st.alive = svAlive();
  const al = st.alive, rot = st.round % al.length; st.order = al.slice(rot).concat(al.slice(0, rot)); st.pos = 0; st.res = {}; svNextClue(); }
function svNextClue(){ const st = SV.st, lvl = st.vals[st.n]; let idx = svIdx(st.cat, lvl, st.taken);
  if(idx == null){ const pk = svPickCat([lvl], null, new Set()); if(pk){ st.cat = pk.cat; st.title = pk.title; idx = svIdx(st.cat, lvl, st.taken); } }
  st.taken.add(`${st.cat}-${lvl}-${idx}`); warmRef(imgRefFor(st.cat, lvl, idx)); st.cur = {cat:st.cat, lvl, idx, seen:false}; }

/* ---------- screens ---------- */
function survEnter(){ if(S.mode === "survival") return; S.preMode = {power:S.power, wager:S.wager, steal:S.steal, ffa:S.ffa, skipPhones:S.skipPhones};
  S.power = S.wager = S.steal = S.ffa = false; S.mode = "survival"; document.body.classList.add("survmode"); }
function survLeave(){ if(S.mode !== "survival") return;
  closeCard(); Object.assign(S, S.preMode || {}); S.mode = null; S.preMode = null; document.body.classList.remove("survmode");
  $("#survival").hidden = true; $("#survSetup").hidden = true; $("#winEyebrow").textContent = "Final scores"; $("#playAgain").textContent = "Play again"; $("#winNote").textContent = SV_WINNOTE;
  try{ syncFfaOpt(); }catch(e){} }
function svHideAll(){ ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#survival","#survSetup"].forEach(s => { const e = $(s); if(e) e.hidden = true; }); }
function survSetupShow(){ survEnter(); svHideAll(); $("#survSetup").hidden = false; renderSurvSetup(); window.scrollTo(0, 0); }
function survShow(){ survEnter(); svHideAll(); $("#survival").hidden = false; renderSurv(); window.scrollTo(0, 0); }
function renderSurvSetup(){
  const c = SV.cfg, seg = (key, opts, cur) => `<div class="seg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
  $("#survSetup").innerHTML = `
    <div class="svhead"><div class="svbadge">Game mode</div><h1>Survival</h1>
      <p class="sub">Every team starts with ${c.lives} lives. A wrong answer costs a life and nothing gives one back. Eight rounds climb from 100s to 500s, then sudden death if more than one team is still standing. The last team alive wins.</p></div>
    <div class="svpanel"><div class="sveye">Teams</div><div class="svteams">${c.teams.map((n, i) => `<div class="svteam"><input type="text" id="svTeam${i}" data-bn="${i}" value="${esc(n)}" maxlength="24" aria-label="Team ${i + 1} name">${c.teams.length > 2 ? `<button class="svbtn ghost" data-rm="${i}" aria-label="Remove ${esc(n)}">Remove</button>` : ""}</div>`).join("")}</div>
      ${c.teams.length < 6 ? `<div><button class="svbtn ghost" id="svAddTeam">Add team</button></div>` : ""}</div>
    <div class="svpanel"><div class="sveye">Lives</div>${seg("lives", [[2, "2 lives"], [3, "3 lives"]], c.lives)}<p class="note">With 3 lives a game usually ends around round 5. With 2 it is shorter and sharper.</p></div>
    <div class="svpanel"><div class="sveye">Answering</div>${seg("mode", [["turn", "Turn by turn"], ["once", "All at once"]], c.mode)}<p class="note">Turn by turn: each team gets its own clue in the round's category, and only that team answers. All at once: one clue, every team answers it (on paper or a whiteboard) and the host marks each team.</p></div>
    <div class="svpanel"><div class="sveye">Rounds</div><div class="svladder">${SV_LADDER.map((l, i) => `<div><b>${i + 1}</b><span>$${l.join(" / $")}</span><small>${i === 0 ? "1 clue" : "3 clues"}</small></div>`).join("")}</div><p class="note">Each clue is worth nothing on its own: it only matters whether the team gets it right. If every team misses the same clue, nobody loses a life.</p></div>
    <div class="svpanel"><div class="sveye">Photo rounds</div>${seg("photos", [["true", "On"], ["false", "Off"]], c.photos)}<p class="note">Off leaves out Guess the Face, Guess the Picture, Egypt: Photo Edition and every clue that shows a photo.</p></div>
    <div class="svpanel"><div class="sveye">Titles in the draw</div><p class="note" style="margin:0 0 8px">Each round picks a random title, then a random category inside it. A title doesn't come back until the others have had a turn.</p><div class="svtitles">${BW_TITLES.map(t => { const off = t[3] === "photo" && !c.photos;
      return `<button data-title="${t[0]}" aria-pressed="${svTitleOn(t) && !off}" ${off ? "disabled" : ""}><b>${esc(t[1])}</b><small>${esc(t[2].filter(id => catById(id) && !HIDDEN_IDS.has(id)).map(id => catById(id).name).join(", "))}</small></button>`; }).join("")}</div></div>
    <div class="row"><button class="svbtn ghost" id="svBack">Back to title</button><button class="svbtn go" id="svStart">Start Survival</button></div>`;
}
$("#survSetup").addEventListener("click", e => {
  const c = SV.cfg, set = e.target.closest("[data-set]");
  if(set){ const k = set.dataset.set; let v = set.dataset.v; if(k === "lives") v = +v; if(k === "photos") v = v === "true"; c[k] = v; svSave(); renderSurvSetup(); return; }
  const tt = e.target.closest("[data-title]"); if(tt){ const t = BW_TITLES.find(x => x[0] === tt.dataset.title); c.titles[t[0]] = !svTitleOn(t);
    if(!BW_TITLES.some(x => svTitleOn(x) && svCats(x).length)) c.titles[t[0]] = true; svSave(); renderSurvSetup(); return; }
  const rm = e.target.closest("[data-rm]"); if(rm){ c.teams.splice(+rm.dataset.rm, 1); svSave(); renderSurvSetup(); return; }
  if(e.target.closest("#svAddTeam")){ c.teams.push("Team " + "ABCDEF"[c.teams.length]); svSave(); renderSurvSetup(); return; }
  if(e.target.closest("#svBack")){ showHome(); return; }
  if(e.target.closest("#svStart")){ c.teams = c.teams.map((n, i) => n.trim() || "Team " + "ABCDEF"[i]); svSave(); svInit(); Snd.unlock(); Snd.chime(); survShow(); }
});
$("#survSetup").addEventListener("input", e => { const i = e.target.dataset && e.target.dataset.bn; if(i !== undefined){ SV.cfg.teams[+i] = e.target.value; svSave(); } });
$("#modeSurv").onclick = survSetupShow;

/* ---------- the round screen ---------- */
const svHearts = t => `<div class="svhearts" aria-label="${t.lives} of ${SV.cfg.lives} lives">${Array.from({length:SV.cfg.lives}, (_, i) => `<i class="${i < t.lives ? "" : "x"}"></i>`).join("")}</div>`;
const svDots = (t, k) => `<div class="svdots">${Array.from({length:k}, (_, i) => `<i class="${t.dots[i] || ""}"></i>`).join("")}</div>`;
function renderSurv(){
  const st = SV.st, root = $("#survBody"); if(!st) return;
  if(st.over){ root.innerHTML = ""; return; }
  const r = st.round, sd = r >= SV_ROUNDS, once = SV.cfg.mode === "once", cat = catById(st.cat), who = once ? null : st.order[st.pos];
  const range = sd ? "$500" : SV_LADDER[r].length === 1 ? "$" + SV_LADDER[r][0] : "$" + SV_LADDER[r][0] + "–$" + SV_LADDER[r][1];
  const nm = cat.name, big = nm.length > 24 ? " long" : nm.length > 16 ? " mid" : "";
  const alive = svAlive().length;
  root.innerHTML = `
    <div class="svpill l">${sd ? "Sudden death · round " + (r - SV_ROUNDS + 1) : "Round " + (r + 1) + " / " + SV_ROUNDS}</div><div class="svpill r">${range}</div>
    <div class="svband"><small>${esc(bwTitle(st.title)[1])}</small><div class="svcat${big}">${esc(nm)}</div></div>
    <div class="svmid">
      <div class="svstamp">${once ? "Everyone answers" : "Clue " + (st.n + 1) + " of " + st.k}</div>
      ${once ? `<div class="svwho">Clue ${st.n + 1} of ${st.k} · ${alive} teams alive</div>` : `<div class="svwho"><b>${esc(st.teams[who].name)}</b> answers</div>`}
      <button class="svbtn go big" data-sv="open">${st.cur.seen ? "Open the clue again" : "Open the clue"}</button>
    </div>
    <div class="svrow" style="--n:${st.teams.length}">${st.teams.map((t, i) => { const out = t.lives <= 0, on = !out && (once ? true : i === who);
      return `<div class="svt${on ? " on" : ""}${out ? " out" : ""}"><div class="svn">${esc(t.name)}</div>${svHearts(t)}${out ? `<div class="svsub">Out in round ${t.out}</div>` : svDots(t, st.k)}${out ? `<div class="svstampout">OUT</div>` : ""}</div>`; }).join("")}</div>
    ${st.splash ? `<div class="svsplash"><div class="svbox"><h2>${esc(st.splash.head)}</h2>${st.splash.lines.map(l => `<p>${esc(l)}</p>`).join("")}<button class="svbtn go" data-sv="cont">Continue</button></div></div>` : ""}`;
}
function svOpen(){ const st = SV.st, once = SV.cfg.mode === "once", cur = st.cur; cur.seen = true;
  S.turn = once ? 0 : st.order[st.pos]; PICKS[`${cur.cat}-${cur.lvl}`] = cur.idx; openClue(cur.cat, cur.lvl); }
$("#survBody").addEventListener("click", e => { const a = e.target.closest("[data-sv]"); if(!a) return;
  if(a.dataset.sv === "open") svOpen(); else if(a.dataset.sv === "cont"){ SV.st.splash = null; svAdvance(); } });
$("#svHome").onclick = () => { const st = SV.st; if(st && !st.over && (st.round > 0 || st.n > 0 || st.pos > 0)) askConfirm("Leave this game?", "Going to the title screen ends this Survival game. It can't be resumed.", "Go to title", () => showHome(), true); else showHome(); };

/* ---------- results ---------- */
function svEndGroup(){ const st = SV.st, once = SV.cfg.mode === "once", al = st.alive, lines = [], gone = [];
  const missed = al.filter(i => st.res[i] === "no");
  if(missed.length === al.length){ lines.push("Everyone missed, so nobody loses a life."); }
  else missed.forEach(i => { const t = st.teams[i]; t.lives--; if(t.lives <= 0) gone.push(i); });
  if(gone.length){ st.outSeq++; gone.forEach(i => { const t = st.teams[i]; t.out = st.round >= SV_ROUNDS ? "sudden death" : st.round + 1; t.seq = st.outSeq; lines.push(`${t.name} is out.`); }); }
  st.splash = lines.length ? {head: gone.length ? "Eliminated" : "No lives lost", lines} : null;
  if(!st.splash) svAdvance(); else survShow(); }
function svAdvance(){ const st = SV.st; if(svAlive().length <= 1){ svEnd(); return; }
  if(st.n + 1 < st.k) svStartGroup(); else svStartRound();
  survShow(); }
/* the clue card hooks (called from renderClue and the Done button in app.js) */
function survBanner(c){ const st = SV.st; if(!st) return ""; const once = SV.cfg.mode === "once";
  return `<p class="note svbanner${c.warn ? " warn" : ""}">${c.warn ? "Mark every team first." : once ? "Every team answers this one. Mark each team below." : esc(st.teams[st.order[st.pos]].name) + " answers this one."}</p>`; }
function survAwards(c){ const st = SV.st, once = SV.cfg.mode === "once", who = once ? st.alive : [st.order[st.pos]];
  return `<div class="award">${who.map(i => `<div class="grp"><span>${esc(st.teams[i].name)}</span><button class="y${c.awards[i] === 1 ? " on" : ""}" data-aw="${i}" data-v="1">Right</button>${BW_HALF.has(c.cat) ? `<button class="h${c.awards[i] === 0.5 ? " on" : ""}" data-aw="${i}" data-v="0.5">Half</button>` : ""}<button class="n${c.awards[i] === -1 ? " on" : ""}" data-aw="${i}" data-v="-1">Wrong</button></div>`).join("")}</div>`; }
function survDone(c){
  const st = SV.st, once = SV.cfg.mode === "once", who = once ? st.alive : [st.order[st.pos]], marked = who.filter(i => c.awards[i] !== undefined);
  if(marked.length && marked.length < who.length){ c.warn = true; renderClue(); return; }   // all-at-once: don't close until every team has a result
  S.used.add(`${c.cat}-${c.lvl}-${c.idx}`); store.set("jn_used", [...S.used]); histNote();
  closeCard();
  if(!marked.length){ survShow(); return; }   // closed with no result: back to the round screen to open it again
  who.forEach(i => { const v = c.awards[i]; st.res[i] = v === 1 ? "ok" : v === 0.5 ? "half" : "no"; st.teams[i].dots[st.n] = st.res[i]; });
  if(once || st.pos + 1 >= st.order.length){ svEndGroup(); return; }
  st.pos++; svNextClue(); survShow(); }
function svEnd(){ const st = SV.st; st.over = true; survShow();
  const win = st.teams.findIndex(t => t.lives > 0);
  const ranked = st.teams.map((t, i) => ({...t, i, key: t.lives > 0 ? Infinity : t.seq})).sort((a, b) => b.key - a.key);
  const rankOf = t => 1 + ranked.filter(x => x.key > t.key).length;
  $("#winEyebrow").textContent = "Survival";
  $("#winTitle").innerHTML = win >= 0 ? `${esc(st.teams[win].name)}<br><span>win!</span>` : `Nobody<br><span>survives</span>`;
  const note = t => t.lives > 0 ? `${t.lives} ${t.lives === 1 ? "life" : "lives"} left` : `Out in round ${t.out}`;
  $("#podium").innerHTML = ranked.slice(0, 3).map(t => { const r = rankOf(t); return `<div class="pod p${Math.min(r, 3)}"><div class="who">${esc(t.name)}</div><div class="pts" style="font-size:.5em">${esc(note(t))}</div><div class="step">${r}${["th","st","nd","rd"][(r % 100 > 10 && r % 100 < 14) || r % 10 > 3 ? 0 : r % 10]}</div></div>`; }).join("");
  $("#podium").hidden = false;
  $("#standings").innerHTML = ranked.length > 3 ? ranked.slice(3).map(t => `<li><span>${rankOf(t)}. ${esc(t.name)}</span><b>${esc(note(t))}</b></li>`).join("") : "";
  $("#winBoard").hidden = true; $("#winBox").hidden = false; $("#playAgain").textContent = "New game"; $("#winNote").textContent = "New game keeps the same teams and settings, restores every team's lives and draws fresh categories."; $("#playAgain").focus();
  confetti(); ledStart(); if(S.sound) playEnd(NORMAL_INTRO); }
function survAgain(){ hideWinner(); $("#playAgain").textContent = "Play again"; svInit(); survShow(); }
function survSetupAgain(){ hideWinner(); $("#playAgain").textContent = "Play again"; survSetupShow(); }
