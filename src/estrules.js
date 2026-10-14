/* 6.79 (Omar): Estimation's rules and scoring, with no screen code, so the same file can be tested from node (v4work/tools/est-sim.js plays bot games).
   Four players, 13 cards each, counter-clockwise (seat 0 bottom, 1 right, 2 top, 3 left). A round: optional Dash Calls, an auction for trumps (minimum 4 tricks, Sans > Spades >
   Hearts > Diamonds > Clubs), everyone estimates their tricks (the last one may not make the total 13: Risk), then 13 tricks are played. Speed rounds skip the auction (trump
   is fixed: Sans, Spades, Hearts, Diamonds, Clubs) and everybody estimates from 0 to 13. A bola is a game: Full = 13 bidding + 5 Speed rounds, Mini = 8 bidding + 5 Speed, Micro = 5 bidding.
   Scoring per player: a hit scores 10 + tricks (an estimate of 8+ scores its square), a miss loses the difference (8+: half the square, rounded); +/-10 more for the Caller and for a player
   who said "With" (the Caller's number); +10 for the only player who hit; Risk +/-10 (total 2 or 3 away from 13) or +/-20 (4 or more) for the last estimator; a Dash Call scores
   +25 (Over round) or +33 (Under round) for taking no trick and the same lost otherwise, and nothing else. Omar's 14 Oct changes: no penalty for an only loser, big calls squared,
   a miss costs half the square, Micro bola is 5 normal rounds. Everything the TV and phones show comes from pub() and priv(); a phone never gets another player's hand. */
