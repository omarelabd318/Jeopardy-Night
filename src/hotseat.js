/* 6.59 (Omar): Hot Seat, a push-your-luck mode. One team at a time sits in the hot seat and plays a streak of clues. The pot doubles with every right
   answer (100, 200, 400, 800, 1,600 and on, no cap) and after each one the team banks it or risks it. A wrong answer loses the unbanked pot and the
   seat passes. Every clue is a random 200-500 (never a 100), hidden until the clue opens. High Roller look (green felt, casino chips, playing cards),
   chosen by Omar from four previews. It reuses the clue card and the winner screen; app.js only calls hsBanner, hsAwards, hsDone, hsUseSwap, hsAgain,
   hsSetupAgain and hsLeave. Setup is saved on this device in jn_hsCfg (the game itself isn't saved). To remove: see the 6.59 NOTES entry. */
const HS = {cfg:null, st:null};
const HS_LVLS = [200,300,400,500];   // 6.59 (Omar): clues are random from these pools, never a 100. To bring 100s back, add 100 to this list.
const HS_BAD = new Set(["act","impostor","password","closest","mix"]), HS_HALF = new Set(["song","pin"]), HS_WINNOTE = $("#winNote").textContent;   // rounds that need other teams are left out; half answers: song or singer, country only
const hsNum = n => Number(n).toLocaleString("en-US");
const hsPotAt = k => 100 * 2 ** k;   // the pot after k+1 right answers
const hsShuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function hsDefaults(){ const names = S.teams.map(t => t.name).slice(0, 6); while(names.length < 2) names.push("Team " + "ABCDEF"[names.length]);
  return {teams:names, turns:5, swap:true, photos:true}; }
HS.cfg = Object.assign(hsDefaults(), store.get("jn_hsCfg", {}));
const hsSave = () => store.set("jn_hsCfg", HS.cfg);

/* ---------- dealing clues ---------- */
const hsHas = id => HS_LVLS.some(l => ((DATA[id] || {})[l] || []).length);
const hsOkCat = id => { const c = catById(id); return !!c && !c.mode && !HS_BAD.has(c.type) && !HIDDEN_IDS.has(id) && (!LOCKED_IDS.has(id) || unlocked.has(id)) && (HS.cfg.photos || c.type !== "photo") && hsHas(id); };
function hsIdx(cat, lvl){   // an unplayed clue; with photo rounds off, never one that shows a photo
  const n = ((DATA[cat] || {})[lvl] || []).length; if(!n) return null;
  if(catById(cat).type === "photo") return HS.cfg.photos ? pickIdx(cat, lvl) : null;
  const ok = [...Array(n).keys()].filter(i => HS.cfg.photos || !imgRefFor(cat, lvl, i)); if(!ok.length) return null;
  const fresh = ok.filter(i => !S.used.has(`${cat}-${lvl}-${i}`)), from = fresh.length ? fresh : ok;
  return from[Math.floor(Math.random() * from.length)]; }
function hsCard(cat, lvl){ const idx = hsIdx(cat, lvl); if(idx == null) return null; warmRef(imgRefFor(cat, lvl, idx)); return {cat, lvl, idx}; }
function hsDeal(again){   // three category cards, each with a random hidden value; no category twice in one turn
  const st = HS.st, ids = hsShuffle(CATS.map(c => c.id).filter(id => hsOkCat(id) && !st.usedCats.includes(id))), out = [];
  for(const cat of ids){ if(out.length >= 3) break;
    for(let t = 0; t < 8; t++){ const card = hsCard(cat, HS_LVLS[Math.floor(Math.random() * HS_LVLS.length)]); if(card){ out.push(card); break; } } }
  if(out.length < 3 && st.usedCats.length && !again){ st.usedCats = []; return hsDeal(true); }
  st.cards = out; }
const hsInit = () => { HS.st = {v:1, teams:HS.cfg.teams.map(n => ({name:n, score:0, swap:HS.cfg.swap})), turnNo:0, pot:0, streak:0, usedCats:[], cards:[], phase:"pick", cur:null, res:null, over:false, tb:null, tbWin:null}; hsDeal(); return HS.st; };
const hsTotal = () => HS.cfg.teams.length * HS.cfg.turns;
const hsSeat = () => { const st = HS.st; return st.tb ? st.tb.ids[st.tb.i] : st.turnNo % st.teams.length; };
const hsNext = () => HS.st.streak ? HS.st.pot * 2 : 100;   // what the pot becomes on the next right answer

