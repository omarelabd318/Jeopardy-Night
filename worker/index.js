// 5.9: a tiny relay so phones can send answers to the game on the laptop.
// The game and phone page are static files (served from dist/); only /api/* reaches this code.
// Each game has a room code; every room is one Durable Object holding that game's answers, wiped a day later.
//   GET  /api/ping                      -> {ok:true}            (the game checks this to know phone answers work)
//   POST /api/answer {r,c,t,v,k}        -> stores team t's answer v (k = "num" or "steal") for clue c in room r
//   GET  /api/answers?r=ROOM&c=CLUE     -> {closed, answers:{t:{v,k,at}}}
//   POST /api/close {r,c}               -> the clue was revealed; later answers are refused
//   POST /api/meta {r,c,m}              -> 5.18: the clue's details for the phone page (teams, category, value, unit, who's playing)
//   GET  /api/meta?r=ROOM&c=CLUE        -> {m}
//   GET  /a?r=ROOM&c=CLUE               -> 5.18: the phone answer page (answer.html) at a short address, so the QR code is less dense
// 5.26 free-for-all: every player joins once on their own phone (play.html at /p?r=ROOM) and answers each clue from there.
//   POST /api/join {r,p,n}              -> player p (a random id the phone keeps) joins with name n
//   GET  /api/players?r=ROOM            -> {players:[{p,n,at}]} in join order
//   POST /api/cur {r,cur?,s?}           -> the game's current clue ({c,kind,cat,val,q,u,ev} or null) and/or everyone's scores {p:score}
//   GET  /api/state?r=ROOM&p=PLAYER     -> what the phone needs: {cur, closed, mine, score, rank, n, name}
//   6.68: Imposter. POST /api/imp {r,imp:{round,phase,first,cards:{player:card},reveal?}} deals a round; GET /api/impcard?r&p -> only that player's card;
//   POST /api/kick {r,p} removes a player. The phone page is /s (spy.html).
//   6.72: Psych. The laptop posts the whole round as POST /api/psy {r,psy:{pub,priv}} (pub = what the phones may see, priv = the real answer's spellings and the ready-made fakes,
//   never sent to a phone). Phones: GET /api/psystate?r&p -> the round for that player (options carry only a "mine" flag); POST /api/psyfake {r,p,c,v}, /api/psylie {r,p,c} ("Lie for me":
//   the room hands out the next ready-made fake), /api/psyvote {r,p,c,o}. The laptop reads everyone's fakes and votes with GET /api/psyget?r&c. The phone page is /y (psych.html).
//   Answers use /api/answer with k "ffa" and t = the player id.
// 5.27: team games use the same page. A team's phones join once with their team number t, and /api/cur also carries
//   mode ("ffa" or "teams") and the team names; /api/state?r&p&t answers for that team. The first answer a player
//   (or team) sends is final, and the team that's playing a tile can't send a steal for it.
import { DurableObject } from "cloudflare:workers";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const ROOM = /^[A-Za-z0-9]{6,16}$/, CLUE = /^[A-Za-z0-9_.:-]{1,80}$/;

