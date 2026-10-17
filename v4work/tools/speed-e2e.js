// 7.47: plays Speed Trivia in a headless browser against a small in-memory copy of the relay (worker/index.js): one TV page and N phone pages (buzz.html) that join, buzz, answer, get locked out and time out.
//   NODE_PATH=$(npm root -g) node v4work/tools/speed-e2e.js [shotsDir] [players=3]
// It needs a built index.html (node build.js). Checks: the clue text and the answer never reach a phone's table before the result, the answer buttons only reach the player who buzzed, the first buzz wins and a second buzz
// at the same moment is refused, a wrong answer locks you out and costs half, the next buzzer has fewer buttons, a timeout counts as wrong, typed answers work, a fifth phone is told the game is full, a game reaches the winner
// screen and Play again returns to the lobby. Screenshots go to shotsDir (default ./_sp-shots).
const http = require("http"), fs = require("fs"), path = require("path"), {chromium} = require("playwright");
const root = path.resolve(__dirname, "../.."), shots = path.resolve(process.argv[2] || "_sp-shots"), N = +process.argv[3] || 3; fs.mkdirSync(shots, {recursive:true});
const R = {players:{}, crd:null, crdat:0, acts:[], room:null, leaks:0, leakMsg:[], posts:0};
const send = (res, o, code = 200) => { res.writeHead(code, {"content-type":"application/json"}); res.end(JSON.stringify(o)); };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"); let body = ""; req.on("data", d => body += d);
  req.on("end", () => {
    if(u.pathname.startsWith("/api/")){ const op = u.pathname.slice(5), b = body ? JSON.parse(body) : {}, q = u.searchParams;
      if(op === "ping") return send(res, {ok:true});
      if(op === "players"){ R.room = q.get("r"); return send(res, {players:Object.entries(R.players).map(([p, v]) => ({p, n:v.n, t:v.t, at:v.at})).sort((a, b) => a.at - b.at)}); }
      if(op === "join"){ R.players[b.p] = {n:b.n, t:b.t, at:R.players[b.p] ? R.players[b.p].at : Date.now()}; return send(res, {ok:true}); }
      if(op === "kick"){ delete R.players[b.p]; return send(res, {ok:true}); }
      if(op === "crd"){ R.crd = b.crd; R.crdat = Date.now(); R.posts++; const pub = b.crd.pub, J = JSON.stringify(pub), leak = m => { R.leaks++; R.leakMsg.push(m + " " + pub.ph); };
        if(/"q":|"opts"|"emoji"|"flag"/.test(J)) leak("clue text or buttons in pub");
        if(pub.ans && pub.ph !== "result") leak("answer outside the result");
        const pv = Object.keys(b.crd.priv); if(pub.ph === "buzzed"){ if(pv.length !== 1 || pv[0] !== pub.buz) leak("private part not only for the buzzer"); } else if(pv.length) leak("private part outside a buzz");
        return send(res, {ok:true}); }
      if(op === "crdstate"){ const me = R.players[q.get("p")]; if(!me) return send(res, {name:null}); if(!R.crd) return send(res, {name:me.n, pub:null, me:null}); return send(res, {name:me.n, pub:R.crd.pub, me:R.crd.priv[q.get("p")] || null, ago:Date.now() - R.crdat}); }
      if(op === "crdact"){ if(!R.players[b.p]) return send(res, {ok:false, error:"unknown"}, 409); if(!R.crd || R.crd.pub.v !== b.v) return send(res, {ok:false, error:"stale"}, 409); R.acts.push({p:b.p, v:b.v, a:b.a}); return send(res, {ok:true}); }
      if(op === "crdacts"){ const s = +q.get("since") || 0, e = Math.min(R.acts.length, s + 100); return send(res, {n:e, acts:R.acts.slice(s, e)}); }
      return send(res, {ok:false}, 404); }
    const f = u.pathname === "/" ? "index.html" : u.pathname.slice(1), file = path.join(root, f);
    if(!file.startsWith(root) || !fs.existsSync(file)){ res.writeHead(404); return res.end(); }
    res.writeHead(200, {"content-type":f.endsWith(".js") ? "text/javascript" : f.endsWith(".mp3") ? "audio/mpeg" : f.endsWith(".svg") ? "image/svg+xml" : "text/html"}); res.end(fs.readFileSync(file)); }); });
