/* 6.79 (Omar): the shared card kit for the card modes (Estimation first; Tarneeb, 3-5-8 and Texas Hold'em are meant to reuse it). It is plain JavaScript with no
   dependencies, so build.js splices it into index.html (before the mode files) AND copies it to cards.js at the repo root, which the phone page cards.html loads.
   What's in it: card codes ("14S" = ace of spades, "10H" = ten of hearts), the deck, shuffle, sort, the trick winner, the card faces (drawn with CSS, no image files),
   the oval table with seats and the middle trick (the TV), and three looks: "felt" (Classic Felt, Estimation's pick), "ahwa" (the coffeehouse look Omar wants for Tarneeb) and "vegas" (6.100, Texas Hold'em: green felt, walnut and gold, red card backs).
   7.2 also adds a four-colour deck switch: data-four on the .ckw wrapper makes diamonds blue and clubs green.
   A look is only a set of CSS variables on a wrapper with data-look="felt|ahwa", so adding a look never touches the layout.
   To remove: delete this file, cards.html, the cards.js copy line in build.js and the /c route in worker/index.js (and the modes that use it). */
const CK = (() => {
  const SUITS = ["S", "H", "C", "D"], SYM = {S:"♠", H:"♥", D:"♦", C:"♣", N:"NT"}, RED = {H:1, D:1}, RANKS = {11:"J", 12:"Q", 13:"K", 14:"A"};
  const code = (r, s) => r + s, rank = c => parseInt(c, 10), suit = c => c.slice(-1), label = r => RANKS[r] || String(r);
  const deck = () => { const d = []; SUITS.forEach(s => { for(let r = 2; r <= 14; r++) d.push(code(r, s)); }); return d; };
  const shuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sort = h => h.slice().sort((a, b) => SUITS.indexOf(suit(a)) - SUITS.indexOf(suit(b)) || rank(b) - rank(a));   // spades, hearts, clubs, diamonds: the colours alternate; high cards first
  /* plays = [{c:"14S"}, ...] in the order played; trump = a suit letter or null. Returns the index of the winning play. */
  const trickWinner = (plays, trump) => { const led = suit(plays[0].c); let best = 0;
    plays.forEach((p, i) => { if(!i) return; const b = plays[best].c, s = suit(p.c), bs = suit(b);
      if(s === bs ? rank(p.c) > rank(b) : (trump && s === trump && bs !== trump)) best = i; });
    return best; };
  const face = (c, cls = "", sty = "") => { const s = suit(c); return `<div class="ck${RED[s] ? " red" : ""}${cls ? " " + cls : ""}" data-c="${c}"${sty ? ` style="${sty}"` : ""}><i class="r">${label(rank(c))}<b>${SYM[s]}</b></i><i class="m">${SYM[s]}</i></div>`; };
  /* 7.79 (Omar): a card played to the table slides in from the seat of the player who played it, and only the new card moves (before, every card
     in the trick replayed a small drop from above on each redraw). fly(scope, codes) remembers when each card first showed up; it returns c => [class, style]
     for the card, with a negative delay so a redraw mid-flight carries on instead of starting again. The direction comes from the card's seat class
     (.s .n .e .w) in the .cktrick rules below. */
  const flown = {}, FLY = 500;
  const fly = (scope, codes) => { const m = flown[scope] || (flown[scope] = {}), now = Date.now();
    Object.keys(m).forEach(c => { if(!codes.includes(c)) delete m[c]; }); codes.forEach(c => { if(!(c in m)) m[c] = now; });
    return c => { const t = now - (m[c] || 0); return t < FLY ? [" fly", `animation-delay:-${t}ms`] : ["", ""]; }; };
  const back = (cls = "") => `<div class="ck back${cls ? " " + cls : ""}"></div>`;
  /* the table: seats 0..3 run counter-clockwise from the bottom (bottom, right, top, left), like the order of play. */
  const POS = ["s", "e", "n", "w"];
  const css = `
.ckw{--ck-felt:#0f6a3c;--ck-felt2:#0a4d2b;--ck-felt3:#16884e;--ck-rail:#3a1e10;--ck-gold:#d8b45a;--ck-card:#fff;--ck-red:#c8102e;--ck-blk:#111;--ck-plate:#111;--ck-plate-ink:#fff;--ck-ink:#fff;--ck-side:#101010;--ck-sc:#1d1d1d;--ck-back:#14407a;--ck-back2:#d8b45a;--ck-bg:#0b1d14;--ck-disp:"Playfair Display",Georgia,serif;--ck-turn:#d8b45a;--ck-turn-ink:#111;--ck-lead:#0f6a3c}
.ckw[data-look=ahwa]{--ck-felt:#e9e2d4;--ck-felt2:#d4cab6;--ck-felt3:#f4efe4;--ck-rail:#6b4128;--ck-gold:#c9a04f;--ck-card:#fbf6ea;--ck-red:#a3252b;--ck-blk:#1d1814;--ck-plate:#4a2c1a;--ck-plate-ink:#fbf6ea;--ck-ink:#fbf6ea;--ck-side:#2a190f;--ck-sc:rgba(201,160,79,.14);--ck-back:#1f5e5b;--ck-back2:#c9a04f;--ck-bg:#2a190f;--ck-disp:"Reem Kufi","Playfair Display",Georgia,serif;--ck-turn:#1f5e5b;--ck-turn-ink:#fbf6ea;--ck-lead:#c9a04f}
.ckw[data-look=vegas]{--ck-felt:#1b8a50;--ck-felt2:#0b4a2c;--ck-felt3:#2a9d5f;--ck-rail:#5b2f17;--ck-gold:#e8c25a;--ck-card:#fff;--ck-red:#d32f2f;--ck-blk:#1a1a1a;--ck-plate:rgba(20,10,5,.88);--ck-plate-ink:#f6ecd6;--ck-ink:#f6ecd6;--ck-side:#170b06;--ck-sc:rgba(232,194,90,.12);--ck-back:#a3151f;--ck-back2:#c52a33;--ck-bg:#170b06;--ck-disp:"Barlow","Playfair Display",Georgia,sans-serif;--ck-turn:#e8c25a;--ck-turn-ink:#2a1607;--ck-lead:#8a6a2c}
.ckw[data-four] .ck[data-c$="D"]{color:#1e6bd6}.ckw[data-four] .ck[data-c$="C"]{color:#1f8a3b}
.ck{display:inline-block;width:3.6em;aspect-ratio:5/7;border-radius:.45em;position:relative;background:var(--ck-card);color:var(--ck-blk);font:700 1em/1 var(--ck-disp);box-shadow:0 .1em .3em rgba(0,0,0,.4);flex:none;user-select:none}
.ck.red{color:var(--ck-red)}
.ck .r{position:absolute;left:.28em;top:.26em;font-style:normal;font-size:.95em;display:flex;flex-direction:column;align-items:center;gap:.04em}
.ck .r b{font-size:.8em;font-weight:700}
.ck .m{position:absolute;inset:0;display:grid;place-items:center;font-style:normal;font-size:2em;padding-top:.3em}
.ck.back{background:repeating-linear-gradient(45deg,var(--ck-back) 0 .28em,var(--ck-back2) .28em .36em);border:.2em solid var(--ck-card)}
.ck.off{filter:brightness(.55) saturate(.6)}
.ck.glow{box-shadow:0 0 0 .14em var(--ck-gold),0 0 .9em var(--ck-gold)}
@keyframes ckin{from{opacity:0;transform:translateY(-1.2em) scale(.9)}}
.ck.in{animation:ckin .35s ease-out}
@media(prefers-reduced-motion:reduce){.ck.in{animation:none}}
.ckt{container-type:size;position:relative;width:100%;height:100%;min-height:0}
.cktin{--u:min(1cqw,1.36cqh);position:absolute;inset:0;font-size:calc(var(--u)*1.9)}
.ckfelt{position:absolute;inset:9% 6% 10% 6%;border-radius:50%/46%;background:radial-gradient(ellipse at 50% 45%,var(--ck-felt3),var(--ck-felt) 52%,var(--ck-felt2));border:calc(var(--u)*1.5) solid var(--ck-rail);box-shadow:0 0 0 calc(var(--u)*.3) var(--ck-gold),inset 0 0 calc(var(--u)*5) rgba(0,0,0,.4)}
.ckseat{position:absolute;z-index:3;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:calc(var(--u)*.4)}
.ckseat.s{left:50%;top:92%}.ckseat.n{left:50%;top:8%}.ckseat.w{left:9.5%;top:50%}.ckseat.e{left:90.5%;top:50%}
.ckplate{font:700 calc(var(--u)*1.8)/1 var(--ck-disp);padding:calc(var(--u)*.55) calc(var(--u)*1.4);border-radius:calc(var(--u)*.8);background:var(--ck-plate);color:var(--ck-plate-ink);border:calc(var(--u)*.2) solid var(--ck-gold);display:flex;gap:calc(var(--u)*.8);align-items:center;white-space:nowrap}
.ckplate .tag{font:700 calc(var(--u)*1.05)/1 var(--ck-disp);letter-spacing:.06em;text-transform:uppercase;padding:calc(var(--u)*.2) calc(var(--u)*.55);border-radius:calc(var(--u)*.4);background:var(--ck-gold);color:#111}
.ckseat.turn .ckplate{background:var(--ck-turn);color:var(--ck-turn-ink);animation:ckpulse 1.4s ease-in-out infinite}
@keyframes ckpulse{50%{filter:brightness(1.3)}}
@media(prefers-reduced-motion:reduce){.ckseat.turn .ckplate{animation:none}}
.ckmeta{font:600 calc(var(--u)*1.35)/1.1 var(--ck-disp);display:flex;gap:calc(var(--u)*.7);align-items:center;white-space:nowrap;color:var(--ck-ink);text-shadow:0 0 calc(var(--u)*.5) rgba(0,0,0,.7)}
.ckseat.n .ckmeta{color:var(--ck-ink)}
.ckpips{display:flex;gap:calc(var(--u)*.3)}.ckpips i{width:calc(var(--u)*.95);height:calc(var(--u)*.95);border-radius:50%;border:calc(var(--u)*.15) solid var(--ck-gold);display:block}.ckpips i.on{background:var(--ck-gold)}
.ckfan{display:flex;font-size:calc(var(--u)*.7)}.ckfan .ck{margin-left:-2.4em}.ckfan .ck:first-child{margin-left:0}
/* 7.37: trick cards 40% bigger so they read from the sofa (was a 27u box at 1.9u) */
.cktrick{position:absolute;left:50%;top:50%;width:calc(var(--u)*36);height:calc(var(--u)*36);transform:translate(-50%,-50%);z-index:2;font-size:calc(var(--u)*2.65)}
.cktrick .ck{position:absolute}
.cktrick .s{left:50%;bottom:4%;transform:translateX(-50%) rotate(3deg)}.cktrick .n{left:50%;top:4%;transform:translateX(-50%) rotate(-4deg)}
.cktrick .e{right:2%;top:50%;transform:translateY(-50%) rotate(8deg)}.cktrick .w{left:2%;top:50%;transform:translateY(-50%) rotate(-7deg)}
/* 7.79: the fly-in from each seat. It moves the separate translate/scale properties, so the card's own rotate stays put. Was: every trick card had
   class "in" (ckin above: a short drop from above). --fx/--fy are the start point in card ems; 3-5-8's three-seat table moves e and w up (head.html). */
.cktrick .s{--fx:0;--fy:8.5em}.cktrick .n{--fx:0;--fy:-8.5em}.cktrick .e{--fx:11em;--fy:0}.cktrick .w{--fx:-11em;--fy:0}
@keyframes ckfly{from{translate:var(--fx) var(--fy);scale:.8;opacity:.2}to{translate:0 0;scale:1;opacity:1}}
.cktrick .ck.fly{animation:ckfly .5s cubic-bezier(.2,.75,.3,1) both;z-index:3}
@media(prefers-reduced-motion:reduce){.cktrick .ck.fly{animation:none}}
.cktrick .ck.win{box-shadow:0 0 0 .16em var(--ck-gold),0 0 1.1em var(--ck-gold);z-index:2}
.ckmsg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;text-align:center;font-family:var(--ck-disp);color:var(--ck-ink);background:rgba(0,0,0,.55);padding:calc(var(--u)*1.4) calc(var(--u)*2.6);border-radius:calc(var(--u)*1.2);border:calc(var(--u)*.2) solid var(--ck-gold);max-width:60%}
.ckchip{position:absolute;left:calc(var(--u)*2);bottom:calc(var(--u)*2);z-index:5;display:flex;gap:calc(var(--u)*1);align-items:center;font:700 calc(var(--u)*1.55)/1 var(--ck-disp);padding:calc(var(--u)*.7) calc(var(--u)*1.3);border-radius:99px;background:rgba(0,0,0,.6);color:#fff;border:calc(var(--u)*.2) solid var(--ck-gold)}
.ckchip b{font-size:calc(var(--u)*2.1);color:#ff6b7d}.ckchip b.blk{color:#fff}
.ckside{background:var(--ck-side);color:var(--ck-ink);border-left:.3em solid var(--ck-gold);padding:1.2vw;display:flex;flex-direction:column;gap:.7vw;font-family:var(--ck-disp)}
.ckside h3{margin:0;font-size:1.4vw;letter-spacing:.1em;text-transform:uppercase;color:var(--ck-gold)}
.cksc{display:grid;grid-template-columns:1fr auto;align-items:center;font-size:1.5vw;padding:.6vw .8vw;border-radius:.5vw;background:var(--ck-sc)}
.cksc b{font-variant-numeric:tabular-nums;font-size:1.9vw}.cksc small{grid-column:1/-1;font-size:1vw;opacity:.8}
.cksc.lead{background:var(--ck-lead);color:#fff;box-shadow:inset 0 0 0 .15vw var(--ck-gold)}
.cksc.neg b{color:#ff8a8a}
/* the phone: a hand along the bottom, two overlapping rows when it is long */
/* 7.37: bigger cards, and each row spreads across the phone's width (--k = cards in the row) instead of bunching in the middle.
   Was: font-size:15px, a fixed overlap of -1.5em (one row) or -1.9em (two rows). */
.ckhand{display:flex;flex-direction:column;gap:.3em;align-items:center;font-size:clamp(15px,4.6vw,20px);padding:.4em .3em 1.2em}
.ckrow{display:flex;justify-content:center}
.ckrow .ck{margin-left:min(.2em,calc((min(100vw - 40px,26em) - 3.6em)/max(var(--k,1) - 1,1) - 3.6em));transition:transform .15s}.ckrow .ck:first-child{margin-left:0}
.ckrow .ck.up{transform:translateY(-.9em)}
`;
  const inject = look => { if(typeof document === "undefined") return; let s = document.getElementById("ckcss"); if(!s){ s = document.createElement("style"); s.id = "ckcss"; s.textContent = css; document.head.appendChild(s); } };
  const hand = (codes, o = {}) => { const n = codes.length, per = n > 7 ? Math.ceil(n / 2) : n, rows = n > 7 ? [codes.slice(0, per), codes.slice(per)] : [codes];
    return `<div class="ckhand">${rows.map(r => `<div class="ckrow${rows.length > 1 ? " two" : ""}" style="--k:${r.length}">${r.map(c => face(c, (o.legal && !o.legal.includes(c) ? "off " : "") + (o.up === c || (o.ups && o.ups.includes(c)) ? "up" : ""))).join("")}</div>`).join("")}</div>`; };
  return {SUITS, SYM, RED, POS, code, rank, suit, label, deck, shuffle, sort, trickWinner, face, back, fly, css, inject, hand};
})();
