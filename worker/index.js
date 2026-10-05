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
//   Answers use /api/answer with k "ffa" and t = the player id.
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
      return json({ players: Object.entries(players).map(([p, v]) => ({ p, n: v.n, at: v.at })).sort((a, b) => a.at - b.at) });
    }
    if (op === "state") {
      const p = url.searchParams.get("p"), [players, cur, s] = await Promise.all([st.get("players"), st.get("cur"), st.get("s")]);
      const me = (players || {})[p], scores = s || {};
      const out = { cur: cur || null, name: me ? me.n : null, n: Object.keys(players || {}).length, score: scores[p] ?? 0,
        rank: 1 + Object.values(scores).filter(v => v > (scores[p] ?? 0)).length, closed: false, mine: null };
      if (cur) { const [a, x] = await Promise.all([st.get("a:" + cur.c), st.get("x:" + cur.c)]); out.closed = !!x; out.mine = a && a[p] ? a[p].v : null; }
      return json(out);
    }
    const b = await req.json();
    if (op === "meta") { await st.put("m:" + b.c, b.m); return json({ ok: true }); }
    if (op === "close") { await st.put("x:" + b.c, true); return json({ ok: true }); }
    if (op === "answer") {
      if (await st.get("x:" + b.c)) return json({ ok: false, error: "closed" }, 409);
      if (b.k === "ffa") { const cur = await st.get("cur"); if (!cur || cur.c !== b.c) return json({ ok: false, error: "closed" }, 409); }
      const answers = (await st.get("a:" + b.c)) || {};
      answers[b.t] = { v: b.v, k: b.k, at: Date.now() };
      await st.put("a:" + b.c, answers);
      return json({ ok: true });
    }
    if (op === "join") {
      const players = (await st.get("players")) || {};
      if (!players[b.p] && Object.keys(players).length >= 30) return json({ ok: false, error: "full" }, 409);
      players[b.p] = { n: b.n, at: players[b.p] ? players[b.p].at : Date.now() };
      await st.put("players", players);
      return json({ ok: true });
    }
    if (op === "cur") {
      if ("cur" in b) await st.put("cur", b.cur);
      if (b.s) await st.put("s", b.s);
      return json({ ok: true });
    }
    return json({ ok: false }, 404);
  }
  async alarm() { await this.ctx.storage.deleteAll(); }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/a") return env.ASSETS.fetch(new Request(new URL("/answer" + url.search, url), req));
    if (url.pathname === "/p") return env.ASSETS.fetch(new Request(new URL("/play" + url.search, url), req));  // 5.26: free-for-all phone page
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    const op = url.pathname.slice(5);
    if (op === "ping") return json({ ok: true });
    const room = r => env.ROOMS.get(env.ROOMS.idFromName(r));
    if (req.method === "GET" && ["answers", "meta", "players", "state"].includes(op)) {
      const r = url.searchParams.get("r"), c = url.searchParams.get("c"), p = url.searchParams.get("p");
      if (!ROOM.test(r || "")) return json({ ok: false, error: "bad room" }, 400);
      if ((op === "answers" || op === "meta") && !CLUE.test(c || "")) return json({ ok: false, error: "bad clue" }, 400);
      if (op === "state" && !ROOM.test(p || "")) return json({ ok: false, error: "bad player" }, 400);
      return room(r).fetch(new Request("https://room/" + op + "?" + new URLSearchParams(op === "state" ? { p } : { c: c || "" })));
    }
    if (req.method !== "POST" || !["answer", "close", "meta", "join", "cur"].includes(op)) return json({ ok: false }, 404);
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
      const p = String(b.p || ""), n = String(b.n ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
      if (!ROOM.test(p) || !n) return json({ ok: false, error: "bad player" }, 400);
      b = { p, n };
    } else if (op === "cur") {
      const out = {};
      if ("cur" in b) { if (b.cur !== null && (typeof b.cur !== "object" || !CLUE.test(b.cur.c || "") || JSON.stringify(b.cur).length > 4000)) return json({ ok: false, error: "bad clue" }, 400); out.cur = b.cur; }
      if (b.s) { if (typeof b.s !== "object" || JSON.stringify(b.s).length > 4000) return json({ ok: false, error: "bad scores" }, 400); out.s = b.s; }
      b = out;
    } else b = { c };
    return room(r).fetch(new Request("https://room/" + op, { method: "POST", body: JSON.stringify(b) }));
  }
};