process.on("unhandledRejection", e => { console.log("ERR", e.message.split("\n")[0], (e.stack.match(/speed-e2e.js:\d+/) || [])[0]); process.exit(1); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = "http://localhost:" + srv.address().port, errs = [], fails = [];
  const b = await chromium.launch(), tv = await (await b.newContext({viewport:{width:1920, height:1080}})).newPage();
  const watch = (p, n) => { p.on("pageerror", e => errs.push(n + " " + e.message)); p.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push(n + " " + m.text()); }); };
  const cfg = {per:2, typed:false, wbw:true, pen:true, off:{}};
  watch(tv, "TV"); await tv.addInitScript(c => { try{ if(!localStorage.getItem("jn_spCfg")) localStorage.setItem("jn_spCfg", JSON.stringify(c)); }catch(e){} }, cfg);
  await tv.route(/^(?!http:\/\/localhost)/, r => r.abort());
  await tv.goto(base + "/index.html?spdebug"); await tv.waitForTimeout(600); await tv.click("#modeSp"); await tv.waitForTimeout(400); await tv.screenshot({path:path.join(shots, "tv-title.png")});
  await tv.click("#modeGo"); await tv.waitForTimeout(1200); await tv.screenshot({path:path.join(shots, "tv-lobby-empty.png")});
  const names = ["Omar", "Nour", "Karim", "Salma", "Youssef"].slice(0, N), phones = [];
  const mkPhone = async n => { const c = await b.newContext({viewport:{width:390, height:800}, isMobile:true, hasTouch:true}), p = await c.newPage(); watch(p, n);
    await p.route(/^(?!http:\/\/localhost)/, r => r.abort()); await p.goto(`${base}/buzz.html?r=${R.room}`); p.nm = n; return p; };
  for(const n of names){ const p = await mkPhone(n); if(!phones.length) await p.screenshot({path:path.join(shots, "phone-join.png")}); await p.fill("#nm", n); await p.click("#jb"); await p.waitForTimeout(250); phones.push(p); }
  await tv.waitForTimeout(1500); await tv.screenshot({path:path.join(shots, "tv-lobby.png")}); await phones[0].screenshot({path:path.join(shots, "phone-lobby.png")});
  const pOf = n => Object.keys(R.players).find(k => R.players[k].n === n), phone = p => phones.find(x => pOf(x.nm) === p), ph = () => R.crd && R.crd.pub && R.crd.pub.ph;
  const waitPh = async (want, ms = 12000) => { const t0 = Date.now(); while(Date.now() - t0 < ms){ if(Array.isArray(want) ? want.includes(ph()) : ph() === want) return true; await tv.waitForTimeout(80); } fails.push(`never reached ${want}, stuck on ${ph()}`); return false; };
  const clueOf = () => tv.evaluate(() => ({a:__SP.g.clue.a, ci:__SP.g.clue.ci, opts:__SP.g.clue.opts, q:__SP.g.clue.q, cat:__SP.g.clue.catName}));
  const scores = () => Object.assign({}, R.crd.pub.score);
  let five = null;
  if(N >= 4){ five = await mkPhone("Late"); await five.fill("#nm", "Late"); await five.click("#jb"); await tv.waitForTimeout(1500); if(!(await five.locator("text=full").count())) fails.push("a fifth phone is not told the game is full"); await five.screenshot({path:path.join(shots, "phone-full.png")}); }
  await tv.click("#spGo"); await tv.waitForTimeout(800); await tv.screenshot({path:path.join(shots, "tv-round.png")});
  const id = n => pOf(n);
  // ---- clue 1: A buzzes and is right
  await waitPh("ready"); await tv.screenshot({path:path.join(shots, "tv-ready.png")}); await phones[0].screenshot({path:path.join(shots, "phone-ready.png")});
  await phones[0].click("#bz"); await phones[0].waitForTimeout(150); if(!(await phones[0].locator("text=TOO EARLY").count())) fails.push("an early press does not say TOO EARLY");
  await waitPh("live"); await tv.waitForTimeout(700); await tv.screenshot({path:path.join(shots, "tv-live.png")}); await phones[0].screenshot({path:path.join(shots, "phone-live.png")});
  if(R.crd.pub.cat === undefined) fails.push("no category in the table");
  let c = await clueOf(); const s0 = scores(), val0 = R.crd.pub.val; await phones[0].waitForSelector("#bz:not(.grey)", {timeout:4000}).catch(() => fails.push("buzzer not live on the phone")); await tv.waitForTimeout(600); await phones[0].click("#bz");
  await waitPh("buzzed", 4000); if(R.crd.pub.buz !== id(names[0])) fails.push("A did not win the buzz"); await tv.waitForTimeout(500);
  await tv.screenshot({path:path.join(shots, "tv-buzzed.png")}); await phones[0].waitForSelector(".opt", {timeout:4000}).catch(() => fails.push("the buzzer sees no buttons")); await phones[0].screenshot({path:path.join(shots, "phone-options.png")});
  if(await phones[1].locator(".opt").count()) fails.push("another phone can see the answer buttons"); await phones[1].screenshot({path:path.join(shots, "phone-other-buzzed.png")});
  if((await phones[0].locator(".opt").count()) !== 4) fails.push("not 4 buttons");
  await phones[0].locator(".opt", {hasText:new RegExp("^" + c.a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i")}).first().click(); await waitPh("result", 4000);
  if(scores()[id(names[0])] !== s0[id(names[0])] + val0) fails.push("right answer did not score the clue value " + val0 + ": " + JSON.stringify(scores()));
  await tv.screenshot({path:path.join(shots, "tv-result.png")}); await phones[0].screenshot({path:path.join(shots, "phone-result.png")});
  // ---- clue 2: B buzzes wrong, is locked, C buzzes and is right (3+ players); with 2 players B is wrong and nobody is left
  await waitPh("ready", 8000); await waitPh("live", 5000); await tv.waitForTimeout(600); c = await clueOf(); const s1 = scores(), val1 = R.crd.pub.val;
  await phones[1].click("#bz"); await waitPh("buzzed", 4000); await phones[1].waitForSelector(".opt", {timeout:4000}).catch(() => fails.push("B sees no buttons"));
  const wrongIdx = (await phones[1].locator(".opt").evaluateAll(els => els.map(e => e.textContent))).findIndex(t => t.toLowerCase() !== c.a.toLowerCase());
  await phones[1].locator(".opt").nth(wrongIdx).click(); await tv.waitForTimeout(700);
  if(N >= 3){ if(ph() !== "live") fails.push("after a wrong answer the clue should go on, got " + ph()); if(scores()[id(names[1])] !== s1[id(names[1])] - val1 / 2) fails.push("wrong answer did not cost half of " + val1 + ": " + JSON.stringify(scores()));
    await tv.screenshot({path:path.join(shots, "tv-locked.png")}); if(!(await phones[1].locator("text=LOCKED").count())) fails.push("B's phone does not say LOCKED"); await phones[1].screenshot({path:path.join(shots, "phone-locked.png")});
    await phones[1].locator("#bz").click({timeout:500}).catch(() => {});   // no buzzer to press
    await phones[2].click("#bz"); await waitPh("buzzed", 4000); if(R.crd.pub.buz !== id(names[2])) fails.push("C did not get the buzz after B was locked");
    await phones[2].waitForSelector(".opt", {timeout:4000}); if((await phones[2].locator(".opt").count()) !== 3) fails.push("C should see 3 buttons, saw " + await phones[2].locator(".opt").count());
    await phones[2].locator(".opt", {hasText:new RegExp("^" + c.a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i")}).first().click(); await waitPh("result", 4000); }
  // ---- clue 3: A and B buzz at the same moment; exactly one wins, the other's buzz is refused; the winner times out
  await waitPh("ready", 18000); await waitPh("live", 5000); await tv.waitForTimeout(600); const before = R.acts.length;
  await Promise.all([phones[0].click("#bz"), phones[1].click("#bz")]); await waitPh("buzzed", 4000); await tv.waitForTimeout(500);
  const buzzActs = R.acts.slice(before).filter(a => a.a.k === "buzz"); if(!buzzActs.some(a => a.p === R.crd.pub.buz) || buzzActs[0].p !== R.crd.pub.buz) fails.push("the first buzz at the relay did not win: " + JSON.stringify(buzzActs.map(a => a.p)) + " vs " + R.crd.pub.buz);   // the relay keeps both, the laptop takes the first
  const first = R.crd.pub.buz, val2 = R.crd.pub.val; const s2 = scores(); await tv.waitForTimeout(6800); if(ph() === "buzzed") fails.push("the answer timer never ran out"); if(scores()[first] !== s2[first] - val2 / 2 && R.crd.pub.ph !== "result") fails.push("a timeout should cost half the clue value: " + JSON.stringify(scores()) + " vs " + JSON.stringify(s2));
  // ---- clue 4 on: nobody buzzes (host skips), then play on with A buzzing right until the game ends
  let over = false, k = 0, lastRound = 0;
  for(let t = 0; t < 600 && !over; t++){
    if(await tv.locator('[data-act="again"]').count() && ph() === "over"){ over = true; break; }
    const pub = R.crd && R.crd.pub; if(!pub){ await tv.waitForTimeout(150); continue; }
    if(pub.ph === "scores" || pub.ph === "round"){ if(pub.rd !== lastRound || pub.ph === "scores"){ lastRound = pub.rd; await tv.screenshot({path:path.join(shots, pub.ph === "scores" ? "tv-scores.png" : "tv-round-" + pub.rd + ".png")}); } await tv.locator('[data-act="next"]').click().catch(() => {}); await tv.waitForTimeout(250); continue; }
    if(pub.ph === "result"){ await tv.locator('[data-act="next"]').click().catch(() => {}); await tv.waitForTimeout(250); continue; }
    if(pub.ph === "live"){ k++; const p = phone(pub.ids[k % pub.ids.length]); if(pub.lock.includes(pub.ids[k % pub.ids.length]) || (pub.sd && !pub.sd.includes(pub.ids[k % pub.ids.length]))){ await tv.waitForTimeout(150); continue; }
      if(k % 3 === 0){ await tv.locator('[data-act="next"]').click().catch(() => {}); await tv.waitForTimeout(250); continue; }   // nobody buzzes: the host skips the clue
      c = await clueOf(); await tv.waitForTimeout(400); await p.click("#bz").catch(() => {}); await waitPh(["buzzed", "result"], 3000); if(ph() === "buzzed" && R.crd.pub.buz === pub.ids[k % pub.ids.length]){
        await p.waitForSelector(".opt", {timeout:3000}).catch(() => fails.push("no buttons for the buzzer"));
        const txt = await p.locator(".opt").evaluateAll(els => els.map(e => e.textContent)); const i = txt.findIndex(x => x.toLowerCase() === c.a.toLowerCase()); if(i < 0) fails.push("the right answer is not among the buttons"); else await p.locator(".opt").nth(i).click(); }
      await tv.waitForTimeout(300); continue; }
    await tv.waitForTimeout(150); }
  if(!over) fails.push("the game never reached the winner screen (stuck on " + ph() + ")");
  else { await tv.waitForTimeout(500); await tv.screenshot({path:path.join(shots, "tv-over.png")}); await phones[0].screenshot({path:path.join(shots, "phone-over.png")});
    if(!(await phones[0].locator("text=/win|finished/i").count())) fails.push("the phone shows no result at the end");
    await tv.click('[data-act="again"]'); await tv.waitForTimeout(800); if(!(await tv.locator("#spGo").count())) fails.push("Play again did not return to the lobby"); await tv.screenshot({path:path.join(shots, "tv-lobby-again.png")}); }
  // ---- a second, typed game
  await tv.locator('[data-set="typed"][data-v="1"]').click(); await tv.locator('[data-set="mara"][data-v="1"]').click(); await tv.locator('[data-set="mn"][data-v="20"]').click(); await tv.waitForTimeout(300); await tv.screenshot({path:path.join(shots, "tv-lobby-marathon.png")}); await tv.click("#spGo"); await waitPh("round", 3000);
  await tv.locator('[data-act="next"]').click(); await waitPh("ready", 6000); await waitPh("live", 5000); await tv.waitForTimeout(600); c = await clueOf(); const st0 = scores(), valT = R.crd.pub.val; if(!R.crd.pub.mara || R.crd.pub.of !== 20 || ![200, 300, 400, 500].includes(valT)) fails.push("marathon table wrong: " + JSON.stringify([R.crd.pub.mara, R.crd.pub.of, valT]));
  await phones[0].click("#bz"); await waitPh("buzzed", 4000); await phones[0].waitForSelector("#av", {timeout:4000}).catch(() => fails.push("no text box in Type it mode"));
  if(R.crd.pub.secs !== 15) fails.push("typing should give 15 s, got " + R.crd.pub.secs); await phones[0].screenshot({path:path.join(shots, "phone-typed.png")});
  await phones[0].fill("#av", c.a.toUpperCase()); await phones[0].click("#ab"); await waitPh("result", 4000); if(scores()[id(names[0])] !== st0[id(names[0])] + valT) fails.push("a typed right answer did not score the clue value: " + JSON.stringify(scores()));
  await tv.screenshot({path:path.join(shots, "tv-typed-result.png")});
  console.log("posts:", R.posts, "acts:", R.acts.length, "leaks:", R.leaks, R.leakMsg.slice(0, 3));
  if(R.leaks) fails.push("leaks: " + R.leakMsg.slice(0, 3).join("; "));
  if(errs.length) fails.push("page errors: " + [...new Set(errs)].slice(0, 5).join(" | "));
  await b.close(); srv.close(); if(fails.length){ console.log("FAIL"); fails.forEach(f => console.log(" -", f)); process.exit(1); } console.log("speed e2e ok"); })();
