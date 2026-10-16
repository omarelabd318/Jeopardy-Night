// 7.2 (adapted from tarneeb-e2e.js): plays a whole Texas Hold'em game in a headless browser against a small in-memory copy of the relay (worker/index.js): one TV page and N phone pages that click their buttons.
//   NODE_PATH=$(npm root -g) node v4work/tools/holdem-e2e.js [players=5] [shotsDir]
// It needs a built index.html (node build.js). Screenshots of the TV and phones go to shotsDir (default: ./_hd-shots).
const http = require("http"), fs = require("fs"), path = require("path"), {chromium} = require("playwright");
const NP = Math.max(2, Math.min(9, +process.argv[2] || 5));
const root = path.resolve(__dirname, "../.."), shots = path.resolve(process.argv[3] || "_hd-shots"); fs.mkdirSync(shots, {recursive:true});
const R = {players:{}, crd:null, acts:[], room:null};
const send = (res, o, code = 200) => { res.writeHead(code, {"content-type":"application/json"}); res.end(JSON.stringify(o)); };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"); let body = ""; req.on("data", d => body += d);
  req.on("end", () => {
    if(u.pathname.startsWith("/api/")){ const op = u.pathname.slice(5), b = body ? JSON.parse(body) : {}, q = u.searchParams;
      if(op === "ping") return send(res, {ok:true});
      if(op === "players"){ R.room = q.get("r"); return send(res, {players:Object.entries(R.players).map(([p, v]) => ({p, n:v.n, at:v.at})).sort((a, b) => a.at - b.at)}); }
      if(op === "join"){ R.players[b.p] = {n:b.n, at:R.players[b.p] ? R.players[b.p].at : Date.now()}; return send(res, {ok:true}); }
      if(op === "kick"){ delete R.players[b.p]; return send(res, {ok:true}); }
      if(op === "crd"){ R.crd = b.crd; return send(res, {ok:true}); }
      if(op === "crdstate"){ const me = R.players[q.get("p")]; if(!me) return send(res, {name:null}); if(!R.crd) return send(res, {name:me.n, pub:null, me:null}); return send(res, {name:me.n, pub:R.crd.pub, me:R.crd.priv[q.get("p")] || null}); }
      if(op === "crdact"){ if(!R.players[b.p]) return send(res, {ok:false, error:"unknown"}, 409); if(!R.crd || R.crd.pub.v !== b.v) return send(res, {ok:false, error:"stale"}, 409); R.acts.push({p:b.p, v:b.v, a:b.a}); return send(res, {ok:true}); }
      if(op === "crdacts"){ const s = +q.get("since") || 0, e = Math.min(R.acts.length, s + 100); return send(res, {n:e, acts:R.acts.slice(s, e)}); }
      return send(res, {ok:false}, 404); }
    const f = u.pathname === "/" ? "index.html" : u.pathname.slice(1), file = path.join(root, f);
    if(!file.startsWith(root) || !fs.existsSync(file)){ res.writeHead(404); return res.end(); }
    res.writeHead(200, {"content-type":f.endsWith(".js") ? "text/javascript" : "text/html"}); res.end(fs.readFileSync(file)); }); });
