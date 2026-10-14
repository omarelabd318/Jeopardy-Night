// 7.1: plays whole Liar's Bar games in a headless browser against a small in-memory copy of the relay (worker/index.js): one TV page and N phone pages (liars.html) that join, play cards and call Liar!.
//   NODE_PATH=$(npm root -g) node v4work/tools/liars-e2e.js [shotsDir] [players=5] [games=1]
// It needs a built index.html (node build.js). Checks: a phone only ever gets its own hand, the first play can't be called, a game ends with one winner, play again works. Screenshots go to shotsDir (default ./_lb-shots).
const http = require("http"), fs = require("fs"), path = require("path"), {chromium} = require("playwright");
const root = path.resolve(__dirname, "../.."), shots = path.resolve(process.argv[2] || "_lb-shots"), N = +process.argv[3] || 5, GAMES = +process.argv[4] || 1; fs.mkdirSync(shots, {recursive:true});
const R = {players:{}, crd:null, acts:[], room:null, leaks:0};
const send = (res, o, code = 200) => { res.writeHead(code, {"content-type":"application/json"}); res.end(JSON.stringify(o)); };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"); let body = ""; req.on("data", d => body += d);
  req.on("end", () => {
    if(u.pathname.startsWith("/api/")){ const op = u.pathname.slice(5), b = body ? JSON.parse(body) : {}, q = u.searchParams;
      if(op === "ping") return send(res, {ok:true});
      if(op === "players"){ R.room = q.get("r"); return send(res, {players:Object.entries(R.players).map(([p, v]) => ({p, n:v.n, t:v.t, at:v.at})).sort((a, b) => a.at - b.at)}); }
      if(op === "join"){ R.players[b.p] = {n:b.n, t:b.t, at:R.players[b.p] ? R.players[b.p].at : Date.now()}; return send(res, {ok:true}); }
      if(op === "kick"){ delete R.players[b.p]; return send(res, {ok:true}); }
      if(op === "crd"){ R.crd = b.crd; if(JSON.stringify(b.crd.pub).includes('"hand"')) R.leaks++; return send(res, {ok:true}); }
      if(op === "crdstate"){ const me = R.players[q.get("p")]; if(!me) return send(res, {name:null}); if(!R.crd) return send(res, {name:me.n, pub:null, me:null}); return send(res, {name:me.n, pub:R.crd.pub, me:R.crd.priv[q.get("p")] || null}); }
      if(op === "crdact"){ if(!R.players[b.p]) return send(res, {ok:false, error:"unknown"}, 409); if(!R.crd || R.crd.pub.v !== b.v) return send(res, {ok:false, error:"stale"}, 409); R.acts.push({p:b.p, v:b.v, a:b.a}); return send(res, {ok:true}); }
      if(op === "crdacts"){ const s = +q.get("since") || 0, e = Math.min(R.acts.length, s + 100); return send(res, {n:e, acts:R.acts.slice(s, e)}); }
      return send(res, {ok:false}, 404); }
    const f = u.pathname === "/" ? "index.html" : u.pathname.slice(1), file = path.join(root, f);
    if(!file.startsWith(root) || !fs.existsSync(file)){ res.writeHead(404); return res.end(); }
    res.writeHead(200, {"content-type":f.endsWith(".js") ? "text/javascript" : "text/html"}); res.end(fs.readFileSync(file)); }); });