/* ---------- screens ---------- */
function hsEnter(){ if(S.mode === "hotseat") return; bingoLeave(); bidLeave(); S.preMode = {power:S.power, wager:S.wager, steal:S.steal, ffa:S.ffa, qrAns:S.qrAns, skipPhones:S.skipPhones};
  S.power = S.wager = S.steal = S.ffa = false; S.mode = "hotseat"; document.body.classList.add("hsmode"); }
function hsLeave(){ if(S.mode !== "hotseat") return;
  closeCard(); Object.assign(S, S.preMode || {}); S.mode = null; S.preMode = null; document.body.classList.remove("hsmode");
  $("#hotSeat").hidden = true; $("#hsSetup").hidden = true; $("#winEyebrow").textContent = "Final scores"; $("#playAgain").textContent = "Play again"; $("#winNote").textContent = HS_WINNOTE;
  try{ syncFfaOpt(); }catch(e){} }
function hsHideAll(){ ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#hotSeat","#hsSetup"].forEach(s => { const e = $(s); if(e) e.hidden = true; }); }
function hsSetupShow(){ hsEnter(); hsHideAll(); $("#hsSetup").hidden = false; renderHsSetup(); window.scrollTo(0, 0); }
function hsShow(){ hsEnter(); hsHideAll(); $("#hotSeat").hidden = false; renderHs(); window.scrollTo(0, 0); }
function renderHsSetup(){
  const c = HS.cfg, seg = (key, opts, cur) => `<div class="seg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
  $("#hsSetup").innerHTML = `
    <div><div class="hseye">Game mode</div><h1>Hot <span>Seat</span></h1>
      <p class="sub">One team sits in the hot seat and plays a streak of clues. Every right answer doubles the pot (100, 200, 400, 800, 1,600 and on), and after each one the team banks it or risks it on the next clue. A wrong answer loses the pot that isn't banked yet, and the seat passes to the next team. Clues are random from 200 to 500 and their value stays hidden until they open.</p></div>
    <div class="hspanel"><div class="hseye">Teams</div><div class="hsteams">${c.teams.map((n, i) => `<div class="hsteam"><input type="text" id="hsTeam${i}" data-hn="${i}" value="${esc(n)}" maxlength="24" aria-label="Team ${i + 1} name">${c.teams.length > 2 ? `<button class="hsb ghost" data-rm="${i}" aria-label="Remove ${esc(n)}">Remove</button>` : ""}</div>`).join("")}</div>
      ${c.teams.length < 6 ? `<div><button class="hsb ghost" id="hsAddTeam">Add team</button></div>` : ""}</div>
    <div class="hspanel"><div class="hseye">Turns per team</div>${seg("turns", [3, 4, 5, 6, 7, 8].map(n => [n, n]), c.turns)}<p class="note">Every team gets the same number of turns in the hot seat.</p></div>
    <div class="hspanel"><div class="hseye">One swap per team</div>${seg("swap", [["true", "On"], ["false", "Off"]], c.swap)}<p class="note">On: each team can swap one clue it doesn't like for another from the same category and value, once per game.</p></div>
    <div class="hspanel"><div class="hseye">Photo rounds</div>${seg("photos", [["true", "On"], ["false", "Off"]], c.photos)}<p class="note">Off leaves out Guess the Face, Guess the Picture and every clue that shows a photo.</p></div>
    <div class="row"><button class="hsb ghost" id="hsBack">Back to title</button><button class="hsb go" id="hsStart">Take a seat</button></div>`;
}
$("#hsSetup").addEventListener("click", e => {
  const c = HS.cfg, set = e.target.closest("[data-set]");
  if(set){ const k = set.dataset.set; let v = set.dataset.v; if(k === "turns") v = +v; if(k === "swap" || k === "photos") v = v === "true"; c[k] = v; hsSave(); renderHsSetup(); return; }
  const rm = e.target.closest("[data-rm]"); if(rm){ c.teams.splice(+rm.dataset.rm, 1); hsSave(); renderHsSetup(); return; }
  if(e.target.closest("#hsAddTeam")){ c.teams.push("Team " + "ABCDEF"[c.teams.length]); hsSave(); renderHsSetup(); return; }
  if(e.target.closest("#hsBack")){ showHome(); return; }
  if(e.target.closest("#hsStart")){ c.teams = c.teams.map((n, i) => n.trim() || "Team " + "ABCDEF"[i]); hsSave(); hsInit(); Snd.unlock(); hsShow(); }
});
$("#hsSetup").addEventListener("input", e => { const i = e.target.dataset && e.target.dataset.hn; if(i !== undefined){ HS.cfg.teams[+i] = e.target.value; hsSave(); } });
$("#modeHot").onclick = hsSetupShow;

/* ---------- the table ---------- */
function renderHs(){
  const st = HS.st, root = $("#hsBody"); if(!st) return;
  if(st.over){ root.innerHTML = ""; return; }
  const seat = hsSeat(), t = st.teams[seat], n = st.streak, start = Math.max(0, n - 3), round = Math.floor(st.turnNo / st.teams.length) + 1;
  const chips = [0,1,2,3,4].map(j => { const k = start + j, cls = k < n - 1 ? "done" : k === n - 1 ? "cur" : k === n ? "nxt" : ""; return `<div class="hschip ${cls}">${hsNum(hsPotAt(k))}</div>`; }).join("");
  const sub = st.tb ? "TIE-BREAK · ONE 500 CLUE EACH" : `ROUND ${round} OF ${HS.cfg.turns} · ${n ? n + " RIGHT IN A ROW" : "FIRST CLUE OF THE TURN"}`;
  const lead = Math.max(...st.teams.map(m => m.score));
  const mid = st.tb ? "" : `<div class="hsstack"><b>${hsNum(st.pot)}</b><small>${st.pot ? "IN THE POT" : "NOTHING AT RISK YET"}</small></div>
    <button class="hscp bank" data-hs="bank" ${st.pot && st.phase === "pick" ? "" : "disabled"}><div>Bank<small>${hsNum(st.pot)}</small></div></button><div class="hscp risk"><div>Risk<small>${hsNum(hsNext())}</small></div></div>`;
  let low = "", ov = "";
  if(st.phase === "pick") low = `<div class="hshint">Tap a card to risk it${st.pot ? ", or bank the pot" : ""}</div><div class="hscards">${st.cards.map((c, i) => `<button class="hspc" data-card="${i}"><b>${esc(catById(c.cat).name)}</b><span>Value hidden</span></button>`).join("")}</div>`;
  else if(st.phase === "clue" || st.phase === "tbclue") low = `<div class="hscards one"><button class="hsb go" data-hs="reopen">Open the clue again</button></div>`;
  if(st.phase === "result"){ const r = st.res, last = st.turnNo + 1 >= hsTotal();
    ov = `<div class="hsov"><h2 class="${r.kind === "miss" && r.pts ? "lose" : ""}">${r.kind === "bank" ? "Banked!" : r.kind === "half" ? "Half answer" : r.pts ? "Busted!" : "Missed it"}</h2>
      <div class="who">${r.kind === "miss" ? (r.pts ? `${esc(r.name)} loses ${hsNum(r.pts)}` : `${esc(r.name)} had nothing at risk`) : r.pts ? `${esc(r.name)} keeps ${hsNum(r.pts)}` : `${esc(r.name)} had nothing to keep`}</div>
      <button class="hsb go" data-hs="next">${last ? "Final scores" : "Next team"}</button></div>`; }
  if(st.phase === "tb"){ const names = st.tb.ids.map(i => esc(st.teams[i].name));
    ov = `<div class="hsov"><h2>Tie-break</h2><div class="who">${st.tb.msg || `${names.join(" and ")} are tied.`}</div><p class="note">${esc(t.name)} gets one 500 clue. Right wins it.</p><button class="hsb go" data-hs="tbopen">Open the clue</button></div>`; }
  root.innerHTML = `
    <div class="hssco">${st.teams.map((m, i) => `<div class="${i === seat ? "on" : ""}"><span>${esc(m.name)}${m.swap && HS.cfg.swap ? " ↻" : ""}</span><span class="${m.score < 0 ? "neg" : ""}">${hsNum(m.score)}</span></div>`).join("")}</div>
    <div class="hsttl">${esc(t.name)} is in the Hot Seat<small>${sub}</small></div>
    <div class="hsladder">${st.tb ? "" : chips}</div>${mid}${low}${ov}`;
}
function hsOpen(){ const st = HS.st, c = st.cur; renderHs();   // 6.62: redraw the table first, so "Back to the table" shows "Open the clue again" (it used to show the old, dead cards)
  S.turn = hsSeat(); PICKS[`${c.cat}-${c.lvl}`] = c.idx; openClue(c.cat, c.lvl); }
function hsResult(kind, pts){ const st = HS.st, t = st.teams[hsSeat()]; if(kind !== "miss") t.score += pts;
  st.res = {kind, pts, name:t.name}; st.phase = "result"; st.cur = null; if(kind === "miss") Snd.tick(); else Snd.chime(); renderHs(); }
function hsNextTeam(){ const st = HS.st; st.turnNo++; if(st.turnNo >= hsTotal()) return hsFinish();
  st.pot = 0; st.streak = 0; st.usedCats = []; st.phase = "pick"; st.res = null; hsDeal(); renderHs(); }
function hsFinish(){ const st = HS.st, max = Math.max(...st.teams.map(t => t.score)), top = st.teams.map((t, i) => i).filter(i => st.teams[i].score === max);
  if(top.length < 2) return hsEnd();
  st.tb = {ids:top, i:0, res:{}, msg:""}; st.phase = "tb"; st.res = null; renderHs(); }
function hsTbOpen(){ const st = HS.st, ids = hsShuffle(CATS.map(c => c.id).filter(hsOkCat));
  for(const cat of ids){ const card = hsCard(cat, 500); if(card){ st.cur = card; st.phase = "tbclue"; hsOpen(); return; } } }
function hsTbDone(c, v){ const st = HS.st, tb = st.tb; if(v === undefined){ renderHs(); return; }
  tb.res[tb.ids[tb.i]] = v === 1; tb.i++;
  if(tb.i < tb.ids.length){ st.phase = "tb"; st.cur = null; tb.msg = ""; renderHs(); return; }
  const rights = tb.ids.filter(i => tb.res[i]);
  if(rights.length === 1){ st.tbWin = rights[0]; return hsEnd(); }
  const same = rights.length === 0 || rights.length === tb.ids.length;
  st.tb = {ids: same ? tb.ids : rights, i:0, res:{}, msg: same ? "Everyone " + (rights.length ? "got it" : "missed") + ", so go again." : "Still tied, go again."}; st.phase = "tb"; st.cur = null; renderHs(); }
function hsUseSwap(){ const st = HS.st, t = st && st.teams[hsSeat()]; if(!HS.cfg.swap || st.tb || !t || !t.swap) return false; t.swap = false; return true; }
$("#hsBody").addEventListener("click", e => {
  const st = HS.st; if(!st) return;
  const card = e.target.closest("[data-card]");
  if(card && st.phase === "pick"){ st.cur = st.cards[+card.dataset.card]; st.usedCats.push(st.cur.cat); st.phase = "clue"; Snd.unlock(); Snd.blip(); hsOpen(); return; }
  const b = e.target.closest("[data-hs]"); if(!b) return; const k = b.dataset.hs;
  if(k === "bank" && st.pot && st.phase === "pick") hsResult("bank", st.pot);
  else if(k === "reopen" && st.cur) hsOpen();
  else if(k === "next") hsNextTeam();
  else if(k === "tbopen") hsTbOpen();
});
$("#hsHome").onclick = () => { const st = HS.st; if(st && !st.over && (st.turnNo > 0 || st.streak > 0)) askConfirm("Leave this game?", "Going to the title screen ends this Hot Seat game. It can't be resumed.", "Go to title", () => showHome(), true); else showHome(); };

/* ---------- the clue card (called from renderClue and the Done button in app.js) ---------- */
function hsBanner(c){ const st = HS.st; if(!st || !st.cur) return ""; st.cur.idx = c.idx;   // keeps "Open the clue again" on the same clue after a swap
  const nm = esc(st.teams[hsSeat()].name);
  return st.tb ? `<p class="note hsbanner">Tie-break: ${nm} gets this 500 clue. Right wins it.</p>`
    : `<p class="note hsbanner">${nm} is in the Hot Seat. ${st.pot ? `Pot ${hsNum(st.pot)}: right makes it ${hsNum(hsNext())}, wrong loses ${hsNum(st.pot)}.` : "First clue of the turn: right starts the pot at 100, wrong loses nothing."}</p>`; }
function hsAwards(c){ const st = HS.st, i = hsSeat(), tb = !!st.tb;
  return `<div class="award"><div class="grp"><span>${esc(st.teams[i].name)}</span><button class="y${c.awards[i] === 1 ? " on" : ""}" data-aw="${i}" data-v="1">Right${tb ? "" : " · pot " + hsNum(hsNext())}</button>${!tb && HS_HALF.has(c.cat) ? `<button class="h${c.awards[i] === 0.5 ? " on" : ""}" data-aw="${i}" data-v="0.5">Half · bank ${hsNum(st.pot)}</button>` : ""}<button class="n${c.awards[i] === -1 ? " on" : ""}" data-aw="${i}" data-v="-1">Wrong${tb ? "" : " · lose " + hsNum(st.pot)}</button></div></div>`; }
function hsSwapBtn(c){ const st = HS.st, t = st && st.teams[hsSeat()]; return !c.preview && !c.revealed && HS.cfg.swap && t && t.swap && !st.tb ? `<button class="btn small" data-act="swap" title="Swap this clue for another from the same category and value. Once per team per game.">Swap clue (1 left)</button>` : ""; }
function hsDone(c){
  const st = HS.st, i = hsSeat(), v = c.awards[i];
  S.used.add(`${c.cat}-${c.lvl}-${c.idx}`); store.set("jn_used", [...S.used]); histNote();
  closeCard(); if(!st) return;
  if(st.tb) return hsTbDone(c, v);
  if(v === undefined){ renderHs(); return; }   // closed with no result: back to the table, where the clue can be opened again
  if(v === 1){ st.streak++; st.pot = hsPotAt(st.streak - 1); st.phase = "pick"; st.cur = null; hsDeal(); Snd.blip(); renderHs(); return; }
  if(v === 0.5) return hsResult("half", st.pot);   // a half answer is a safe stop: bank the pot from before this clue
  hsResult("miss", st.pot); }
function hsEnd(){ const st = HS.st; st.over = true; st.tb = null; hsShow();
  const ranked = st.teams.map((t, i) => ({...t, i})).sort((a, b) => b.score - a.score || (b.i === st.tbWin) - (a.i === st.tbWin)), max = ranked[0].score;
  const top = st.tbWin != null ? [ranked[0]] : ranked.filter(t => t.score === max);
  const rankOf = (t, k) => st.tbWin != null ? k + 1 : 1 + ranked.filter(x => x.score > t.score).length;
  $("#winEyebrow").textContent = "Hot Seat";
  $("#winTitle").innerHTML = top.length > 1 ? `It's a tie!<br><span>${esc(top.map(t => t.name).join(" & "))}</span>` : `${esc(top[0].name)}<br><span>win!</span>`;
  $("#podium").innerHTML = ranked.slice(0, 3).map((t, k) => { const r = rankOf(t, k); return `<div class="pod p${Math.min(r, 3)}"><div class="who">${esc(t.name)}</div><div class="pts">${hsNum(t.score)}</div><div class="step">${r}${["th","st","nd","rd"][(r % 100 > 10 && r % 100 < 14) || r % 10 > 3 ? 0 : r % 10]}</div></div>`; }).join("");
  $("#podium").hidden = false;
  $("#standings").innerHTML = ranked.length > 3 ? ranked.slice(3).map((t, k) => `<li><span>${rankOf(t, k + 3)}. ${esc(t.name)}</span><b>${hsNum(t.score)}</b></li>`).join("") : "";
  $("#winBoard").hidden = true; $("#winBox").hidden = false; $("#playAgain").textContent = "New game"; $("#winNote").textContent = "New game keeps the same teams and settings and resets the scores."; $("#playAgain").focus();
  confetti(); ledStart(); if(S.sound) playEnd(NORMAL_INTRO); }
function hsAgain(){ hideWinner(); $("#playAgain").textContent = "Play again"; hsInit(); hsShow(); }
function hsSetupAgain(){ hideWinner(); $("#playAgain").textContent = "Play again"; hsSetupShow(); }
