// 7.23: plays Fake Artist games in a headless browser against a small in-memory copy of the relay (worker/index.js): one TV page and N phone pages (draw.html) that join, look at their card, draw lines
// with the mouse, vote and guess.
//   NODE_PATH=$(npm root -g) node v4work/tools/fakeartist-e2e.js [shotsDir] [players=5]
// It needs a built index.html (node build.js). Checks: the real word is never in the posted table before the reveal and never in the fake's own card, a line from the wrong player is refused, every drawn line reaches the
// TV canvas, a caught fake gets a guess box, an escape scores 3, the second vote only happens after 4 rounds, a winner screen appears and Play again returns to the lobby. Screenshots go to shotsDir (default ./_fa-shots).
const http = require("http"), fs = require("fs"), path = require("path"), {chromium} = require("playwright");
const root = path.resolve(__dirname, "../.."), shots = path.resolve(process.argv[2] || "_fa-shots"), N = +process.argv[3] || 5; fs.mkdirSync(shots, {recursive:true});
const R = {players:{}, crd:null, crdat:0, acts:[], room:null, leaks:0, posts:0, maxPub:0, maxAct:0};
const send = (res, o, code = 200) => { res.writeHead(code, {"content-type":"application/json"}); res.end(JSON.stringify(o)); };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"); let body = ""; req.on("data", d => body += d);
  req.on("end", () => {
    if(u.pathname.startsWith("/api/")){ const op = u.pathname.slice(5), b = body ? JSON.parse(body) : {}, q = u.searchParams;
      if(op === "ping") return send(res, {ok:true});
      if(op === "players"){ R.room = q.get("r"); return send(res, {players:Object.entries(R.players).map(([p, v]) => ({p, n:v.n, t:v.t, at:v.at})).sort((a, b) => a.at - b.at)}); }
      if(op === "join"){ R.players[b.p] = {n:b.n, t:b.t, at:R.players[b.p] ? R.players[b.p].at : Date.now()}; return send(res, {ok:true}); }
      if(op === "kick"){ delete R.players[b.p]; return send(res, {ok:true}); }
      if(op === "crd"){ R.crd = b.crd; R.crdat = Date.now(); R.posts++; const pub = b.crd.pub, s = JSON.stringify(pub); R.maxPub = Math.max(R.maxPub, s.length); R.word = R.word || null;
        if(R.word && pub.ph !== "reveal" && pub.ph !== "over" && s.toLowerCase().includes(R.word.toLowerCase())) R.leaks++;
        for(const [p, v] of Object.entries(b.crd.priv)){ if(v.card.f && R.word && v.card.w.toLowerCase() === R.word.toLowerCase()) R.leaks++; if(!pub.names[p]) R.leaks++; }
        return send(res, {ok:true}); }
      if(op === "crdstate"){ const me = R.players[q.get("p")]; if(!me) return send(res, {name:null}); if(!R.crd) return send(res, {name:me.n, pub:null, me:null}); return send(res, {name:me.n, pub:R.crd.pub, me:R.crd.priv[q.get("p")] || null, ago:Date.now() - R.crdat}); }
      if(op === "crdact"){ if(!R.players[b.p]) return send(res, {ok:false, error:"unknown"}, 409); if(!R.crd || R.crd.pub.v !== b.v) return send(res, {ok:false, error:"stale"}, 409);
        const sz = JSON.stringify(b.a).length; R.maxAct = Math.max(R.maxAct, sz); if(sz > (b.a.k === "stroke" ? 900 : 200)) return send(res, {ok:false, error:"bad move"}, 400); R.acts.push({p:b.p, v:b.v, a:b.a}); return send(res, {ok:true}); }
      if(op === "crdacts"){ const s = +q.get("since") || 0, e = Math.min(R.acts.length, s + 100); return send(res, {n:e, acts:R.acts.slice(s, e)}); }
      return send(res, {ok:false}, 404); }
    const f = u.pathname === "/" ? "index.html" : u.pathname.slice(1), file = path.join(root, f);
    if(!file.startsWith(root) || !fs.existsSync(file)){ res.writeHead(404); return res.end(); }
    res.writeHead(200, {"content-type":f.endsWith(".js") ? "text/javascript" : f.endsWith(".mp3") ? "audio/mpeg" : "text/html"}); res.end(fs.readFileSync(file)); }); });