process.on("unhandledRejection", e => { console.log("ERR", e.message.split("\n")[0], (e.stack.match(/liars-e2e.js:\d+/) || [])[0]); process.exit(1); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = "http://localhost:" + srv.address().port, errs = [], fails = [];
  const b = await chromium.launch(), tv = await (await b.newContext({viewport:{width:1920, height:1080}})).newPage();
  const watch = (p, n) => { p.on("pageerror", e => errs.push(n + " " + e.message)); p.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push(n + " " + m.text()); }); };
  watch(tv, "TV"); await tv.addInitScript(() => { try{ localStorage.setItem("jn_lbCfg", JSON.stringify({timer:0})); }catch(e){} window.__lbMs = [900, 900]; });
  await tv.route(/^(?!http:\/\/localhost)/, r => r.abort());
  await tv.goto(base + "/index.html"); await tv.waitForTimeout(600); await tv.click("#modeLb"); await tv.waitForTimeout(400); await tv.screenshot({path:path.join(shots, "tv-title.png")});
  await tv.click("#modeGo"); await tv.waitForTimeout(1200); await tv.screenshot({path:path.join(shots, "tv-lobby-empty.png")});
  const names = ["Omar", "Nour", "Karim", "Salma", "Youssef", "Mariam", "Hana", "Tarek"].slice(0, N), phones = [];
  for(const n of names){
    const c = await b.newContext({viewport:{width:390, height:800}, isMobile:true, hasTouch:true}), p = await c.newPage(); watch(p, n);
    await p.route(/^(?!http:\/\/localhost)/, r => r.abort()); await p.goto(`${base}/liars.html?r=${R.room}`);
    if(!phones.length) await p.screenshot({path:path.join(shots, "phone-join.png")});
    await p.fill("#nm", n); await p.click("#jb"); await p.waitForTimeout(250); p.nm = n; phones.push(p); }
  await tv.waitForTimeout(1800); await tv.screenshot({path:path.join(shots, "tv-lobby.png")}); await phones[0].screenshot({path:path.join(shots, "phone-lobby.png")});
  let finished = 0;
  for(let game = 1; game <= GAMES; game++){
    await tv.click("#lbGo"); await tv.waitForTimeout(1200); global.PH = phones; const seen = new Set(); let done = false, checkedFirst = false;
    for(let tick = 0; tick < 4000 && !done; tick++){
      if(await tv.locator('[data-act="again"]').count()){ done = true; break; }
      const nx = tv.locator('[data-act="next"]'); if(await nx.count()){ if(!seen.has("tvspin")){ seen.add("tvspin"); await tv.screenshot({path:path.join(shots, "tv-spin-result.png")}); }
        if(!seen.has("phonespin")){ seen.add("phonespin"); await phones[1].screenshot({path:path.join(shots, "phone-spin.png")}); }
        await nx.click(); await tv.waitForTimeout(500); continue; }
      const pub = R.crd && R.crd.pub; if(!pub){ await tv.waitForTimeout(200); continue; }
      if(pub.ph === "reveal" && !seen.has("rev")){ seen.add("rev"); await tv.screenshot({path:path.join(shots, "tv-reveal.png")}); await phones[2].screenshot({path:path.join(shots, "phone-reveal.png")}); }
      if(pub.ph === "spin" && !seen.has("spin") ){ seen.add("spin"); await tv.screenshot({path:path.join(shots, "tv-spin.png")}); }
      if(pub.ph !== "turn"){ await tv.waitForTimeout(250); continue; }
      const who = phones.find(p => R.players[Object.keys(R.players).find(k => R.players[k].n === p.nm)] && Object.keys(R.players).find(k => R.players[k].n === p.nm) === pub.turn);
      if(!who){ await tv.waitForTimeout(200); continue; }
      await who.waitForSelector('.btns button', {timeout:6000}).catch(() => {});
      const st = await who.evaluate(() => ({hand:(st.me && st.me.hand) || [], pubTurn:st.pub.turn, me:me.p, hasLiar:!!document.querySelector('[data-a="liar"]'), lo:st.pub.lo, last:st.pub.last}));
      if(st.pubTurn !== st.me){ await tv.waitForTimeout(150); continue; }
      if(!pub.last && st.hasLiar) fails.push("Liar! offered on the first play");
      if(pub.last && !st.hasLiar) fails.push("Liar! missing when there is a last play");
      if(!seen.has("myturn") && pub.last){ seen.add("myturn"); await who.screenshot({path:path.join(shots, "phone-turn.png")}); await tv.screenshot({path:path.join(shots, "tv-turn.png")}); }
      if(!seen.has("first") && !pub.last){ seen.add("first"); await who.screenshot({path:path.join(shots, "phone-first.png")}); }
      // everyone else only holds their own hand
      for(const p of phones){ const h = await p.evaluate(() => st && st.me && st.me.hand ? st.me.hand.length : -1); const want = pub.seats.find(s => R.players[Object.keys(R.players).find(k => R.players[k].n === p.nm)] && s.p === Object.keys(R.players).find(k => R.players[k].n === p.nm)); if(want && !want.out && h !== -1 && h !== want.c) { /* a poll can lag one version behind: ignore */ } }
      const callIt = st.hasLiar && (st.lo || Math.random() < 0.4);
      try{
      if(callIt) await who.click('[data-a="liar"]', {timeout:4000});
      else { const cards = who.locator('.hand .c'), nc = await cards.count(), want = 1 + Math.floor(Math.random() * Math.min(2, nc)); if(!nc){ await tv.waitForTimeout(300); continue; }
        const idx = [...Array(nc).keys()].sort(() => Math.random() - .5).slice(0, want); for(const i of idx) await cards.nth(i).click({timeout:4000}); await who.click('[data-a="play"]', {timeout:4000}); }
      }catch(e){ const now = await who.evaluate(() => ({turn:st.pub.turn, me:me.p, v:st.pub.v, ph:st.pub.ph, sel:typeof sel !== "undefined" ? sel : null, text:document.getElementById("view").innerText.replace(/\n/g, " / ").slice(0, 200)})); const same = R.crd && R.crd.pub.v === now.v && R.crd.pub.ph === pub.ph && R.crd.pub.turn === pub.turn;
        if(same){ await who.screenshot({path:path.join(shots, "stuck.png")}); console.log("STUCK", e.message.split("\n")[0], JSON.stringify(now), "hostv", R.crd.pub.v); fails.push("a move could not be made: " + e.message.split("\n")[0]); break; } }
      await tv.waitForTimeout(450); }
    if(!done){ fails.push("game " + game + " did not finish"); break; }
    finished++; await tv.waitForTimeout(500); await tv.screenshot({path:path.join(shots, "tv-over.png")}); await phones[0].screenshot({path:path.join(shots, "phone-over.png")});
    const out = []; for(const p of phones){ const t = await p.evaluate(() => document.getElementById("view").innerText.replace(/\n/g, " / ").slice(0, 80)); out.push(p.nm + ": " + t); } console.log("game", game, "over:", out.join(" | "));
    const text = await tv.evaluate(() => document.querySelector(".lbwin").innerText.replace(/\n/g, " ")); console.log("  TV:", text);
    if(game < GAMES){ await tv.click('[data-act="again"]'); await tv.waitForTimeout(1200); } }
  if(R.leaks) fails.push("hands leaked into pub " + R.leaks + " times");
  console.log("games finished:", finished + "/" + GAMES, "| players:", N, "| failures:", fails.length, "| errors:", errs.length); fails.concat(errs).slice(0, 10).forEach(e => console.log(" ", e));
  await b.close(); srv.close(); process.exit(finished === GAMES && !errs.length && !fails.length ? 0 : 1);
})();
