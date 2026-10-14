// 6.100 (adapted from decrypto-e2e.js): plays whole For Sale? games in a headless browser against a small in-memory copy of the relay (worker/index.js): one TV page and N phone pages
// that raise, pass, pick deeds and press Lock.   NODE_PATH=$(npm root -g) node v4work/tools/forsale-e2e.js [shotsDir] [games] [players]
// It needs a built index.html (node build.js). Screenshots of the TV and some phones go to shotsDir (default: ./_sl-shots). TIMEOUT=1 lets the first bid run out the 15 s clock to test the auto-pass.
const http = require("http"), fs = require("fs"), path = require("path"), {chromium} = require("playwright");
const root = path.resolve(__dirname, "../.."), shots = path.resolve(process.argv[2] || "_sl-shots"), games = +process.argv[3] || 1, N = +process.argv[4] || 4; fs.mkdirSync(shots, {recursive:true});
const R = {players:{}, crd:null, acts:[], room:null};
const send = (res, o, code = 200) => { res.writeHead(code, {"content-type":"application/json"}); res.end(JSON.stringify(o)); };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"); let body = ""; req.on("data", d => body += d);
  req.on("end", () => {
    if(u.pathname.startsWith("/api/")){ const op = u.pathname.slice(5), b = body ? JSON.parse(body) : {}, q = u.searchParams;
      if(op === "ping") return send(res, {ok:true});
      if(op === "players"){ R.room = q.get("r"); return send(res, {players:Object.entries(R.players).map(([p, v]) => ({p, n:v.n, t:v.t, at:v.at})).sort((a, b) => a.at - b.at)}); }
      if(op === "join"){ R.players[b.p] = {n:b.n, t:b.t, at:R.players[b.p] ? R.players[b.p].at : Date.now()}; return send(res, {ok:true}); }
      if(op === "kick"){ delete R.players[b.p]; return send(res, {ok:true}); }
      if(op === "crd"){ R.crd = b.crd; return send(res, {ok:true}); }
      if(op === "crdstate"){ const me = R.players[q.get("p")]; if(!me) return send(res, {name:null}); if(!R.crd) return send(res, {name:me.n, pub:null, me:null}); return send(res, {name:me.n, pub:R.crd.pub, me:R.crd.priv[q.get("p")] || null}); }
      if(op === "crdact"){ if(!R.players[b.p]) return send(res, {ok:false, error:"unknown"}, 409); if(!R.crd || R.crd.pub.v !== b.v) return send(res, {ok:false, error:"stale"}, 409); R.acts.push({p:b.p, v:b.v, a:b.a}); return send(res, {ok:true}); }
      if(op === "crdacts"){ const s = +q.get("since") || 0, e = Math.min(R.acts.length, s + 100); return send(res, {n:e, acts:R.acts.slice(s, e)}); }
      return send(res, {ok:false}, 404); }
    const f = u.pathname === "/" ? "index.html" : u.pathname.slice(1), file = path.join(root, f);
    if(!file.startsWith(root) || !fs.existsSync(file)){ res.writeHead(404); return res.end(); }
    res.writeHead(200, {"content-type":f.endsWith(".js") ? "text/javascript" : "text/html"}); res.end(fs.readFileSync(file)); }); });