process.on("unhandledRejection", e => { console.log("ERR", e.message.split("\n")[0]); process.exit(1); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = "http://localhost:" + srv.address().port, errs = [];
  const fast = () => { const si = window.setInterval, st = window.setTimeout; window.setInterval = (f, t, ...a) => si(f, t > 500 ? t / 5 : t, ...a); window.setTimeout = (f, t, ...a) => st(f, t > 1000 ? t / 5 : t, ...a); };   // the real waits are seconds long
  const b = await chromium.launch(), tvc = await b.newContext({viewport:{width:1920, height:1080}}), tv = await tvc.newPage();
  tv.on("pageerror", e => errs.push("TV " + e.message)); tv.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push("TV " + m.text()); });
  await tv.addInitScript(fast); await tv.addInitScript(() => { try{ localStorage.setItem("jn_hdCfg", JSON.stringify({chips:300, up:3, timer:0, helper:true, end:"last", fixed:30, four:false})); }catch(e){} });   // a short game
  await tv.route(/^(?!http:\/\/localhost)/, r => r.abort());   // no outside network: the fonts and the QR script just don't load
  await tv.goto(base + "/index.html"); await tv.waitForTimeout(500); await tv.click("#modeHold"); await tv.waitForTimeout(300); await tv.click("#modeHold"); await tv.waitForTimeout(1200);
  const names = ["Omar", "Sara", "Karim", "Youssef", "Nour", "Mai", "Hana", "Tarek", "Laila"].slice(0, NP);
  await tv.screenshot({path:path.join(shots, "tv-lobby-empty.png")});
  const phones = [];
  for(const n of names){
    const c = await b.newContext({viewport:{width:390, height:800}, isMobile:true, hasTouch:true}), p = await c.newPage();
    p.on("pageerror", e => errs.push(n + " " + e.message)); p.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push(n + " " + m.text()); });
    await p.addInitScript(fast); await p.route(/^(?!http:\/\/localhost)/, r => r.abort());
    await p.goto(`${base}/cards.html?r=${R.room}&g=hd`); await p.fill("#nm", n); await p.click("#jb"); await p.waitForTimeout(300); phones.push(p); }
  await tv.waitForTimeout(1500); await tv.screenshot({path:path.join(shots, "tv-lobby.png")}); await phones[0].screenshot({path:path.join(shots, "phone-waiting.png")});
  await tv.click("#hdGo"); await tv.waitForTimeout(1500);
  let late = null, lateTxt = "", lateSeated = false, moves = 0, missed = 0, hands = 0, shotAt = new Set(), done = false, lastHand = 0;
  for(let tick = 0; tick < 6000 && !done; tick++){
    if(await tv.locator(".hdpod").count()){ done = true; break; }
    const chipTxt = await tv.locator(".ckchip").first().innerText().catch(() => ""), hn = +((chipTxt.match(/Hand (\d+)/) || [])[1] || 0); if(hn !== lastHand){ lastHand = hn; hands++; }
    if(await tv.locator('[data-act="next"]').count() && !shotAt.has("show")){ shotAt.add("show"); await tv.screenshot({path:path.join(shots, "tv-show.png")}); await phones[1].screenshot({path:path.join(shots, "phone-show.png")}); }
    let acted = false;
    for(const p of phones){
      const k = await p.evaluate(() => st && st.me && st.me.act ? st.me.act.k : null); if(!k) continue;
      const shot = async name => { if(!shotAt.has(name)){ shotAt.add(name); await p.screenshot({path:path.join(shots, "phone-" + name + ".png")}); await tv.screenshot({path:path.join(shots, "tv-" + name + ".png")}); } };
      try{
        const r = Math.random(), canRaise = await p.locator("#hdgo").count();
        if(tick > 5 && !shotAt.has("peek")){ shotAt.add("peek"); await p.evaluate(() => document.getElementById("hdh") && document.getElementById("hdh").classList.add("peek")); await p.screenshot({path:path.join(shots, "phone-peek.png")}); await p.evaluate(() => document.getElementById("hdh") && document.getElementById("hdh").classList.remove("peek")); }
        await shot("turn");
        if(canRaise && r < .3){ const q = ["min", "half", "pot", "max"][Math.floor(Math.random() * 4)]; await p.click(`[data-q="${q}"]`, {timeout:1500}); await shot("raise"); await p.click("#hdgo", {timeout:1500}); }
        else if(canRaise && r < .4){ const typed = ["5", "99999", "60", "137"][Math.floor(Math.random() * 4)]; await p.fill("#hdn", typed); await shot("typed"); if(Math.random() < .5) await p.press("#hdn", "Enter"); else await p.click("#hdgo", {timeout:1500}); }   // 7.48: type the bet
        else if(r < .55) await p.click('[data-hd="fold"]', {timeout:1500});
        else await p.click('[data-hd="check"], [data-hd="call"]', {timeout:1500});
        moves++;
      }catch(e){ if(++missed < 25){ console.log("missed click (the buttons went away: a street was being dealt)", e.message.split("\n")[0]); await p.waitForTimeout(300); continue; } await p.screenshot({path:path.join(shots, "stuck.png")}); console.log("TV:", (await tv.evaluate(() => document.getElementById("hdBody").innerText)).replace(/\n/g," | ").slice(0,400)); console.log("STUCK on", k, e.message.split("\n")[0], await p.evaluate(() => JSON.stringify({turn:st.pub.turn, board:st.pub.board, seat:st.me.seat, v:st.pub.v, act:st.me.act, html:document.getElementById("view").innerText.slice(0, 300)}))); process.exit(1); }
      acted = true; await p.waitForTimeout(60); break; }
    if(!acted) await tv.waitForTimeout(120);
    if(tick === 38){ await tv.click('[data-act="qr"]'); await tv.waitForTimeout(600); await tv.screenshot({path:path.join(shots, "tv-joincode.png")}); const ok = await tv.locator("#hdQr2").count(); if(!ok) errs.push("no join code on the TV"); await tv.click(".hdqrpop"); }
    if(tick === 40){ const c = await b.newContext({viewport:{width:390, height:800}, isMobile:true, hasTouch:true}), p = await c.newPage(); p.on("pageerror", e => errs.push("Late " + e.message)); await p.addInitScript(fast); await p.route(/^(?!http:\/\/localhost)/, r => r.abort());
      await p.goto(`${base}/cards.html?r=${R.room}&g=hd`); await p.fill("#nm", "Late"); await p.click("#jb"); await p.waitForTimeout(1500); late = p; phones.push(p);   // 7.65: joins in the middle of the game
      lateTxt = await p.innerText("body"); await p.screenshot({path:path.join(shots, "phone-late-waiting.png")}); }
    if(late && !lateSeated && tick > 41 && !/Watching/.test(await late.innerText("body").catch(() => "Watching"))){ lateSeated = true; await late.screenshot({path:path.join(shots, "phone-late-seated.png")}); }
    if(tick === 80 && !shotAt.has("mid")){ shotAt.add("mid"); await tv.screenshot({path:path.join(shots, "tv-mid.png")}); await phones[1].screenshot({path:path.join(shots, "phone-mid.png")}); } }
  await tv.waitForTimeout(800); await tv.screenshot({path:path.join(shots, "tv-over.png")}); await phones[0].screenshot({path:path.join(shots, "phone-over.png")});
  console.log("late joiner: waiting text", /dealt in/.test(lateTxt) ? "ok" : "MISSING", "| seated", lateSeated ? "yes" : "NO"); if(!lateSeated || !/dealt in/.test(lateTxt)) errs.push("late joiner not handled");
  console.log(done ? "game finished" : "GAME DID NOT FINISH", "| hands:", hands, "| phone moves:", moves, "| errors:", errs.length); errs.slice(0, 8).forEach(e => console.log(" ", e));
  await b.close(); srv.close(); process.exit(done && !errs.length ? 0 : 1);
})();