const ER = (() => {
  const SR = {C:1, D:2, H:3, S:4, N:5}, SPEED_TRUMPS = ["N", "S", "H", "D", "C"], SYM = {S:"♠", H:"♥", D:"♦", C:"♣", N:"NT"};
  const beats = (b, h) => !h || b.n > h.n || (b.n === h.n && SR[b.s] > SR[h.s]);
  const plan = bola => { const bid = bola === "micro" ? 5 : bola === "mini" ? 8 : 13, speed = bola === "micro" ? 0 : 5, out = [];
    for(let i = 0; i < bid; i++) out.push({k:"bid"}); for(let i = 0; i < speed; i++) out.push({k:"speed", trump:SPEED_TRUMPS[i]}); return out; };
  const legal = (hand, led) => { if(!led) return hand.slice(); const f = hand.filter(c => CK.suit(c) === led); return f.length ? f : hand.slice(); };
  /* x = {ests, won, dash, caller, callerN, last}; returns one row per seat: {pts, hit, tags:[...]} */
  const score = x => { const total = x.ests.reduce((a, b) => a + b, 0), over = total > 13, rows = [], hits = [];
    for(let i = 0; i < 4; i++){ const e = x.ests[i], t = x.won[i];
      if(x.dash[i]){ const v = over ? 25 : 33, hit = t === 0; rows.push({pts:hit ? v : -v, hit, tags:["Dash Call"]}); continue; }
      const hit = e === t, tags = []; let pts = hit ? (e >= 8 ? e * e : 10 + e) : -(e >= 8 ? Math.round(e * e / 2) : Math.abs(e - t));
      if(x.caller === i){ tags.push("Caller"); pts += hit ? 10 : -10; } else if(x.caller != null && e === x.callerN){ tags.push("With"); pts += hit ? 10 : -10; }
      if(x.last === i){ const d = Math.abs(total - 13); if(d >= 4){ tags.push("Double risk"); pts += hit ? 20 : -20; } else if(d >= 2){ tags.push("Risk"); pts += hit ? 10 : -10; } }
      if(e >= 8) tags.push("Big call");
      rows.push({pts, hit, tags}); if(hit) hits.push(i); }
    if(hits.length === 1){ rows[hits[0]].pts += 10; rows[hits[0]].tags.push("Only winner"); }
    return {rows, total, over}; };

  function Game(cfg, names, pids){
    const g = {cfg, names, pids, plan:plan(cfg.bola), ri:0, scores:[0, 0, 0, 0], v:0, phase:"", dealer:Math.floor(Math.random() * 4), hands:[[], [], [], []], summary:null};
    const nx = i => (i + 1) % 4, bump = () => { g.v++; };
    g.round = () => g.plan[g.ri];
    g.deal = () => { const d = CK.shuffle(CK.deck()), r = g.round();
      g.hands = [0, 1, 2, 3].map(i => CK.sort(d.slice(i * 13, i * 13 + 13)));
      g.first = nx(g.dealer); g.dash = [false, false, false, false]; g.asked = 0; g.passed = [false, false, false, false]; g.lastBid = [null, null, null, null];
      g.high = null; g.caller = null; g.callerN = null; g.trump = null; g.ests = [null, null, null, null]; g.won = [0, 0, 0, 0]; g.trick = []; g.done = 0; g.winner = null; g.estOrder = []; g.estIdx = 0; g.summary = null;
      if(r.k === "speed"){ g.trump = r.trump === "N" ? null : r.trump; g.trumpL = r.trump; g.startEst(); }
      else if(g.cfg.dash){ g.phase = "dash"; g.turn = g.first; }
      else g.startAuction();
      bump(); };
    g.startAuction = () => { g.phase = "auction"; g.turn = g.first; while(g.dash[g.turn]) g.turn = nx(g.turn); };
    g.startEst = () => { const r = g.round(); g.phase = "est"; g.estOrder = [];
      if(r.k === "speed"){ for(let i = 0, s = g.first; i < 4; i++, s = nx(s)) g.estOrder.push(s); }
      else { for(let i = 1, s = nx(g.caller); i < 4; i++, s = nx(s)) if(!g.dash[s]) g.estOrder.push(s); g.ests[g.caller] = g.callerN; g.dash.forEach((d, i) => { if(d) g.ests[i] = 0; }); }
      g.estIdx = 0; g.turn = g.estOrder[0]; };
    g.last = () => g.estOrder[g.estOrder.length - 1];
    g.max = () => g.round().k === "speed" ? 13 : g.callerN;
    g.ban = () => { if(g.phase !== "est" || g.turn !== g.last()) return null; const sum = g.ests.reduce((a, b) => a + (b || 0), 0), b = 13 - sum; return b >= 0 && b <= g.max() ? b : null; };
    g.act = (seat, a) => {
      if(seat !== g.turn) return {ok:false, err:"turn"};
      if(g.phase === "dash"){
        if(a.k !== "dash") return {ok:false, err:"kind"};
        const yes = !!a.yes && g.dash.filter(Boolean).length < 2; g.dash[seat] = yes; g.asked++;
        if(g.asked >= 4 || g.dash.filter(Boolean).length >= 2) g.startAuction(); else g.turn = nx(g.turn);
        bump(); return {ok:true}; }
      if(g.phase === "auction"){
        if(a.k === "pass"){ g.passed[seat] = true; g.lastBid[seat] = {pass:1}; }
        else if(a.k === "bid"){ const b = {n:a.n, s:a.s};
          if(!Number.isInteger(b.n) || b.n < 4 || b.n > 13 || !SR[b.s] || !beats(b, g.high)) return {ok:false, err:"bid"};
          g.high = {n:b.n, s:b.s, seat}; g.lastBid[seat] = {n:b.n, s:b.s}; }
        else return {ok:false, err:"kind"};
        const rem = [0, 1, 2, 3].filter(i => !g.dash[i] && !g.passed[i]);
        if(g.high){ const others = rem.filter(i => i !== g.high.seat);
          if(!others.length){ g.caller = g.high.seat; g.callerN = g.high.n; g.trumpL = g.high.s; g.trump = g.high.s === "N" ? null : g.high.s; g.startEst(); }
          else { let s = nx(seat); while(!others.includes(s)) s = nx(s); g.turn = s; } }
        else if(!rem.length){ g.phase = "redeal"; g.turn = null; }
        else { let s = nx(seat); while(!rem.includes(s)) s = nx(s); g.turn = s; }
        bump(); return {ok:true}; }
      if(g.phase === "est"){
        if(a.k !== "est" || !Number.isInteger(a.n) || a.n < 0 || a.n > g.max()) return {ok:false, err:"est"};
        if(a.n === g.ban()) return {ok:false, err:"risk"};
        g.ests[seat] = a.n; g.estIdx++;
        if(g.estIdx >= g.estOrder.length){ g.phase = "play"; g.lead = g.caller != null ? g.caller : g.first; g.turn = g.lead; } else g.turn = g.estOrder[g.estIdx];
        bump(); return {ok:true}; }
      if(g.phase === "play"){
        if(a.k !== "play" || !g.hands[seat].includes(a.c)) return {ok:false, err:"card"};
        if(!legal(g.hands[seat], g.trick.length ? CK.suit(g.trick[0].c) : null).includes(a.c)) return {ok:false, err:"follow"};
        g.hands[seat] = g.hands[seat].filter(c => c !== a.c); g.trick.push({seat, c:a.c});
        if(g.trick.length === 4){ g.winner = g.trick[CK.trickWinner(g.trick, g.trump)].seat; g.won[g.winner]++; g.phase = "trickdone"; g.turn = null; }
        else g.turn = nx(seat);
        bump(); return {ok:true}; }
      return {ok:false, err:"phase"}; };
    g.advance = () => {
      if(g.phase === "redeal"){ g.deal(); return true; }
      if(g.phase === "trickdone"){ g.done++; g.trick = [];
        if(g.done === 13){ const s = score({ests:g.ests, won:g.won, dash:g.dash, caller:g.caller, callerN:g.callerN, last:g.last()});
          s.rows.forEach((r, i) => g.scores[i] += r.pts); g.summary = s; g.phase = "scored"; g.turn = null; }
        else { g.phase = "play"; g.lead = g.winner; g.turn = g.winner; g.winner = null; }
        bump(); return true; }
      if(g.phase === "scored"){ g.ri++; if(g.ri >= g.plan.length){ g.phase = "over"; g.turn = null; bump(); return true; } g.dealer = nx(g.dealer); g.deal(); return true; }
      return false; };
    g.start = () => { g.ri = 0; g.scores = [0, 0, 0, 0]; g.deal(); };
    return g;
  }
  const label = b => b ? (b.pass ? "Pass" : b.n + " " + SYM[b.s]) : "";
  const pub = g => { const r = g.round() || {k:"bid"}, sc = g.summary;
    return {v:g.v, g:"est", phase:g.phase, round:g.ri + 1, of:g.plan.length, rk:r.k, trump:g.trumpL || null, dealer:g.dealer, turn:g.turn, high:g.high, winner:g.winner,
      names:g.names, ests:g.ests, won:g.won, dash:g.dash, caller:g.caller, callerN:g.callerN, bids:g.lastBid.map(label), cards:g.hands.map(h => h.length),
      trick:g.trick.map(t => ({seat:t.seat, c:t.c})), scores:g.scores, total:g.ests.some(e => e == null) ? null : g.ests.reduce((a, b) => a + b, 0), last:g.phase === "est" || g.phase === "play" || g.phase === "trickdone" ? g.last() : null,
      rows:sc ? sc.rows : null, over:sc ? sc.over : null}; };
  const priv = (g, seat) => { const o = {seat, hand:g.hands[seat], act:null};
    if(g.turn === seat){
      if(g.phase === "dash") o.act = {k:"dash", can:g.dash.filter(Boolean).length < 2};
      else if(g.phase === "auction") o.act = {k:"bid", high:g.high};
      else if(g.phase === "est") o.act = {k:"est", max:g.max(), ban:g.ban()};
      else if(g.phase === "play") o.act = {k:"play", legal:legal(g.hands[seat], g.trick.length ? CK.suit(g.trick[0].c) : null)}; }
    return o; };
  return {SR, SYM, beats, plan, legal, score, Game, pub, priv, label};
})();
