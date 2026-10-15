// 6.82: plays a whole Codenames match (best of 3) in a headless browser against a small in-memory copy of the relay (worker/index.js): one TV page and six phone pages (3 Red, 3 Blue).
//   NODE_PATH=$(npm root -g) node v4work/tools/cn-e2e.js [look: mission|souq] [shotsDir]
// It needs a built index.html (node build.js). Checks: the key only reaches the two spymaster phones, a board word is refused as a hint, the match ends with a winner. Screenshots go to shotsDir (default ./_cn-shots).
const http = require("http"), fs = require("fs"), path = require("path"), {chromium} = require("playwright");
const root = path.resolve(__dirname, "../.."), look = process.argv[2] || "mission", shots = path.resolve(process.argv[3] || "_cn-shots"); fs.mkdirSync(shots, {recursive:true});
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
process.on("unhandledRejection", async e => { console.log("ERR", e.message.split("\n")[0], "| priv", JSON.stringify(Object.keys(R.crd.priv)), "| spies", JSON.stringify(R.crd.pub.spies), "| teams", JSON.stringify(R.crd.pub.teams), "| turn", R.crd.pub.turn, R.crd.pub.ph); try{ for(const p of global.PH || []) console.log(p.nm, "|", await p.evaluate(() => JSON.stringify({me, key:!!(st && st.me && st.me.key), spies:st && st.pub && st.pub.spies, v:st && st.pub && st.pub.v})), (await p.evaluate(() => document.getElementById("view").innerText.slice(0, 60).replace(/\n/g, " / ")))); }catch(x){} process.exit(1); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = "http://localhost:" + srv.address().port, errs = [], fails = [];
  const fast = () => { const si = window.setInterval, st = window.setTimeout; window.setInterval = (f, t, ...a) => si(f, t > 500 ? t / 5 : t, ...a); window.setTimeout = (f, t, ...a) => st(f, t > 1000 ? t / 5 : t, ...a); };
  const b = await chromium.launch(), tv = await (await b.newContext({viewport:{width:1920, height:1080}})).newPage();
  tv.on("pageerror", e => errs.push("TV " + e.message)); tv.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push("TV " + m.text()); });
  await tv.addInitScript(fast); await tv.addInitScript(l => { try{ localStorage.setItem("jn_cnCfg", JSON.stringify({look:l, match:3})); }catch(e){} }, look);
  await tv.route(/^(?!http:\/\/localhost)/, r => r.abort());
  await tv.goto(base + "/index.html"); await tv.waitForTimeout(500); await tv.click("#modeCn"); await tv.waitForTimeout(300); await tv.click("#modeCn"); await tv.waitForTimeout(1200);
  await tv.screenshot({path:path.join(shots, "tv-lobby-empty.png")});
  const phones = [];
  for(const [n, t] of [["Mona", 0], ["Karim", 0], ["Salma", 0], ["Youssef", 1], ["Nour", 1], ["Hana", 1]]){
    const c = await b.newContext({viewport:{width:390, height:800}, isMobile:true, hasTouch:true}), p = await c.newPage();
    p.on("pageerror", e => errs.push(n + " " + e.message)); p.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push(n + " " + m.text()); });
    await p.addInitScript(fast); await p.route(/^(?!http:\/\/localhost)/, r => r.abort());
    await p.goto(`${base}/cn.html?r=${R.room}`); await p.fill("#nm", n); await p.click(`.pick[data-t="${t}"]`); await p.click("#jb"); await p.waitForTimeout(300); p.nm = n; phones.push(p); }
  await tv.waitForTimeout(2200);
  await phones[0].waitForSelector('[data-a="spy"]', {timeout:5000}); await phones[0].click('[data-a="spy"]'); await phones[3].click('[data-a="spy"]'); await tv.waitForTimeout(2500);
  await tv.screenshot({path:path.join(shots, "tv-lobby.png")}); await phones[0].screenshot({path:path.join(shots, "phone-lobby.png")});
  console.log('acts', JSON.stringify(R.acts), 'crdv', R.crd && R.crd.pub.v, 'spies', R.crd && JSON.stringify(R.crd.pub.spies)); await tv.click("#cnGo"); await tv.waitForTimeout(1500);
  const spies = await tv.locator('.team .spy b').allTextContents();
  console.log('spies', spies, 'crdspies', JSON.stringify(R.crd.pub.spies), 'names', JSON.stringify(R.crd.pub.names)); if(spies[0] !== "Mona" || spies[1] !== "Youssef") fails.push("volunteers not made spymasters: " + spies);
  global.PH = phones; const shotAt = new Set(); let done = false, refused = false;
  const state = p => p.evaluate(() => st && st.pub ? {ph:st.pub.ph, turn:st.pub.turn, key:!!(st.me && st.me.key)} : null);
  for(let tick = 0; tick < 3000 && !done; tick++){
    if(await tv.locator('[data-act="again"]').count()){ done = true; break; }
    if(await tv.locator('[data-act="next"]').count()){ await tv.screenshot({path:path.join(shots, "tv-boardover.png")}); await phones[1].screenshot({path:path.join(shots, "phone-boardover.png")}); await tv.click('[data-act="next"]'); await tv.waitForTimeout(400); continue; }
    const sts = await Promise.all(phones.map(state)); if(sts.some(s => !s)){ await tv.waitForTimeout(150); continue; }
    const keyHolders = sts.map((s, i) => s.key ? phones[i].nm : null).filter(Boolean); if(tick === 3 && keyHolders.length !== 2 || sts.filter((x, i) => x.key && i < 3).length !== 1) fails.push("key reached: " + keyHolders);
    const ph = R.crd.pub.ph, turn = R.crd.pub.turn; let acted = false;
    if(ph === "hint"){ const team = [0, 1, 2], sp = phones[sts.findIndex((x, i) => x.key && (i < 3) === (turn === 0))]; await sp.waitForSelector("#hw", {timeout:8000});
      if(!refused){ const w = await sp.evaluate(() => st.pub.words[0]); await sp.fill("#hw", w); const msg = await sp.textContent("#her"); if(!/board|close/i.test(msg)) fails.push("board word not refused: " + msg); refused = true; await sp.screenshot({path:path.join(shots, "phone-spy-refused.png")}); }
      await sp.fill("#hw", "zebra" + Math.floor(Math.random() * 900)); await sp.click('.nums button[data-n="2"]'); if(!shotAt.has("hint")){ shotAt.add("hint"); await sp.screenshot({path:path.join(shots, "phone-spy-hint.png")}); }
      await sp.click('[data-a="hint"]'); acted = true; }
    else if(ph === "guess"){ const gs = [0, 1, 2, 3, 4, 5].filter(i => (i < 3) === (turn === 0) && !sts[i].key), g = phones[gs[Math.floor(Math.random() * gs.length)]];
      await g.waitForSelector(".board .t:not([disabled])", {timeout:8000}).catch(() => {}); const tile = g.locator(".board .t:not([disabled])"), n = await tile.count();
      if(n){ await tile.nth(Math.floor(Math.random() * n)).click(); await g.waitForTimeout(1300);
        if(!shotAt.has("guess")){ shotAt.add("guess"); await g.screenshot({path:path.join(shots, "phone-guess.png")}); await phones[sts.findIndex((x, i) => x.key && (i < 3) === (turn === 0))].screenshot({path:path.join(shots, "phone-spy-guess.png")}); await tv.screenshot({path:path.join(shots, "tv-guess.png")}); }
        const ok = g.locator('[data-a="ok"]'); if(await ok.count()) await ok.click({timeout:2000}).catch(() => {}); acted = true; } }
    if(tick === 80 && !shotAt.has("mid")){ shotAt.add("mid"); await tv.screenshot({path:path.join(shots, "tv-mid.png")}); }
    await tv.waitForTimeout(acted ? 1300 : 200); }
  await tv.waitForTimeout(800); await tv.screenshot({path:path.join(shots, "tv-over.png")}); await phones[0].screenshot({path:path.join(shots, "phone-over.png")});
  console.log(done ? "match finished" : "MATCH DID NOT FINISH", "| look:", look, "| failures:", fails.length, "| errors:", errs.length); fails.concat(errs).slice(0, 8).forEach(e => console.log(" ", e));
  await b.close(); srv.close(); process.exit(done && !errs.length && !fails.length ? 0 : 1);
})();
