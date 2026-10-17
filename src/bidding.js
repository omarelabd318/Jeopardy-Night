/* 6.49 (Omar): Bidding Wars, mode 2 of his rulebook. Teams bid on lots they only know by a title (with the categories it includes listed under it)
   and a tier; the buyer answers and wins or loses exactly the bid. Entry $200–$300 (max bid $600), Medium $300–$400 ($1,200), Expert $400–$500
   ($1,500). Bidding opens at the bottom of the range and goes up $50 at a time. 10–15 lots, each with a random tier. Trading Floor look (black,
   amber LED numbers, green bid buttons, a score ticker), chosen by Omar from three previews. It reuses the clue card and the winner screen; app.js
   only calls bidBanner, bidAwards, bidDone, bidAgain, bidSetupAgain and bidLeave. Setup is saved on this device in jn_bidCfg (the game itself is not saved since 6.50).
   To remove: see the 6.49 NOTES entry. */
const BW = {cfg:null, st:null, timer:null, left:0, phones:false, gid:0, seen:{c:null, n:0}, busy:false, cnt:{}};
const BW_TIERS = [{k:"Entry", lv:[200,300], cap:600}, {k:"Medium", lv:[300,400], cap:1200}, {k:"Expert", lv:[400,500], cap:1500}];
const BW_WINNOTE = $("#winNote").textContent, BW_STEP = 50, BW_RAISES = [50,100,200], BW_HALF = new Set(["song","pin"]);   // the two categories that give half points (song or singer; country only); half the bid there
/* the titles shown while bidding; each groups related categories from one setup section. photo: needs the photo rounds on. off: off by default */
const BW_TITLES = [
  ["egfilm", "Egyptian Film, TV & Music", ["ecin","ramadan","ploteg","quoteeg","emeg","lyricar"]],
  ["egplace", "Egypt: Places & History", ["egy","egh","cairo","egyph"]],
  ["egcult", "Egyptian Culture & Sayings", ["prov","memeeg","emseg"]],
  ["arab", "Arab World", ["arab","ctryar"]],
  ["fbplay", "Football: Players & Careers", ["whoami","cclub","path","xfer","shirt"]],
  ["fbcups", "Football: Leagues & Cups", ["pl","ucl","wc","wc26","score","fyear","egfb"]],
  ["fbcoach", "Football: Coaches, Tactics & Grounds", ["mgr","form","stad","fb"]],
  ["sports", "Other Sports", ["sport","tennis"]],
  ["movies", "Movies & Cartoons", ["tv","blockbuster","romcom","pixar","toons"]],
  ["franch", "Franchises", ["marvel","hp","hgames"]],
  ["series", "TV Series", ["got","peaky","bb","pb","st","office","friends","himym","netflix"]],
  ["words", "Quotes, Plots & Emoji", ["plot","lit","emov","quote","qblank"]],
  ["songs", "Songs & Lyrics", ["songt","song","oldies","lyric"]],
  ["artists", "Music Artists & Charts", ["mus","spot","igf"]],
  ["games", "Video Games", ["gta","vgames"]],
  ["geo", "World Geography", ["geo","ctry","landmark"]],
  ["flags", "Flags & Maps", ["flag","shape","pin"]],
  ["lang", "Languages", ["lang","trans"]],
  ["hist", "History & Myth", ["his","ww2","year","myth"]],
  ["islam", "Islam & Traditions", ["islam","holi"]],
  ["sci", "Science, Space & Nature", ["sci","space","animal","facts"]],
  ["food", "Food & Drink", ["food","ffood","cal","cocktail"]],
  ["biz", "Business & Tech", ["mb","curr","brand","tg"]],
  ["gk", "General Knowledge", ["gk","nick","books","cars"]],
  ["faces", "Guess the Face", ["actor","person","footy"], "photo"],
  ["pics", "Guess the Picture", ["car","foodpic","logo","gctry"], "photo"],
  ["puzz", "Puzzles", ["rid","link","headl","order","emsen"], "off"]];
