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
import { DurableObject } from "cloudflare:workers";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const ROOM = /^[A-Za-z0-9]{6,16}$/, CLUE = /^[A-Za-z0-9_.:-]{1,80}$/;

export class Room extends DurableObject {
  async fetch(req) {
    const url = new URL(req.url), op = url.pathname.split("/").pop();
    if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 24 * 3600e3);
    if (op === "meta" && req.method === "GET") return json({ m: (await this.ctx.storage.get("m:" + url.searchParams.get("c"))) || null });
    if (op === "answers") {
      const c = url.searchParams.get("c");
      const [answers, closed] = await Promise.all([this.ctx.storage.get("a:" + c), this.ctx.storage.get("x:" + c)]);
      return json({ closed: !!closed, answers: answers || {} });
    }
    const b = await req.json();
    if (op === "meta") { await this.ctx.storage.put("m:" + b.c, b.m); return json({ ok: true }); }
    if (op === "close") { await this.ctx.storage.put("x:" + b.c, true); return json({ ok: true }); }
    if (op === "answer") {
      if (await this.ctx.storage.get("x:" + b.c)) return json({ ok: false, error: "closed" }, 409);
      const answers = (await this.ctx.storage.get("a:" + b.c)) || {};
      answers[b.t] = { v: b.v, k: b.k, at: Date.now() };
      await this.ctx.storage.put("a:" + b.c, answers);
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
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(req);
    const op = url.pathname.slice(5);
    if (op === "ping") return json({ ok: true });
    let r, c;
    if ((op === "answers" || op === "meta") && req.method === "GET") { r = url.searchParams.get("r"); c = url.searchParams.get("c"); }
    else if ((op === "answer" || op === "close" || op === "meta") && req.method === "POST") {
      let b; try { b = await req.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
      r = b.r; c = b.c;
      if (op === "answer") {
        const t = Number(b.t), v = String(b.v ?? "").trim().slice(0, 200), k = b.k === "steal" ? "steal" : "num";
        if (!Number.isInteger(t) || t < 0 || t > 11 || !v) return json({ ok: false, error: "bad answer" }, 400);
        b = { c, t, v, k };
      } else if (op === "meta") {
        const m = b.m && typeof b.m === "object" ? b.m : null;
        if (!m || JSON.stringify(m).length > 2000) return json({ ok: false, error: "bad meta" }, 400);
        b = { c, m };
      } else b = { c };
      if (!ROOM.test(r || "") || !CLUE.test(c || "")) return json({ ok: false, error: "bad room" }, 400);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(r));
      return stub.fetch(new Request("https://room/" + op, { method: "POST", body: JSON.stringify(b) }));
    } else return json({ ok: false }, 404);
    if (!ROOM.test(r || "") || !CLUE.test(c || "")) return json({ ok: false, error: "bad room" }, 400);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(r));
    return stub.fetch(new Request("https://room/" + op + "?c=" + encodeURIComponent(c)));
  }
};
