// 6.83 (adapted from tarneeb-e2e.js): plays whole Decrypto games in a headless browser against a small in-memory copy of the relay (worker/index.js): one TV page and six phone pages
// (three per team) that type clues, pick numbers and press Lock.   NODE_PATH=$(npm root -g) node v4work/tools/decrypto-e2e.js [shotsDir] [games]
// It needs a built index.html (node build.js). Screenshots of the TV and some phones go to shotsDir (default: ./_dec-shots).
const http = require("http"), fs = require("fs"), path = require("path"), {chromium} = require("playwright");
const root = path.resolve(__dirname, "../.."), shots = path.resolve(process.argv[2] || "_dec-shots"), games = +process.argv[3] || 1; fs.mkdirSync(shots, {recursive:true});
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
process.on("unhandledRejection", e => { console.log("ERR", e.message.split("\n")[0], (e.stack.match(/decrypto-e2e.js:\d+/) || [])[0]); process.exit(1); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = "http://localhost:" + srv.address().port, errs = [];
  const fast = () => { const si = window.setInterval, st = window.setTimeout; window.setInterval = (f, t, ...a) => si(f, t > 500 ? t / 5 : t, ...a); window.setTimeout = (f, t, ...a) => st(f, t > 1000 ? t / 5 : t, ...a); };
  const b = await chromium.launch(), tvc = await b.newContext({viewport:{width:1920, height:1080}}), tv = await tvc.newPage();
  tv.on("pageerror", e => errs.push("TV " + e.message)); tv.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push("TV " + m.text()); });
  await tv.addInitScript(fast); if(process.env.TIE) await tv.addInitScript(() => { try{ localStorage.setItem("jn_decCfg", JSON.stringify({rounds:6})); }catch(e){} }); await tv.route(/^(?!http:\/\/localhost)/, r => r.abort());
  await tv.goto(base + "/index.html"); await tv.waitForTimeout(500); await tv.click("#modeDec"); await tv.waitForTimeout(1200);
  await tv.screenshot({path:path.join(shots, "tv-lobby-empty.png")});
  const phones = [], names = ["Mona", "Karim", "Youssef", "Nour", "Salma", "Omar"];
  for(let i = 0; i < names.length; i++){
    const c = await b.newContext({viewport:{width:390, height:800}, isMobile:true, hasTouch:true}), p = await c.newPage();
    p.on("pageerror", e => errs.push(names[i] + " " + e.message)); p.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push(names[i] + " " + m.text()); });
    await p.addInitScript(fast); await p.route(/^(?!http:\/\/localhost)/, r => r.abort());
    await p.goto(`${base}/dec.html?r=${R.room}`); if(i === 0) await p.screenshot({path:path.join(shots, "phone-join.png")});
    await p.fill("#nm", names[i]); await p.click(`.tbtn[data-t="${i % 2}"]`); await p.waitForTimeout(300); phones.push(p); }
  await tv.waitForTimeout(1500); await tv.screenshot({path:path.join(shots, "tv-lobby.png")}); await phones[0].screenshot({path:path.join(shots, "phone-lobby.png")});
  // a player moves teams from the TV, then back: the phone must learn it
  await tv.click('[data-move]:has-text("Mona")'); await tv.waitForTimeout(1500);
  let teams = Object.values(R.players).map(x => x.t).join(""); if(teams === "010101") { console.log("MOVE FAILED", teams); process.exit(1); }
  await tv.screenshot({path:path.join(shots, "tv-lobby-moved.png")}); await phones[0].screenshot({path:path.join(shots, "phone-lobby-moved.png")}); await tv.click('[data-move]:has-text("Mona")'); await tv.waitForTimeout(1500);
  const codes = [null, null], words = [null, null], seen = new Set(), did = new Set(); let done = false, finished = 0, acts = {clues:0, guess:0, tie:0}, rounds = 0;
  for(let game = 1; game <= games; game++){
    await tv.click("#dcGo"); await tv.waitForTimeout(1500); done = false;
    for(let tick = 0; tick < 6000 && !done; tick++){
      if(await tv.locator(".dcwrap.over").count()){ done = true; break; }
      const priv = R.crd && R.crd.priv || {}; Object.values(priv).forEach(v => { if(v) words[v.team] = v.words; if(v && v.code && v.enc) codes[v.team] = v.code; });
      if(await tv.locator('[data-act="next"]').count()){ const k = "reveal" + (R.crd.pub.round) + R.crd.pub.turn; if(!seen.has("reveal")){ seen.add("reveal"); await tv.screenshot({path:path.join(shots, "tv-reveal.png")}); await phones[0].screenshot({path:path.join(shots, "phone-reveal.png")}); } rounds++; await tv.click('[data-act="next"]'); await tv.waitForTimeout(250); continue; }
      let acted = false;
      for(let i = 0; i < phones.length && !acted; i++){ const p = phones[i];
        const s = await p.evaluate(() => st && st.pub && st.me ? {pub:st.pub, me:st.me, busy:sending} : null); if(!s || s.busy) continue; const pub = s.pub, m = s.me, t = m.team, ck = i + ":" + pub.phase + pub.round + pub.turn; if(did.has(ck)) continue;
        const shot = async name => { if(!seen.has(name)){ seen.add(name); await p.screenshot({path:path.join(shots, "phone-" + name + ".png")}); await tv.screenshot({path:path.join(shots, "tv-" + name + ".png")}); } };
        try{
          if(pub.phase === "write" && m.enc && !pub.sent[t]){ await shot("write"); for(let k = 0; k < 3; k++) await p.fill(`input[data-k=c${k}]`, ["Dad's favourite", "seen on holiday", "makes noise", "very old", "round and shiny"][(k + pub.round) % 5], {timeout:2500}); await p.click("#sc", {timeout:2500}); acts.clues++; acted = true; }
          else if(pub.phase === "guess"){ const own = pub.turn === t; if((own && m.enc) || (!own && pub.round === 1)) continue; if((own ? pub.locks.own : pub.locks.opp)) continue;
            await shot(own ? "guess-own" : "guess-intercept"); const code = codes[pub.turn], good = process.env.TIE ? own : Math.random() < (own ? .65 : .3), pick = good && code ? code : process.env.TIE && code ? [code[1], code[0], code[2]] : [1, 2, 3, 4].sort(() => Math.random() - .5).slice(0, 3);
            for(let k = 0; k < 3; k++) await p.click(`.pk[data-i="${k}"] button[data-n="${pick[k]}"]`, {timeout:2500}); await p.click("#lk", {timeout:2500}); acts.guess++; acted = true; }
          else if(pub.phase === "tie" && !pub.tie[t]){ await shot("tie"); const opp = words[1 - t] || []; for(let k = 0; k < 4; k++) await p.fill(`input[data-k=w${k}]`, Math.random() < .3 ? opp[k] : "nothing"); await p.click("#tb"); acts.tie++; acted = true; }
        }catch(e){ const now = await p.evaluate(() => st && st.pub ? [st.pub.phase, st.pub.round, st.pub.turn].join(":") : ""); if(now !== [pub.phase, pub.round, pub.turn].join(":") || (pub.phase === "guess" && !(await p.locator("#lk").count()))) continue;   // the table moved on while this phone was about to click: fine
          await p.screenshot({path:path.join(shots, "stuck.png")}); console.log("STUCK", pub.phase, e.message.split("\n")[0]); process.exit(1); }
        if(acted){ did.add(ck); await p.waitForTimeout(60); } }
      if(!acted) await tv.waitForTimeout(120);
      if(R.crd && R.crd.pub.phase === "write" && R.crd.pub.round === 2 && !seen.has("tvwrite")){ seen.add("tvwrite"); await tv.screenshot({path:path.join(shots, "tv-write.png")}); }
      if(R.crd && R.crd.pub.phase === "guess" && R.crd.pub.round === 3 && !seen.has("tvguess")){ seen.add("tvguess"); await tv.waitForTimeout(500); await tv.screenshot({path:path.join(shots, "tv-guess.png")}); } }
    if(done){ finished++; if(game === 1){ await tv.waitForTimeout(800); await tv.screenshot({path:path.join(shots, "tv-over.png")}); await phones[0].screenshot({path:path.join(shots, "phone-over.png")}); }
      if(game < games){ await tv.click("#dcAgain"); await tv.waitForTimeout(1500); R.acts.length = 0; } } else break; }
  console.log(finished === games ? `${games} game(s) finished` : "GAME DID NOT FINISH", "| acts:", JSON.stringify(acts), "| reveals:", rounds, "| errors:", errs.length); errs.slice(0, 8).forEach(e => console.log(" ", e));
  await b.close(); srv.close(); process.exit(finished === games && !errs.length ? 0 : 1);
})();