export class Room extends DurableObject {
  async fetch(req) {
    const url = new URL(req.url), op = url.pathname.split("/").pop(), st = this.ctx.storage;
    if (!(await st.getAlarm())) await st.setAlarm(Date.now() + 24 * 3600e3);
    if (op === "meta" && req.method === "GET") return json({ m: (await st.get("m:" + url.searchParams.get("c"))) || null });
    if (op === "answers") {
      const c = url.searchParams.get("c");
      const [answers, closed] = await Promise.all([st.get("a:" + c), st.get("x:" + c)]);
      return json({ closed: !!closed, answers: answers || {} });
    }
    if (op === "players") {
      const players = (await st.get("players")) || {};
      return json({ players: Object.entries(players).map(([p, v]) => ({ p, n: v.n, t: v.t, at: v.at })).sort((a, b) => a.at - b.at) });
    }
    if (op === "impcard") {
      const p = url.searchParams.get("p"), [players, imp] = await Promise.all([st.get("players"), st.get("imp")]);
      const me = (players || {})[p];
      if (!me) return json({ name: null });
      if (!imp || !imp.cards || !imp.cards[p]) return json({ name: me.n, round: imp ? imp.round : 0, phase: "wait" });
      return json({ name: me.n, round: imp.round, phase: imp.phase, first: imp.first, card: imp.cards[p], reveal: imp.phase === "reveal" ? imp.reveal || null : null, n: Object.keys(players).length });
    }
    if (op === "psystate") {
      const p = url.searchParams.get("p"), [players, psy, at, scores] = await Promise.all([st.get("players"), st.get("psy"), st.get("psyat"), st.get("psys")]);
      const me = (players || {})[p];
      if (!me) return json({ name: null });
      if (!psy || !psy.pub) return json({ name: me.n, phase: "wait" });
      const pub = psy.pub, c = pub.c, [pf, pv] = await Promise.all([st.get("pf:" + c), st.get("pv:" + c)]);
      const sc = pub.scores || {}, mine = sc[p] ?? 0, left = pub.secs == null ? null : Math.max(0, Math.round(pub.secs - (Date.now() - (at || Date.now())) / 1000));
      const f = (pf || {})[p] || null;
      return json({ name: me.n, phase: pub.phase, c, round: pub.round, nth: pub.nth, of: pub.of, fool: pub.fool, truth: pub.truth, q: pub.q, left, secs: pub.secs ?? null,
        options: pub.phase === "vote" ? (pub.options || []).map(o => ({ id: o.id, t: o.t, mine: (o.by || []).includes(p) })) : null,
        fake: f ? { v: f.v, lie: !!f.lie } : null, vote: ((pv || {})[p]) || null, score: mine, rank: 1 + Object.values(sc).filter(v => v > mine).length, n: Object.keys(sc).length || Object.keys(players || {}).length,
        delta: (pub.deltas || {})[p] ?? null, answer: pub.phase === "reveal" || pub.phase === "scores" ? pub.answer || null : null });
    }
    if (op === "psyget") {
      const c = url.searchParams.get("c"), [players, pf, pv, lc] = await Promise.all([st.get("players"), st.get("pf:" + c), st.get("pv:" + c), st.get("pl:" + c)]);
      return json({ players: Object.entries(players || {}).map(([p, v]) => ({ p, n: v.n, at: v.at })).sort((a, b) => a.at - b.at), fakes: pf || {}, votes: pv || {}, lies: lc || 0 });
    }
    if (op === "state") {
      const p = url.searchParams.get("p"), [players, cur, s, mode, teams, fb] = await Promise.all([st.get("players"), st.get("cur"), st.get("s"), st.get("mode"), st.get("teams"), st.get("fb")]);
      const me = (players || {})[p], scores = s || {}, team = mode === "teams" && me && me.t != null ? me.t : null;
      const key = team != null ? "t" + team : p, mineKey = team != null ? String(team) : p, mine = scores[key] ?? 0;
      const rivals = Object.entries(scores).filter(([k]) => /^t\d+$/.test(k) === (team != null)).map(([, v]) => v);
      const out = { mode: mode || "ffa", fb: !!fb, teams: teams || [], team, cur: cur || null, name: me ? me.n : null, n: rivals.length || Object.keys(players || {}).length,
        score: mine, rank: 1 + rivals.filter(v => v > mine).length, closed: false, mine: null };
      if (cur) { const [a, x] = await Promise.all([st.get("a:" + cur.c), st.get("x:" + cur.c)]); out.closed = !!x; out.mine = a && a[mineKey] ? a[mineKey].v : null; }
      return json(out);
    }
    const b = await req.json();
    if (op === "meta") { await st.put("m:" + b.c, b.m); return json({ ok: true }); }
    if (op === "close") { await st.put("x:" + b.c, true); return json({ ok: true }); }
    if (op === "answer") {
      if (await st.get("x:" + b.c)) return json({ ok: false, error: "closed" }, 409);
      const cur = await st.get("cur");
      if (b.k === "ffa" && (!cur || cur.c !== b.c)) return json({ ok: false, error: "closed" }, 409);
      if (b.k === "steal" && cur && cur.c === b.c && cur.x === b.t) return json({ ok: false, error: "playing" }, 409);
      const answers = (await st.get("a:" + b.c)) || {};
      if (answers[b.t]) return json({ ok: false, error: "locked", v: answers[b.t].v }, 409);  // 5.27 (Omar): an answer can't be changed
      answers[b.t] = { v: b.v, k: b.k, at: Date.now() };
      await st.put("a:" + b.c, answers);
      return json({ ok: true });
    }
    if (op === "join") {
      const players = (await st.get("players")) || {};
      if (!players[b.p] && Object.keys(players).length >= 30) return json({ ok: false, error: "full" }, 409);
      players[b.p] = { n: b.n, t: b.t, at: players[b.p] ? players[b.p].at : Date.now() };
      await st.put("players", players);
      return json({ ok: true });
    }
    if (op === "psy") { await Promise.all([st.put("psy", b.psy), st.put("psyat", Date.now()), b.psy.pub && b.psy.pub.scores ? st.put("psys", b.psy.pub.scores) : Promise.resolve()]); return json({ ok: true }); }
    if (op === "psyfake" || op === "psylie" || op === "psyvote") {
      const [players, psy] = await Promise.all([st.get("players"), st.get("psy")]), pub = psy && psy.pub;
      if (!(players || {})[b.p]) return json({ ok: false, error: "unknown" }, 409);
      if (!pub || pub.c !== b.c || pub.phase !== (op === "psyvote" ? "vote" : "write")) return json({ ok: false, error: "closed" }, 409);
      if (op === "psyvote") {
        const votes = (await st.get("pv:" + b.c)) || {};
        if (votes[b.p]) return json({ ok: false, error: "locked", o: votes[b.p] }, 409);
        const o = (pub.options || []).find(x => x.id === b.o);
        if (!o) return json({ ok: false, error: "bad option" }, 400);
        if ((o.by || []).includes(b.p)) return json({ ok: false, error: "own" }, 409);
        votes[b.p] = b.o; await st.put("pv:" + b.c, votes); return json({ ok: true });
      }
      const fakes = (await st.get("pf:" + b.c)) || {};
      if (fakes[b.p]) return json({ ok: false, error: "locked", v: fakes[b.p].v }, 409);
      if (op === "psylie") {
        const lies = (psy.priv && psy.priv.lies) || [], used = (await st.get("pl:" + b.c)) || 0;
        if (used >= lies.length) return json({ ok: false, error: "none" }, 409);
        await st.put("pl:" + b.c, used + 1); fakes[b.p] = { v: lies[used], lie: true, at: Date.now() };
        await st.put("pf:" + b.c, fakes); return json({ ok: true, v: lies[used] });
      }
      const norm = x => String(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "").replace(/^(the|a|an)(?=.)/, "");
      if (((psy.priv && psy.priv.ans) || []).includes(norm(b.v))) return json({ ok: false, error: "truth" }, 409);
      fakes[b.p] = { v: b.v, lie: false, at: Date.now() }; await st.put("pf:" + b.c, fakes); return json({ ok: true });
    }
    if (op === "imp") { await st.put("imp", b.imp); return json({ ok: true }); }
    if (op === "kick") {
      const players = (await st.get("players")) || {};
      delete players[b.p]; await st.put("players", players);
      return json({ ok: true });
    }
    if (op === "cur") {
      if ("cur" in b) await st.put("cur", b.cur);
      if (b.s) await st.put("s", b.s);
      if (b.mode) await st.put("mode", b.mode);
      if ("fb" in b) await st.put("fb", b.fb);   // 5.46: Football mode, so the phones turn green too
      if (b.teams) await st.put("teams", b.teams);
      return json({ ok: true });
    }
    return json({ ok: false }, 404);
  }
  async alarm() { await this.ctx.storage.deleteAll(); }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/y") return env.ASSETS.fetch(new Request(new URL("/psych" + url.search, url), req));  // 6.72: Psych phone page
    if (url.pathname === "/s") return env.ASSETS.fetch(new Request(new URL("/spy" + url.search, url), req));  // 6.68: Imposter phone page
    if (url.pathname === "/a") return env.ASSETS.fetch(new Request(new URL("/answer" + url.search, url), req));
    if (url.pathname === "/p") return env.ASSETS.fetch(new Request(new URL("/play" + url.search, url), req));  // 5.26: free-for-all phone page
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    const op = url.pathname.slice(5);
    if (op === "ping") return json({ ok: true });
    const room = r => env.ROOMS.get(env.ROOMS.idFromName(r));
    if (req.method === "GET" && ["answers", "meta", "players", "state", "impcard", "psystate", "psyget"].includes(op)) {
      const r = url.searchParams.get("r"), c = url.searchParams.get("c"), p = url.searchParams.get("p");
      if (!ROOM.test(r || "")) return json({ ok: false, error: "bad room" }, 400);
      if ((op === "answers" || op === "meta" || op === "psyget") && !CLUE.test(c || "")) return json({ ok: false, error: "bad clue" }, 400);
      if ((op === "state" || op === "impcard" || op === "psystate") && !ROOM.test(p || "")) return json({ ok: false, error: "bad player" }, 400);
      return room(r).fetch(new Request("https://room/" + op + "?" + new URLSearchParams(op === "state" || op === "impcard" || op === "psystate" ? { p } : { c: c || "" })));
    }
    if (req.method !== "POST" || !["answer", "close", "meta", "join", "cur", "imp", "kick", "psy", "psyfake", "psylie", "psyvote"].includes(op)) return json({ ok: false }, 404);
    let b; try { b = await req.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
    const r = b.r, c = b.c;
    if (!ROOM.test(r || "")) return json({ ok: false, error: "bad room" }, 400);
    if (["answer", "close", "meta"].includes(op) && !CLUE.test(c || "")) return json({ ok: false, error: "bad clue" }, 400);
    if (op === "answer") {
      const ffa = b.k === "ffa", v = String(b.v ?? "").trim().slice(0, 200), k = ffa ? "ffa" : b.k === "steal" ? "steal" : "num";
      const t = ffa ? String(b.t || "") : Number(b.t);
      if (!v || (ffa ? !ROOM.test(t) : !Number.isInteger(t) || t < 0 || t > 11)) return json({ ok: false, error: "bad answer" }, 400);
      b = { c, t, v, k };
    } else if (op === "meta") {
      const m = b.m && typeof b.m === "object" ? b.m : null;
      if (!m || JSON.stringify(m).length > 2000) return json({ ok: false, error: "bad meta" }, 400);
      b = { c, m };
    } else if (op === "join") {
      const p = String(b.p || ""), n = String(b.n ?? "").trim().replace(/\s+/g, " ").slice(0, 24), t = b.t == null ? null : Number(b.t);
      if (!ROOM.test(p) || !n || (t !== null && (!Number.isInteger(t) || t < 0 || t > 11))) return json({ ok: false, error: "bad player" }, 400);
      b = { p, n, t };
    } else if (op === "imp") {
      const i = b.imp;
      if (!i || typeof i !== "object" || JSON.stringify(i).length > 24000 || !i.cards || typeof i.cards !== "object") return json({ ok: false, error: "bad deal" }, 400);
      b = { imp: i };
    } else if (op === "psy") {
      const i = b.psy;
      if (!i || typeof i !== "object" || JSON.stringify(i).length > 24000 || !i.pub || typeof i.pub !== "object" || !CLUE.test(i.pub.c || "")) return json({ ok: false, error: "bad round" }, 400);
      b = { psy: i };
    } else if (op === "psyfake" || op === "psylie" || op === "psyvote") {
      const p = String(b.p || ""), cc = String(b.c || ""), v = String(b.v ?? "").trim().replace(/\s+/g, " ").slice(0, 40), o = String(b.o ?? "").slice(0, 8);
      if (!ROOM.test(p) || !CLUE.test(cc) || (op === "psyfake" && !v) || (op === "psyvote" && !o)) return json({ ok: false, error: "bad request" }, 400);
      b = { p, c: cc, v, o };
    } else if (op === "kick") {
      const p = String(b.p || "");
      if (!ROOM.test(p)) return json({ ok: false, error: "bad player" }, 400);
      b = { p };
    } else if (op === "cur") {
      const out = {};
      if ("cur" in b) { if (b.cur !== null && (typeof b.cur !== "object" || !CLUE.test(b.cur.c || "") || JSON.stringify(b.cur).length > 4000)) return json({ ok: false, error: "bad clue" }, 400); out.cur = b.cur; }
      if (b.s) { if (typeof b.s !== "object" || JSON.stringify(b.s).length > 4000) return json({ ok: false, error: "bad scores" }, 400); out.s = b.s; }
      if (b.mode) out.mode = b.mode === "teams" ? "teams" : "ffa";
      if ("fb" in b) out.fb = !!b.fb;
      if (b.teams) { if (!Array.isArray(b.teams) || b.teams.length > 12) return json({ ok: false, error: "bad teams" }, 400); out.teams = b.teams.map(x => String(x).slice(0, 24)); }
      b = out;
    } else b = { c };
    return room(r).fetch(new Request("https://room/" + op, { method: "POST", body: JSON.stringify(b) }));
  }
};