process.on("unhandledRejection", e => { console.log("ERR", e.message.split("\n")[0], (e.stack.match(/forsale-e2e.js:\d+/) || [])[0]); process.exit(1); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = "http://localhost:" + srv.address().port, errs = [];
  const fast = () => { const si = window.setInterval, st = window.setTimeout; window.setInterval = (f, t, ...a) => si(f, t > 500 ? t / 5 : t, ...a); window.setTimeout = (f, t, ...a) => st(f, t > 1000 ? t / 5 : t, ...a); };
  const b = await chromium.launch(), tvc = await b.newContext({viewport:{width:1920, height:1080}}), tv = await tvc.newPage();
  tv.on("pageerror", e => errs.push("TV " + e.message)); tv.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push("TV " + m.text()); });
  await tv.addInitScript(fast); if(process.env.TIMEOUT) await tv.addInitScript(() => { try{ localStorage.setItem("jn_slCfg", JSON.stringify({bid:15, sell:30})); }catch(e){} }); await tv.route(/^(?!http:\/\/localhost)/, r => r.abort());
  await tv.goto(base + "/index.html"); await tv.waitForTimeout(500);
  await tv.click("#modeSale"); await tv.waitForTimeout(500); await tv.screenshot({path:path.join(shots, "title-picked.png")}); await tv.click("#modeSale"); await tv.waitForTimeout(1200);
  await tv.screenshot({path:path.join(shots, "tv-lobby-empty.png")});
  const phones = [], names = ["Mona", "Karim", "Youssef", "Nour", "Salma", "Omar"].slice(0, N);
  for(let i = 0; i < names.length; i++){
    const c = await b.newContext({viewport:{width:390, height:800}, isMobile:true, hasTouch:true}), p = await c.newPage();
    p.on("pageerror", e => errs.push(names[i] + " " + e.message)); p.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push(names[i] + " " + m.text()); });
    await p.addInitScript(fast); await p.route(/^(?!http:\/\/localhost)/, r => r.abort());
    await p.goto(`${base}/sale.html?r=${R.room}`); if(i === 0) await p.screenshot({path:path.join(shots, "phone-join.png")});
    await p.fill("#nm", names[i]); await p.click("#jn"); await p.waitForTimeout(300); phones.push(p); }
  await tv.waitForTimeout(1500); await tv.screenshot({path:path.join(shots, "tv-lobby.png")}); await phones[0].screenshot({path:path.join(shots, "phone-lobby.png")});
  const seen = new Set(), did = new Set(); let finished = 0, acts = {raise:0, pass:0, pick:0}, timedOut = false;
  const shot = async (name, ph) => { if(seen.has(name)) return; seen.add(name); await tv.screenshot({path:path.join(shots, "tv-" + name + ".png")}); if(ph) await ph.screenshot({path:path.join(shots, "phone-" + name + ".png")}); };
  for(let game = 1; game <= games; game++){
    await tv.click("#slGo"); await tv.waitForTimeout(1500); let done = false;
    for(let tick = 0; tick < 8000 && !done; tick++){
      if(await tv.locator(".slwrap.over").count()){ done = true; break; }
      const pub = R.crd && R.crd.pub;
      if(pub && pub.phase === "bid" && process.env.TIMEOUT && !timedOut){ const turn = pub.turn; await shot("bid-first"); await tv.waitForTimeout(17000); const p2 = R.crd.pub; if(p2.turn === turn && p2.step === pub.step){ console.log("TIMEOUT DID NOT PASS"); process.exit(1); } timedOut = true; console.log("timeout passed the turn:", turn, "->", p2.turn); continue; }
      if(pub && (pub.phase === "sold" || pub.phase === "reveal") && await tv.locator('[data-act="next"]').count()){
        await shot(pub.phase, phones[0]); await tv.waitForTimeout(250); await tv.click('[data-act="next"]'); await tv.waitForTimeout(250); continue; }
      let acted = false;
      for(let i = 0; i < phones.length && !acted; i++){ const p = phones[i];
        const s = await p.evaluate(() => st && st.pub && st.me ? {pub:st.pub, me:st.me, busy:sending} : null); if(!s || s.busy) continue; const pb = s.pub, m = s.me, ck = i + ":" + pb.phase + pb.round + pb.sround + pb.step; if(did.has(ck)) continue;
        try{
          if(pb.phase === "bid" && m.myTurn){ if(pb.round === 2) await shot("bid-turn", p); const enable = await p.$$eval(".raise button:not([disabled])", bs => bs.map(x => +x.dataset.d));
            if(enable.length && Math.random() < .5){ const d = enable[Math.floor(Math.random() * enable.length)]; await p.click(`.raise button[data-d="${d}"]`, {timeout:2500}); acts.raise++; } else { await p.click("#ps", {timeout:2500}); acts.pass++; } acted = true; }
          else if(pb.phase === "bid" && pb.round === 2 && !m.myTurn && !m.out && pb.cur) await shot("bid-wait", p);
          else if(pb.phase === "sell" && !m.pick){ const pick = m.hand[Math.floor(Math.random() * m.hand.length)][0]; await p.click(`button.deed[data-c="${pick}"]`, {timeout:2500}); await shot("sell", p); await p.click("#lk", {timeout:2500}); acts.pick++; acted = true; }
        }catch(e){ const now = await p.evaluate(() => st && st.pub ? [st.pub.phase, st.pub.round, st.pub.sround, st.pub.step].join(":") : ""); if(now !== [pb.phase, pb.round, pb.sround, pb.step].join(":")) continue;
          await p.screenshot({path:path.join(shots, "stuck.png")}); console.log("STUCK", pb.phase, e.message.split("\n")[0]); process.exit(1); }
        if(acted){ did.add(ck); await p.waitForTimeout(60); } }
      if(!acted) await tv.waitForTimeout(120);
      if(R.crd && R.crd.pub.phase === "sell" && R.crd.pub.sround === 1 && !seen.has("tvsell")){ seen.add("tvsell"); await tv.waitForTimeout(400); await tv.screenshot({path:path.join(shots, "tv-sell.png")}); } }
    if(done){ finished++; if(game === 1){ await tv.waitForTimeout(3500); await tv.screenshot({path:path.join(shots, "tv-over.png")}); await phones[0].screenshot({path:path.join(shots, "phone-over.png")}); }
      if(game < games){ await tv.click("#slAgain"); await tv.waitForTimeout(1500); } } else break; }
  console.log(finished === games ? `${games} game(s) finished` : "GAME DID NOT FINISH", "| acts:", JSON.stringify(acts), "| errors:", errs.length); errs.slice(0, 8).forEach(e => console.log(" ", e));
  await b.close(); srv.close(); process.exit(finished === games && !errs.length ? 0 : 1);
})();