process.on("unhandledRejection", e => { console.log("ERR", e.message.split("\n")[0], (e.stack.match(/fakeartist-e2e.js:\d+/) || [])[0]); process.exit(1); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = "http://localhost:" + srv.address().port, errs = [], fails = [];
  const b = await chromium.launch(), tv = await (await b.newContext({viewport:{width:+process.env.TVW || 1920, height:+process.env.TVH || 1080}})).newPage();
  const watch = (p, n) => { p.on("pageerror", e => errs.push(n + " " + e.message)); p.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push(n + " " + m.text()); }); };
  watch(tv, "TV"); await tv.addInitScript(() => { try{ localStorage.setItem("jn_faCfg", JSON.stringify({target:3, secs:10})); }catch(e){} });
  await tv.route(/^(?!http:\/\/localhost)/, r => r.abort());
  await tv.goto(base + "/index.html"); await tv.waitForTimeout(600); await tv.click("#modeFa"); await tv.waitForTimeout(400); await tv.screenshot({path:path.join(shots, "tv-title.png")});
  await tv.click("#modeGo"); await tv.waitForTimeout(1200); await tv.screenshot({path:path.join(shots, "tv-lobby-empty.png")});
  const names = ["Omar", "Nour", "Karim", "Salma", "Youssef", "Mariam", "Hana", "Tarek"].slice(0, N), phones = [];
  for(const n of names){
    const c = await b.newContext({viewport:{width:390, height:800}, isMobile:true, hasTouch:true}), p = await c.newPage(); watch(p, n);
    await p.route(/^(?!http:\/\/localhost)/, r => r.abort()); await p.goto(`${base}/draw.html?r=${R.room}`);
    if(!phones.length) await p.screenshot({path:path.join(shots, "phone-join.png")});
    await p.fill("#nm", n); await p.click("#jb"); await p.waitForTimeout(250); p.nm = n; phones.push(p); }
  await tv.waitForTimeout(1800); await tv.screenshot({path:path.join(shots, "tv-lobby.png")}); await phones[0].screenshot({path:path.join(shots, "phone-lobby.png")});
  await tv.click("#faGo"); await tv.waitForTimeout(1200);
  const pOf = n => Object.keys(R.players).find(k => R.players[k].n === n), phone = p => phones.find(x => pOf(x.nm) === p);
  const snap = async (name, ph) => { await tv.screenshot({path:path.join(shots, "tv-" + name + ".png")}); if(ph) await ph.screenshot({path:path.join(shots, "phone-" + name + ".png")}); };
  const draw = async (p, k) => { const box = await p.locator("#pad canvas").boundingBox(), at = (x, y) => [box.x + x * box.width, box.y + y * box.height];
    const w = [[.2 + k * .05, .3], [.4, .2 + k * .04], [.6, .5], [.5 + k * .03, .75]]; await p.mouse.move(...at(...w[0])); await p.mouse.down(); for(const q of w.slice(1)){ await p.mouse.move(...at(...q), {steps:6}); } await p.mouse.up(); };
  let games = 0, over = false, strokesSeen = 0;
  for(let game = 0; game < 8 && !over; game++){
    await tv.waitForSelector('[data-act="start"]', {timeout:5000}); const pub0 = R.crd.pub, priv = R.crd.priv; games++;
    const fakeId = Object.keys(priv).find(p => priv[p].card.f), realId = Object.keys(priv).find(p => !priv[p].card.f); R.word = priv[realId].card.w;
    if(priv[fakeId].card.w === R.word) fails.push("the fake's card shows the real word");
    if(priv[fakeId].card.cat !== priv[realId].card.cat) fails.push("the fake didn't get the category");
    // everyone holds their card
    for(const p of phones){ const id = pOf(p.nm), box = await p.locator("#peek").boundingBox(); await p.mouse.move(box.x + 20, box.y + 10); await p.mouse.down(); await p.waitForTimeout(200);
      const txt = await p.locator("#view").innerText(); if(id === fakeId && !/fake artist/i.test(txt)) fails.push("the fake's card has no footer line"); if(id !== fakeId && !txt.toLowerCase().includes(R.word.toLowerCase())) fails.push("a real artist can't see the word");
      if(game === 0 && p === phones[0]) await p.screenshot({path:path.join(shots, "phone-card.png")}); await p.mouse.up(); await p.waitForTimeout(100); }
    await tv.waitForTimeout(900); if(game === 0) await tv.screenshot({path:path.join(shots, "tv-card.png")});
    if(!(await tv.locator(".faseen .fachip.now").count())) fails.push("the TV doesn't tick off players who looked");
    await tv.click('[data-act="start"]'); await tv.waitForTimeout(600);
    const catchHim = game % 2 === 0;   // game 1: caught and guesses wrong, game 2: escapes
    let votesDone = 0, turns = 0;
    for(let tick = 0; tick < 400 && votesDone < 2; tick++){
      const pub = R.crd.pub;
      if(pub.ph === "draw"){ const cur = pub.cur, d = phone(cur), other = phones.find(x => pOf(x.nm) !== cur);
        await d.waitForSelector("#pad.mine", {timeout:5000}).catch(() => fails.push("the drawer's canvas never woke up"));
        if(turns === 0 && game === 0){ await tv.screenshot({path:path.join(shots, "tv-first-turn.png")}); await d.screenshot({path:path.join(shots, "phone-your-turn.png")}); await other.screenshot({path:path.join(shots, "phone-watching.png")}); }
        // a line from the wrong player is refused by the laptop
        const wrongP = Object.keys(R.players).find(p => p !== cur); R.acts.push({p:wrongP, v:pub.v, a:{k:"stroke", t:pub.tid, pts:[10, 10, 400, 400]}});
        const n0 = R.crd.pub.strokes.length, v0 = pub.v; await draw(d, turns % 5); strokesSeen++; turns++;
        for(let k = 0; k < 30 && R.crd.pub.v === v0; k++) await tv.waitForTimeout(100);
        if(R.crd.pub.strokes.length !== n0 + 1) fails.push(`a line didn't land: ${n0} -> ${R.crd.pub.strokes.length}`);
        if(turns === 3 && game === 0){ await tv.waitForTimeout(2500); await tv.screenshot({path:path.join(shots, "tv-drawing.png")}); } continue; }
      if(pub.ph === "vote"){
        if(!await tv.locator("#faCv").count()) fails.push("no canvas on the TV during the vote");
        const lit = await tv.evaluate(() => { const c = document.getElementById("faCv"), x = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for(let i = 3; i < x.length; i += 4) if(x[i] > 0) n++; return n; });
        if(lit < 2000) fails.push("the TV canvas is empty at the vote (" + lit + " pixels)");
        if(votesDone === 0 && game === 0){ await tv.screenshot({path:path.join(shots, "tv-vote.png")}); await phones[0].screenshot({path:path.join(shots, "phone-vote.png")}); }
        for(const p of phones){ const id = pOf(p.nm), want = catchHim ? (id === fakeId ? realId : fakeId) : (id === fakeId ? realId : Object.keys(R.players).find(x => x !== id && x !== fakeId));
          await p.locator(`[data-o="${want}"]`).click(); await p.waitForTimeout(80); }
        await tv.waitForTimeout(600); const t0 = pub.tid; for(let k = 0; k < 120 && R.crd.pub.tid === t0; k++) await tv.waitForTimeout(100);   // the laptop ends the vote on its own a few seconds after the last vote
        votesDone++; if(R.crd.pub.ph === "between"){ await snap("between", phones[0]); await tv.click('[data-act="cont"]'); await tv.waitForTimeout(600); if(catchHim) fails.push("not caught although everyone voted for the fake"); }
        else if(R.crd.pub.ph === "guess"){ votesDone = 2; if(!catchHim) fails.push("caught although nobody voted for the fake"); }
        else if(R.crd.pub.ph === "reveal"){ votesDone = 2; }
        continue; }
      if(pub.ph === "reveal" || pub.ph === "over") break;
      await tv.waitForTimeout(150); }
    if(R.crd.pub.ph === "guess"){ await snap("guess", phone(fakeId)); await phone(fakeId).fill("#gw", "Sphinx"); await phone(fakeId).click("#gb"); await tv.waitForTimeout(1200); await snap("judge", phones[1]); await tv.click('[data-act="wrong"]'); await tv.waitForTimeout(800); }
    if(catchHim && R.crd.pub.strokes.length !== 2 * N) fails.push("a caught game should have " + 2 * N + " lines, has " + R.crd.pub.strokes.length);
    if(!catchHim && R.crd.pub.strokes.length !== 4 * N && R.crd.pub.ph === "reveal") fails.push("an escape game should have " + 4 * N + " lines, has " + R.crd.pub.strokes.length);
    await tv.waitForSelector('[data-act="next"],[data-act="winner"]', {timeout:5000}).catch(() => fails.push("no way on after the reveal"));
    const pub = R.crd.pub, before = JSON.stringify(pub.scores); await snap("reveal-" + (game + 1), phone(fakeId)); await tv.waitForTimeout(500);
    if(pub.ph !== "reveal"){ fails.push("expected the reveal, got " + pub.ph + " (game " + (game + 1) + ", lines " + (pub.strokes || []).length + ")"); await tv.screenshot({path:path.join(shots, "tv-stuck.png")}); break; }
    if(!catchHim && pub.deltas[fakeId] !== 3) fails.push("an escape should score the fake 3, got " + pub.deltas[fakeId]);
    if(catchHim && pub.deltas[realId] !== 2) fails.push("a catch with right votes should score 2, got " + pub.deltas[realId]);
    R.word = null;
    if(await tv.locator('[data-act="winner"]').count()){ await tv.click('[data-act="winner"]'); await tv.waitForTimeout(900); over = true; await snap("over", phones[0]); if(R.crd.pub.ph !== "over") fails.push("no winner screen"); }
    else await tv.click('[data-act="next"]'); await tv.waitForTimeout(900); }
  if(!over) fails.push("the night never reached a winner (" + games + " games)");
  else { await tv.click('[data-act="again"]'); await tv.waitForTimeout(800); if(!await tv.locator("#faGo").count()) fails.push("Play again did not return to the lobby"); }
  if(R.leaks) fails.push("the relay saw " + R.leaks + " word leak(s)");
  console.log("games:", games, "· lines drawn:", strokesSeen, "· posts:", R.posts, "· biggest table:", R.maxPub, "bytes · biggest move:", R.maxAct, "bytes"); if(R.maxPub > 38000) fails.push("table too big for the relay limit: " + R.maxPub);
  if(errs.length) console.log("PAGE ERRORS:\n" + [...new Set(errs)].join("\n")); if(fails.length) console.log("FAILS:\n" + [...new Set(fails)].join("\n")); else console.log("all checks passed");
  await b.close(); srv.close(); process.exit(fails.length || errs.length ? 1 : 0); })();