const BW_PHOTO_CATS = new Set(["egyph", ...BW_TITLES.filter(t => t[3] === "photo").flatMap(t => t[2])]);
const bwCats = t => t[2].filter(id => catById(id) && !HIDDEN_IDS.has(id) && (BW.cfg.photos || !BW_PHOTO_CATS.has(id)));
const bwTitleOn = t => BW.cfg.titles[t[0]] !== undefined ? BW.cfg.titles[t[0]] : t[3] !== "off";
const bwMoney = v => (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-US");
function bwDefaults(){ const names = S.teams.map(t => t.name).slice(0, 6); while(names.length < 2) names.push("Team " + "ABCDEF"[names.length]);
  return {teams:names, lots:12, secs:6, photos:true, raises:true, phones:false, titles:{}, potato:false, mystery:false, sealed:false, ssecs:15}; }
BW.cfg = Object.assign(bwDefaults(), store.get("jn_bidCfg", {}));
/* 7.67 (Omar): three switches in setup, all off by default. Hot Potato: a buyer who can't answer hands the lot to a team that wants it (twice per team per game).
   Mystery lots: two lots per game hide even their title and pay double for a right answer. Sealed bids: with phone bidding, every team sends one secret bid. */
const BW_POTATOES = 2, BW_SEALED_OPTS = [10, 15, 20, 30];   // 7.68 (Omar): 10 s felt short, so sealed bids default to 15 s and can be set to 10, 15, 20 or 30
const bwSealedSecs = () => BW_SEALED_OPTS.includes(BW.cfg.ssecs) ? BW.cfg.ssecs : 15;
const bwQ = v => Math.round(v / 5) * 5;   // Hot Potato amounts are rounded to the nearest $5
const bwWho = lot => lot.potato ? lot.potato.to : lot.buyer;   // who answers: the buyer, or the team that took the Hot Potato
const bwName = lot => lot.mystery ? "Mystery lot" : bwTitle(lot.title)[1];
const bwSave = () => store.set("jn_bidCfg", BW.cfg);
const bwPersist = () => {};   // 6.50: Bidding Wars games aren't saved (was: if(BW.st) store.set("jn_bid", BW.st))

/* ---------- dealing lots ---------- */
function bwIdx(cat, lvl){   // an unplayed clue; with photo rounds off, never one that shows a photo
  const n = (pool(cat, lvl) || []).length; if(!n) return null;
  if(catById(cat).type === "photo") return BW.cfg.photos ? pickIdx(cat, lvl) : null;
  const ok = [...Array(n).keys()].filter(i => BW.cfg.photos || !imgRefFor(cat, lvl, i)); if(!ok.length) return null;
  const fresh = ok.filter(i => !S.used.has(`${cat}-${lvl}-${i}`)), from = fresh.length ? fresh : ok;
  return from[Math.floor(Math.random() * from.length)]; }
function bwTiers(n){ const t = []; if(n >= 9) [0,1,2].forEach(k => t.push(k, k, k)); while(t.length < n) t.push(Math.floor(Math.random() * 3)); return bgShuffle(t); }
function bwLot(tier, prev, seen){
  const titles = BW_TITLES.filter(t => bwTitleOn(t) && bwCats(t).length);
  let opts = titles.filter(t => t[0] !== prev && !seen.has(t[0])); if(!opts.length) opts = titles.filter(t => t[0] !== prev); if(!opts.length) opts = titles;
  for(let tries = 0; tries < 30; tries++){ const t = opts[Math.floor(Math.random() * opts.length)], cats = bwCats(t);
    const cat = cats[Math.floor(Math.random() * cats.length)], lvl = BW_TIERS[tier].lv[Math.floor(Math.random() * 2)], idx = bwIdx(cat, lvl);
    if(idx == null) continue;
    seen.add(t[0]); warmRef(imgRefFor(cat, lvl, idx)); return {title:t[0], tier, cat, lvl, idx, buyer:null, price:0, res:null}; }
  return null; }
function bwDeal(n){ const lots = [], seen = new Set(); let prev = null;
  for(const tier of bwTiers(n)){ if(seen.size >= BW_TITLES.length - 2) seen.clear(); const l = bwLot(tier, prev, seen); if(l){ lots.push(l); prev = l.title; } }
  if(BW.cfg.mystery){ const idx = bgShuffle(lots.map((l, k) => k)).slice(0, 2); idx.forEach(k => { lots[k].mystery = true; }); }   // 7.67: two mystery lots
  return lots; }
const bwInit = () => (BW.gid++, {v:1, lots:bwDeal(BW.cfg.lots), i:0, teams:BW.cfg.teams.map(n => ({name:n, score:0, hp:0})), bid:0, leader:-1, phase:"lot", extra:0, over:false, sealedOn:!!BW.cfg.sealed, sealed:null});

/* ---------- screens ---------- */
function bidEnter(){ if(S.mode === "bidding") return; bingoLeave(); S.preMode = {power:S.power, wager:S.wager, steal:S.steal, ffa:S.ffa, skipPhones:S.skipPhones};
  S.power = S.wager = S.steal = S.ffa = false; S.mode = "bidding"; document.body.classList.add("bidmode"); }
/* 6.50 (Omar): no resuming a Bidding Wars game. It isn't saved any more, and an old save is cleared. To undo: restore this function,
   bwPersist and the #bidResume click handler from 6.49, the #bidResume button in head.html, and the plain bwHome handler. */
function bidResumeBtn(){ try{ localStorage.removeItem("jn_bid"); }catch(e){} }
function bidLeave(){ bidResumeBtn(); if(S.mode !== "bidding") return; bwStop();
  closeCard(); Object.assign(S, S.preMode || {}); S.mode = null; S.preMode = null; document.body.classList.remove("bidmode");
  $("#bidding").hidden = true; $("#bidSetup").hidden = true; $("#bwLobby").hidden = true; if(BW.phones && RELAY === true && S.room) ffaPost({cur:null, s:{}}); BW.phones = false; $("#winEyebrow").textContent = "Final scores"; $("#playAgain").textContent = "Play again"; $("#winNote").textContent = BW_WINNOTE;
  try{ syncFfaOpt(); }catch(e){} }
function bwHideAll(){ ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#bwLobby"].forEach(s => { const e = $(s); if(e) e.hidden = true; }); }
function bidSetupShow(){ bidEnter(); bwStop(); bwHideAll(); $("#bidSetup").hidden = false; renderBidSetup(); window.scrollTo(0, 0); }
function bidShow(){ bidEnter(); bwHideAll(); $("#bidding").hidden = false; renderBid(); window.scrollTo(0, 0); }
function renderBidSetup(){
  const c = BW.cfg, seg = (key, opts, cur) => `<div class="seg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
  $("#bidSetup").innerHTML = `
    <div><div class="bweye">Game mode</div><h1>Bidding <span>Wars</span></h1>
      <p class="sub">Every lot shows a title, the categories it includes and a difficulty range. Teams bid for the right to answer; the highest bid buys it and only the buyer answers. Right wins the bid, wrong loses it. Scores can go negative and any team can still bid up to the max.</p>
      <div class="bwtiers">${BW_TIERS.map(t => `<div><b>${t.k}</b><span>$${t.lv[0]}–$${t.lv[1]}</span><small>Opens at $${t.lv[0]} · ${c.raises ? "raise $" + BW_RAISES.join("/$") : "up $" + BW_STEP} · max ${bwMoney(t.cap)}</small></div>`).join("")}</div></div>
    <div class="bwpanel"><div class="bweye">Teams</div><div class="bwteams">${c.teams.map((n, i) => `<div class="bwteam"><input type="text" id="bwTeam${i}" data-bn="${i}" value="${esc(n)}" maxlength="24" aria-label="Team ${i + 1} name">${c.teams.length > 2 ? `<button class="bwbtn ghost" data-rm="${i}" aria-label="Remove ${esc(n)}">Remove</button>` : ""}</div>`).join("")}</div>
      ${c.teams.length < 6 ? `<div><button class="bwbtn ghost" id="bwAddTeam">Add team</button></div>` : ""}</div>
    <div class="bwpanel"><div class="bweye">Number of lots</div>${seg("lots", [10, 11, 12, 13, 14, 15].map(n => [n, n]), c.lots)}<p class="note">Each lot gets a random tier. With 10 or more, every tier comes up at least three times.</p></div>
    <div class="bwpanel"><div class="bweye">Sold timer</div>
      <div class="bwslide"><input type="range" id="bwSecs" min="3" max="20" step="1" value="${c.secs || 6}" ${c.secs ? "" : "disabled"} aria-label="Seconds until sold"><output id="bwSecsOut">${c.secs ? c.secs + " seconds" : "Off"}</output>
      <button class="bwbtn ghost" data-set="secs" data-v="${c.secs ? 0 : 6}">${c.secs ? "Turn off (host taps SOLD)" : "Turn on"}</button></div>
      <p class="note">After each bid the lot is sold when this many seconds pass with no higher bid. The host can always tap SOLD early.</p></div>
    <div class="bwpanel"><div class="bweye">Raise amounts</div>${seg("raises", [["true", "Teams choose"], ["false", "+$50 only"]], c.raises)}<p class="note">Teams choose: each team card gets +$50 / +$100 / +$200 buttons. +$50 only: every bid goes up by $50.</p></div>
    <div class="bwpanel"><div class="bweye">Phone bidding</div>${seg("phones", [["true", "On"], ["false", "Off"]], c.phones)}<p class="note">${RELAY === true || RELAY === null ? "On: a QR code shows before the first lot. Each team scans it with a phone, picks its team and bids from there; answers are still given out loud on the TV. The TV's bid buttons keep working too." : "Needs the Cloudflare link: the phones send their bids through it, so it can't be used here."}</p></div>
    <div class="bwpanel" title="A buyer who can't answer passes the lot to a team that wants it. Twice per team per game. Buyer pays 25% of the price; the taker gets +50% if right, −25% if wrong."><div class="bweye">Hot Potato</div>${seg("potato", [["true", "On"], ["false", "Off"]], c.potato)}<p class="note">On: a buyer who doesn't know the answer can pass the lot to a team that wants it, up to ${BW_POTATOES} times per team per game. The buyer pays 25% of the price. The team that takes it gets 50% of the price if right and loses 25% if wrong.</p></div>
    <div class="bwpanel" title="Two lots per game hide their title. A right answer on a mystery lot pays double the bid; a wrong one still loses just the bid."><div class="bweye">Mystery lots</div>${seg("mystery", [["true", "On"], ["false", "Off"]], c.mystery)}<p class="note">On: two lots per game hide even their title. A right answer on a mystery lot pays double the bid; a wrong one still loses just the bid.</p></div>
    <div class="bwpanel" title="No open raising: every team sends one secret bid from its phone. Highest bid buys the lot at its own price. Needs Phone bidding on."><div class="bweye">Sealed bids</div>${seg("sealed", [["true", "On"], ["false", "Off"]], c.sealed)}<p class="note">${RELAY === true || RELAY === null ? `On (needs Phone bidding on): instead of raising out loud, every team sends one secret bid from its phone within the time set below. The highest bid buys the lot and pays its own bid; a tie goes to whoever sent it first. All bids show when it's sold.` : "Needs the Cloudflare link, like phone bidding."}${c.sealed && !c.phones ? " <b>Turn Phone bidding on too, or sealed bids are skipped.</b>" : ""}</p></div>
    ${c.sealed ? `<div class="bwpanel" title="How long teams have to send their sealed bids once the host opens them."><div class="bweye">Sealed bid time</div>${seg("ssecs", BW_SEALED_OPTS.map(n => [n, n + " s"]), bwSealedSecs())}<p class="note">The host can also tap Reveal now to close the bids early.</p></div>` : ""}
    <div class="bwpanel"><div class="bweye">Photo rounds</div>${seg("photos", [["true", "On"], ["false", "Off"]], c.photos)}<p class="note">Off leaves out Guess the Face, Guess the Picture, Egypt: Photo Edition and every clue that shows a photo.</p></div>
    <div class="bwpanel"><div class="bweye">Titles in the auction</div><div class="bwtitles">${BW_TITLES.map(t => { const off = t[3] === "photo" && !c.photos;
      return `<button data-title="${t[0]}" aria-pressed="${bwTitleOn(t) && !off}" ${off ? "disabled" : ""}><b>${esc(t[1])}</b><small>${esc(t[2].filter(id => catById(id)).map(id => catById(id).name).join(", "))}</small></button>`; }).join("")}</div></div>
    <div class="row"><button class="bwbtn ghost" id="bwBack">Back to title</button><button class="bwbtn go" id="bwStart">Start the auction</button></div>`;
}
$("#bidSetup").addEventListener("click", e => {
  const c = BW.cfg, set = e.target.closest("[data-set]");
  if(set){ const k = set.dataset.set; let v = set.dataset.v; if(k === "lots" || k === "secs" || k === "ssecs") v = +v; if(k === "photos" || k === "raises" || k === "phones" || k === "potato" || k === "mystery" || k === "sealed") v = v === "true"; c[k] = v; bwSave(); renderBidSetup(); return; }
  const tt = e.target.closest("[data-title]"); if(tt){ const t = BW_TITLES.find(x => x[0] === tt.dataset.title); c.titles[t[0]] = !bwTitleOn(t);
    if(!BW_TITLES.some(x => bwTitleOn(x) && bwCats(x).length)) c.titles[t[0]] = true; bwSave(); renderBidSetup(); return; }
  const rm = e.target.closest("[data-rm]"); if(rm){ c.teams.splice(+rm.dataset.rm, 1); bwSave(); renderBidSetup(); return; }
  if(e.target.closest("#bwAddTeam")){ c.teams.push("Team " + "ABCDEF"[c.teams.length]); bwSave(); renderBidSetup(); return; }
  if(e.target.closest("#bwBack")){ showHome(); return; }
  if(e.target.closest("#bwStart")){ c.teams = c.teams.map((n, i) => n.trim() || "Team " + "ABCDEF"[i]); bwSave(); BW.st = bwInit(); BW.phones = !!c.phones && RELAY === true; bwPersist(); Snd.unlock(); if(BW.phones) bwLobby(false); else bidShow(); }
});
$("#bidSetup").addEventListener("input", e => { const i = e.target.dataset && e.target.dataset.bn;
  if(i !== undefined){ BW.cfg.teams[+i] = e.target.value; bwSave(); return; }
  if(e.target.id === "bwSecs"){ BW.cfg.secs = +e.target.value; $("#bwSecsOut").textContent = BW.cfg.secs + " seconds"; bwSave(); } });
$("#modeBid").onclick = bidSetupShow;

/* ---------- the auction ---------- */
const bwLotNow = () => BW.st && BW.st.lots[BW.st.i];
const bwTitle = id => BW_TITLES.find(t => t[0] === id);
function bwStop(){ clearInterval(BW.timer); BW.timer = null; }
function bwCountText(){ const s = BW.cfg.secs; if(!BW.timer) return ""; return BW.left > s*2/3 ? `Bidding open · ${BW.left}s` : BW.left > s/3 ? `Going once… ${BW.left}s` : `Going twice… ${BW.left}s`; }
function bwCount(){ bwStop(); if(!BW.cfg.secs) return; BW.left = BW.cfg.secs; const el = () => $("#bwCount");
  BW.timer = setInterval(() => { BW.left--; if(BW.left <= 0){ bwStop(); bwSold(); return; } if(BW.left <= 3) Snd.tick(); const e = el(); if(e) e.textContent = bwCountText(); }, 1000); }
function renderBid(){
  const st = BW.st, root = $("#bidBody"); if(!st) return;
  if(st.over){ root.innerHTML = ""; bwSync(); return; }
  const lot = bwLotNow(), tier = BW_TIERS[lot.tier], t = bwTitle(lot.title);
  const cats = bwCats(t).map(id => catById(id).name), sl = bwSealed() ? bwSealState() : null;
  const lead = Math.max(...st.teams.map(m => m.score));
  const ticker = st.teams.map(m => `${esc(m.name.toUpperCase())} ${m.score >= 0 ? "▲" : "▼"} ${bwMoney(m.score)}`).join("  ·  ") + `  ·  LOT ${st.i + 1} OF ${st.lots.length}  ·  ${esc(bwName(lot).toUpperCase())}  ·  ${tier.k.toUpperCase()} $${tier.lv[0]}–$${tier.lv[1]}  ·  MAX BID ${bwMoney(tier.cap)}  ·  `;
  root.innerHTML = `
    <div class="bwtop"><div class="bwbrand">Bidding Wars</div><div class="bwscores" aria-label="Scores">${st.teams.map(m => `<span class="${m.score === lead && lead !== 0 ? "top" : ""}"><b>${esc(m.name)}</b><i class="${m.score < 0 ? "neg" : ""}">${bwMoney(m.score)}</i></span>`).join("")}</div><div class="bwlotno">Lot ${st.i + 1} of ${st.lots.length}</div></div>
    <div class="bwmid">
      <div class="bwlot">
        <span class="bwtier">${tier.k} · $${tier.lv[0]}–$${tier.lv[1]}</span>
        <div class="bwtitle">${esc(bwName(lot))}</div>
        ${lot.mystery ? `<div class="bwinc"><b>Pays double</b>The title and categories stay hidden until it's sold. A right answer pays 2× the bid.</div>` : `<div class="bwinc"><b>Includes</b>${esc(cats.join(", "))}</div>`}
      </div>
      <div class="bwbidbox">
        <div class="bwlab">${sl ? (sl.open ? "Sealed bids in" : "Sealed bids") : st.bid ? "Current bid" : "Opening bid"}</div>
        <div class="bwbid" id="bwBid">${sl ? (sl.open ? `${Object.keys(sl.bids).length}/${st.teams.length}` : "Secret") : bwMoney(st.bid || tier.lv[0])}</div>
        <div class="bwleader">${sl ? (sl.open ? st.teams.filter((m, i) => sl.bids[i]).map(m => esc(m.name) + " ✓").join("  ") || "Waiting for phones" : `Opens at ${bwMoney(tier.lv[0])} · max ${bwMoney(tier.cap)}`) : st.leader < 0 ? "No bids yet" : esc(st.teams[st.leader].name) + " leads"}</div>
        <div class="bwcap"><div class="bwcapbar"><i style="width:${st.bid ? (st.bid - tier.lv[0]) / (tier.cap - tier.lv[0]) * 100 : 0}%"></i></div><div class="bwcaplab"><span>$${tier.lv[0]}</span><span>Max ${bwMoney(tier.cap)}</span></div></div>
        <div class="bwcount" id="bwCount" aria-live="polite">${sl ? (sl.open ? `Sealed bids · ${BW.left}s` : `Tap Open sealed bids when the phones are ready`) : BW.timer ? bwCountText() : st.bid ? (BW.cfg.secs ? "" : "Tap SOLD when bidding stops") : "Any team can open"}</div>
      </div>
    </div>
    <div class="bwbottom">
      <div class="bwteamsrow" style="--n:${st.teams.length}">${st.teams.map((m, i) => { const next = bwNext(i), can = i !== st.leader && next > 0, r = bwRaise(i);
        return `<div class="bwt${i === st.leader ? " lead" : ""}${m.score === lead && lead !== 0 ? " top" : ""}"><div class="bwtn"><span>${esc(m.name)}</span><span class="bwts${m.score < 0 ? " neg" : ""}">${bwMoney(m.score)}</span></div>
          ${BW.cfg.raises && !sl ? `<div class="bwraise" role="group" aria-label="${esc(m.name)} raises by">${BW_RAISES.map(v => `<button data-raise="${i}" data-v="${v}" class="${v === r ? "on" : ""}" aria-pressed="${v === r}">+${v}</button>`).join("")}</div>` : ""}
          ${sl ? `<button disabled>${sl.bids[i] ? "Bid is in ✓" : sl.open ? "Waiting…" : "Sealed"}</button>` : `<button data-bid="${i}" ${can ? "" : "disabled"}>${i === st.leader ? "Leading" : !next ? "At max" : "Bid " + bwMoney(next)}</button>`}</div>`; }).join("")}</div>
      <div class="bwhost">${sl ? (sl.open ? `<button class="sold" data-bw="sreveal">Reveal now</button>` : `<button class="sold" data-bw="sopen">Open sealed bids</button>`) : `<button class="sold" data-bw="sold" ${st.leader < 0 ? "disabled" : ""}>SOLD</button>`}<button data-bw="unsold" ${st.leader < 0 && !(sl && sl.open) ? "" : "disabled"}>Unsold</button></div>
    </div>
    <div class="bwticker" aria-hidden="true"><span>${ticker}${ticker}</span></div>
    <div class="bwsoldv" id="bwSoldV" hidden></div>`;
  if(st.phase !== "lot") bwShowSold(true);
  const pb = $("#bwPhones"); if(pb) pb.hidden = !BW.phones;
  bwSync();
}
/* 6.52: each team picks how much its next bid raises by (+$50/$100/$200, kept for the whole game); a raise past the max stops at the max. The first bid still opens at the range minimum */
function bwRaise(i){ if(!BW.cfg.raises) return BW_STEP; const r = BW.st.teams[i].raise; return BW_RAISES.includes(r) ? r : BW_STEP; }
function bwNext(i){ const st = BW.st, tier = BW_TIERS[bwLotNow().tier]; if(!st.bid) return tier.lv[0]; return st.bid >= tier.cap ? 0 : Math.min(st.bid + bwRaise(i), tier.cap); }
function bwPlace(i){ const st = BW.st, lot = bwLotNow(), tier = BW_TIERS[lot.tier]; if(st.phase !== "lot" || i === st.leader) return;
  const next = bwNext(i); if(!next) return;
  st.bid = next; st.leader = i; Snd.unlock(); Snd.blip(); bwCount(); renderBid(); const b = $("#bwBid"); if(b){ b.classList.add("pop"); setTimeout(() => b.classList.remove("pop"), 160); }
  if(next === tier.cap) setTimeout(() => { if(BW.st === st && st.phase === "lot" && st.bid === tier.cap) bwSold(); }, 900); }   // nobody can go higher
function bwSold(){ const st = BW.st, lot = bwLotNow(); bwStop(); if(st.phase !== "lot" || st.leader < 0) return;
  st.phase = "sold"; lot.buyer = st.leader; lot.price = st.bid; bwPersist(); Snd.chime(); bwShowSold(false); bwSync(); }
function bwShowSold(again){ const st = BW.st, lot = bwLotNow(), v = $("#bwSoldV"); if(!v || !lot || lot.buyer == null) return;
  v.innerHTML = `<h2>SOLD!</h2><div class="who">to ${esc(st.teams[lot.buyer].name)} for ${bwMoney(lot.price)}</div>
    ${lot.sealedBids ? `<p class="note">Sealed bids: ${lot.sealedBids.map(b => `${esc(b.name)} ${bwMoney(b.amt)}`).join(" · ")}</p>` : ""}<div class="real"${again ? ' style="opacity:1;animation:none"' : ""}><small>The category${lot.mystery ? " · mystery lot, right pays double" : ""}</small>${esc(catById(lot.cat).name)} · $${lot.lvl}</div>${again ? `<p class="note">No result was saved.</p>` : ""}<button class="bwbtn go" data-bw="open"${again ? ' style="opacity:1;animation:none"' : ""}>${again ? "Open the clue again" : "Open the clue"}</button>`; v.hidden = false; }
function bwUnsold(){ const st = BW.st, lot = bwLotNow(); bwStop(); if(st.phase !== "lot" || st.leader >= 0) return;
  /* an unsold lot doesn't count: it's swapped for a fresh one of the same tier (up to 5 times a game), otherwise the game just moves on */
  const fresh = st.extra < 5 ? bwLot(lot.tier, lot.title, new Set(st.lots.map(l => l.title))) : null;
  st.sealed = null;
  if(fresh){ fresh.mystery = lot.mystery; st.lots[st.i] = fresh; st.extra++; } else { lot.res = "unsold"; st.i++; }
  st.bid = 0; st.leader = -1; bwPersist(); if(st.i >= st.lots.length) return bwEnd();
  bwSync(); const v = $("#bwSoldV"); v.innerHTML = `<h2 class="uns">Unsold</h2><div class="who">Nobody opened. ${fresh ? "Here's a different lot." : "On to the next one."}</div><button class="bwbtn go" data-bw="next">Next lot</button>`; v.hidden = false; }
function bwOpen(){ const st = BW.st, lot = bwLotNow(); st.phase = "clue"; bwPersist(); bwSync();
  S.turn = bwWho(lot); PICKS[`${lot.cat}-${lot.lvl}`] = lot.idx; openClue(lot.cat, lot.lvl); }
$("#bidBody").addEventListener("click", e => {
  const r = e.target.closest("[data-raise]"); if(r){ if(BW.st.phase === "lot"){ BW.st.teams[+r.dataset.raise].raise = +r.dataset.v; bwPersist(); renderBid(); } return; }
  const b = e.target.closest("[data-bid]"); if(b){ bwPlace(+b.dataset.bid); return; }
  const a = e.target.closest("[data-bw]"); if(!a) return; const k = a.dataset.bw;
  if(k === "sold") bwSold(); else if(k === "sopen") bwSealedOpen(); else if(k === "sreveal") bwSealedReveal(); else if(k === "unsold") bwUnsold(); else if(k === "open") bwOpen(); else if(k === "next") renderBid();
});
$("#bwHome").onclick = () => { const st = BW.st; if(st && !st.over && (st.i > 0 || st.leader >= 0)) askConfirm("Leave this game?", "Going to the title screen ends this Bidding Wars game. It can't be resumed.", "Go to title", () => { bwStop(); showHome(); }, true); else { bwStop(); showHome(); } };   // 6.50: confirm, since there's no Resume Bidding any more

/* ---------- the clue card (called from renderClue and the Done button in app.js) ---------- */
function bidBanner(c){ const st = BW.st, lot = bwLotNow(); if(!st || !lot || lot.buyer == null) return "";
  if(lot.potato) return `<p class="note bwbanner">${esc(st.teams[lot.buyer].name)} bought this for ${bwMoney(lot.price)} and passed the Hot Potato (paid ${bwMoney(lot.potato.fee)}). ${esc(st.teams[lot.potato.to].name)} answers: right +${bwMoney(lot.potato.win)}, wrong −${bwMoney(lot.potato.lose)}.</p>`;
  return `<p class="note bwbanner">${esc(st.teams[lot.buyer].name)} bought this for ${bwMoney(lot.price)}. Only they answer.${lot.mystery ? " Mystery lot: right pays double." : ""}</p>`; }
function bidAwards(c){ const st = BW.st, lot = bwLotNow(); if(!lot || lot.buyer == null) return ""; const i = bwWho(lot), p = lot.price, pt = lot.potato, m = lot.mystery ? 2 : 1;
  const right = pt ? pt.win : p * m, wrong = pt ? pt.lose : p, half = pt ? bwQ(pt.win / 2) : Math.round(p / 2) * m;
  return `<div class="award"><div class="grp"><span>${esc(st.teams[i].name)}</span><button class="y${c.awards[i] === 1 ? " on" : ""}" data-aw="${i}" data-v="1">Right +${bwMoney(right)}</button>${BW_HALF.has(c.cat) ? `<button class="h${c.awards[i] === 0.5 ? " on" : ""}" data-aw="${i}" data-v="0.5">Half +${bwMoney(half)}</button>` : ""}<button class="n${c.awards[i] === -1 ? " on" : ""}" data-aw="${i}" data-v="-1">Wrong −${bwMoney(wrong).slice(1)}</button></div></div>`; }
/* 7.67: Hot Potato. Before the answer is revealed, the buyer can pass the lot to another team. The buyer pays 25% of the price now; the taker plays for 50% (right) or −25% (wrong). */
function bidPotatoBtn(c){ const st = BW.st, lot = bwLotNow(); if(!BW.cfg.potato || c.preview || c.revealed || !st || !lot || lot.buyer == null || lot.potato || st.teams.length < 2) return "";
  const left = BW_POTATOES - (st.teams[lot.buyer].hp || 0); if(left <= 0) return `<button class="btn small" disabled title="${esc(st.teams[lot.buyer].name)} has used both Hot Potatoes">Hot Potato (none left)</button>`;
  if(!c.potatoOpen) return `<button class="btn small" data-act="potato" title="Pass this lot to a team that wants to answer it. ${esc(st.teams[lot.buyer].name)} pays ${bwMoney(bwQ(lot.price * 0.25))}.">Hot Potato (${left} left)</button>`;
  return `<span class="note">Pass to (costs ${bwMoney(bwQ(lot.price * 0.25))}):</span>${st.teams.map((m, i) => i === lot.buyer ? "" : `<button class="btn small" data-act="potatoto" data-t="${i}">${esc(m.name)}</button>`).join("")}<button class="btn small" data-act="potatono">Never mind</button>`; }
function bidPotato(c, a, b){ const st = BW.st, lot = bwLotNow(); if(!st || !lot || lot.buyer == null || lot.potato) return;
  if(a === "potato") c.potatoOpen = true; else if(a === "potatono") c.potatoOpen = false;
  else if(a === "potatoto"){ const to = +b.dataset.t, from = st.teams[lot.buyer]; if(!st.teams[to] || to === lot.buyer || (from.hp || 0) >= BW_POTATOES) return;
    const fee = bwQ(lot.price * 0.25); from.hp = (from.hp || 0) + 1; from.score -= fee;
    lot.potato = {to, fee, win:bwQ(lot.price * 0.5), lose:fee}; c.potatoOpen = false; c.awards = {}; c.turn = to; S.turn = to; Snd.blip(); }
  renderClue(); }
function bidDone(c){
  const st = BW.st, lot = bwLotNow(), who = lot ? bwWho(lot) : -1, v = c.awards[who];
  S.used.add(`${c.cat}-${c.lvl}-${c.idx}`); store.set("jn_used", [...S.used]); histNote();
  closeCard(); if(!lot) return;
  if(v === undefined){ st.phase = "sold"; bwPersist(); bidShow(); return; }   // closed with no result: back to the SOLD card to open it again
  const pt = lot.potato, m = lot.mystery ? 2 : 1;
  const pts = pt ? (v === 1 ? pt.win : v === 0.5 ? bwQ(pt.win / 2) : -pt.lose) : v === 0.5 ? Math.round(lot.price / 2) * m : v > 0 ? lot.price * m : -lot.price;
  st.teams[who].score += pts; lot.res = v; st.i++; st.bid = 0; st.leader = -1; st.phase = "lot"; st.sealed = null; bwPersist();
  if(st.i >= st.lots.length){ bwEnd(); return; }
  bidShow();
}
function bwEnd(){ const st = BW.st; st.over = true; bwStop(); bwPersist(); bidShow();
  const ranked = st.teams.map((t, i) => ({...t, i})).sort((a, b) => b.score - a.score), max = ranked[0].score, top = ranked.filter(t => t.score === max);
  const rankOf = t => 1 + ranked.filter(x => x.score > t.score).length;
  $("#winEyebrow").textContent = "Bidding Wars"; winTheme("bidding");
  $("#winTitle").innerHTML = top.length > 1 ? `It's a tie!<br><span>${esc(top.map(t => t.name).join(" & "))}</span>` : `${esc(top[0].name)}<br><span>win!</span>`;
  $("#podium").innerHTML = ranked.slice(0, 3).map(t => { const r = rankOf(t); return `<div class="pod p${Math.min(r, 3)}"><div class="who">${esc(t.name)}</div><div class="pts">${bwMoney(t.score)}</div><div class="step">${r}${["th","st","nd","rd"][(r % 100 > 10 && r % 100 < 14) || r % 10 > 3 ? 0 : r % 10]}</div></div>`; }).join("");
  $("#podium").hidden = false;
  $("#standings").innerHTML = ranked.length > 3 ? ranked.slice(3).map(t => `<li><span>${rankOf(t)}. ${esc(t.name)}</span><b class="${t.score < 0 ? "neg" : ""}">${bwMoney(t.score)}</b></li>`).join("") : "";
  $("#winBoard").hidden = true; $("#winBox").hidden = false; $("#playAgain").textContent = "New auction"; $("#winNote").textContent = "New auction keeps the same teams and settings, resets the scores and deals fresh lots."; $("#playAgain").focus();
  confetti(); ledStart(); playWinSiu(); }
function bidAgain(){ hideWinner(); $("#playAgain").textContent = "Play again"; BW.st = bwInit(); bwPersist(); bidShow(); }
function bidSetupAgain(){ hideWinner(); $("#playAgain").textContent = "Play again"; bidSetupShow(); }


/* ---------- 6.77 (Omar): phone bidding ----------
   With "Phone bidding" on in setup, Start shows a join code first. Each team's phone (play.html, the same page Free-for-all and team games use) picks its team and then
   shows the lot, the current bid and the leader, with a button per raise amount. A tap goes to the relay (POST /api/bid); the laptop reads the bids once a second
   (bwPoll) and applies the first valid one (the phone must have seen the current bid, and the team can't already lead), then the usual bwPlace runs, so the sold timer,
   the max and the sounds all behave as if the host had tapped the bid button. The TV's bid buttons still work. Answering stays on the TV.
   To remove: delete this block, the "Phone bidding" panel and the phones lines above (search "phones"), #bwLobby and #bwPhones in head.html, the "bid" parts of
   worker/index.js and play.html (search "bid"). */
const bwLive = () => BW.phones && RELAY === true && !!S.room;
let bwLastSync = "";
function bwSync(){ if(!bwLive() || !BW.st) return; const st = BW.st, s = {}; st.teams.forEach((m, i) => { s["t" + i] = m.score; });
  let cur;
  if(st.over) cur = {c: `bw${BW.gid}_end`, kind: "bid", bw: 1, ph: "over"};
  else { const lot = bwLotNow(), tier = BW_TIERS[lot.tier];
    cur = {c: `bw${BW.gid}_${st.i}`, kind: "bid", bw: 1, ph: st.phase, cat: bwName(lot), val: tier.k, ss: bwSealedSecs(), sl: st.sealedOn ? (st.sealed && st.sealed.open ? 1 : 2) : 0, bd: st.teams.map((m, i) => st.sealed && st.sealed.bids[i] ? 1 : 0), bid: st.bid, lo: tier.lv[0], cap: tier.cap, lead: st.leader, ln: st.leader >= 0 ? st.teams[st.leader].name : "",
      rs: BW.cfg.raises ? BW_RAISES : [BW_STEP], rk: st.teams.map(m => BW_RAISES.includes(m.raise) ? m.raise : BW_STEP), buyer: lot.buyer, bn: lot.buyer != null ? st.teams[lot.buyer].name : "", price: lot.price, no: st.i + 1, of: st.lots.length}; }
  const k = JSON.stringify([cur, s]); if(k === bwLastSync) return; bwLastSync = k;
  ffaPost({cur, s, mode: "teams", teams: st.teams.map(m => m.name)}); }
function bwLobby(mid){ bwStop(); bwHideAll(); bwLastSync = ""; if(!S.room) S.room = newRoom(); const st = BW.st, names = st.teams.map(m => m.name);
  ffaPost(mid ? {mode: "teams", teams: names} : {mode: "teams", teams: names, cur: {c: `bwlobby${BW.gid}`, kind: "bid", bw: 1, ph: "wait"}, s: {}});
  $("#bwLobby").hidden = false; $("#bwLGo").textContent = mid ? "Back to the auction" : "Start the auction"; $("#bwLBack").hidden = !!mid; $("#bwLSkip").hidden = !!mid;
  const q = $("#bwLqr"); q.innerHTML = "";
  const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(!$("#bwLobby").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
    q.innerHTML = ""; try{ new QRCode(q, {text: ffaUrl(), width: 300, height: 300, correctLevel: QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } };
  draw(); bwLobbyList(); bwLobbyPoll(); window.scrollTo(0, 0); }
function bwLobbyList(){ const st = BW.st; if(!st) return;
  $("#bwLobbyList").innerHTML = st.teams.map((m, i) => { const n = BW.cnt[i] || 0; return `<li class="${n ? "" : "none"}">${esc(m.name)} · ${n ? `${n} phone${n > 1 ? "s" : ""}` : "no phone yet"}</li>`; }).join(""); }
async function bwLobbyPoll(){ if(!bwLive() || $("#bwLobby").hidden) return;
  try{ const j = await (await fetch(`api/players?r=${encodeURIComponent(S.room)}`, {cache: "no-store"})).json(), k = {};
    (j.players || []).forEach(pl => { if(pl.t != null) k[pl.t] = (k[pl.t] || 0) + 1; }); BW.cnt = k; bwLobbyList(); }catch(e){}
  setTimeout(bwLobbyPoll, 2000); }
function bwLobbyGo(){ $("#bwLobby").hidden = true; bidShow(); const st = BW.st; if(st && st.phase === "lot" && st.leader >= 0) bwCount(); }
$("#bwLGo").onclick = bwLobbyGo;
$("#bwLSkip").onclick = () => { BW.phones = false; bwLobbyGo(); };
$("#bwLBack").onclick = () => { $("#bwLobby").hidden = true; ffaPost({cur: null, s: {}}); BW.phones = false; bidSetupShow(); };
$("#bwPhones").onclick = () => bwLobby(true);
async function bwPoll(force){ const st = BW.st; if(BW.busy || !bwLive() || !st || st.over || st.phase !== "lot" || $("#bidding").hidden) return;
  const sl = st.sealedOn ? bwSealState() : null; if(sl && !sl.open && !(force && sl.closing)) return;   // 7.67: sealed bids are only read while the box is open
  BW.busy = true;
  const c = `bw${BW.gid}_${st.i}`; if(BW.seen.c !== c) BW.seen = {c, n: 0};
  try{ const j = await (await fetch(`api/bids?r=${encodeURIComponent(S.room)}&c=${c}&since=${BW.seen.n}`, {cache: "no-store"})).json();
    if(BW.st === st && BW.seen.c === c && Array.isArray(j.bids)){ BW.seen.n = j.n;
      if(sl){ const tier = BW_TIERS[bwLotNow().tier];
        for(const x of j.bids){ const amt = Math.round(x.b / BW_STEP) * BW_STEP; if(!st.teams[x.t] || !(amt >= tier.lv[0] && amt <= tier.cap)) continue;
          const old = sl.bids[x.t]; sl.seq++; sl.bids[x.t] = {amt, seq: old && old.amt === amt ? old.seq : sl.seq}; }
        const n = Object.keys(sl.bids).length; if(!sl.closing && n !== sl.shown){ sl.shown = n; renderBid(); }
        BW.busy = false; return; }
      for(const x of j.bids){ if(st.phase !== "lot" || BW.st !== st) break; if(x.b !== st.bid || x.t === st.leader || !st.teams[x.t]) continue;
        if(BW.cfg.raises && BW_RAISES.includes(x.r)) st.teams[x.t].raise = x.r; bwPlace(x.t); } } }catch(e){}
  BW.busy = false; }
setInterval(bwPoll, 1000);


/* ---------- 7.67 (Omar): sealed bids ----------
   With "Sealed bids" and "Phone bidding" both on, a lot has no open auction. The host taps Open sealed bids; for 10 seconds every team's phone can send one secret bid
   (a multiple of $50 from the opening bid to the max; a later send replaces the earlier one). Phones use the same /api/bid route as phone bidding: r2 is 50 and b is the amount.
   When time is up (or the host taps Reveal now) the highest bid buys the lot at its own price, a tie goes to the first to send it, and the sold card lists every bid.
   To remove: delete this block, the sealed parts of renderBid, bwPoll, bwSync, bidDone and bwUnsold (search "sealed"), the Sealed bids panel, and the sealed screen in play.html. */
const bwSealed = () => !!(BW.st && BW.st.sealedOn && bwLive() && !BW.st.over && BW.st.phase === "lot");
function bwSealState(){ const st = BW.st; if(!st.sealed) st.sealed = {open:false, bids:{}, seq:0}; return st.sealed; }
function bwSealedOpen(){ if(!bwSealed()) return; const sl = bwSealState(); if(sl.open) return; sl.open = true; bwStop(); BW.left = bwSealedSecs(); Snd.unlock(); Snd.blip();
  const st = BW.st; BW.timer = setInterval(() => { BW.left--; if(BW.left <= 0){ bwStop(); bwSealedReveal(); return; } if(BW.left <= 3) Snd.tick(); const e = $("#bwCount"); if(e) e.textContent = `Sealed bids · ${BW.left}s`; }, 1000);
  renderBid(); }
async function bwSealedReveal(){ const st = BW.st; if(!bwSealed()) return; const sl = bwSealState(); if(!sl.open) return; bwStop(); sl.open = false; sl.closing = true;
  try{ await bwPoll(true); await new Promise(r => setTimeout(r, 500)); await bwPoll(true); }catch(e){}   // one last look for bids still on the way
  if(BW.st !== st || st.phase !== "lot") return; sl.closing = false;
  const entries = Object.entries(sl.bids).map(([t, x]) => ({t:+t, amt:x.amt, seq:x.seq})).sort((a, b) => b.amt - a.amt || a.seq - b.seq);
  if(!entries.length){ st.sealed = null; bwUnsold(); return; }
  const lot = bwLotNow(), w = entries[0]; st.leader = w.t; st.bid = w.amt; lot.sealedBids = entries.map(x => ({name:st.teams[x.t].name, amt:x.amt}));
  st.sealed = null; bwSold(); }
