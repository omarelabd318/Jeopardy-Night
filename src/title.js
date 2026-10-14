/* 6.84 (Omar): universal title screen. Spliced into src/app.js at the modes marker (build.js MODE_FILES); ttInit() is called once at the end of app.js.
   Home says Sahra. Picking a mode button keeps you on the title screen and swaps the big title, the background, the tagline and the Start button to that mode's theme
   (TT below, keyed by the button's id), and Sahra moves to the top left. Tap the selected mode again, or its Start button, to open it (each button's own handler).
   A mode with no entry in TT still works: ttFallback() builds a theme from the button's own font and colours, so a new mode only needs its button (and a data-tip).
   To add a theme: copy an entry. t = title lines, ff/fw = title font, c1/c2 = line colours, sh = text-shadow, ink = text colour, bg = page background,
   s = Start button [background, text, border], k = title size factor, x = extra CSS for the title. */
const TT_NAME = "Sahra";   // the overall name (Omar's pick, 6.84)
const TT = {
  home:{base:"#0a0d24", ff:'"Rakkas","Playfair Display",serif', ink:"#f6e7c8", tag:"Pick a game. Gather the group. The night is long.",
    bg:"radial-gradient(ellipse at 50% -10%,rgba(255,176,60,.3),transparent 60%),radial-gradient(circle,rgba(255,255,255,.08) 1.2px,transparent 1.8px) 0 0/34px 34px,linear-gradient(#18204a,#0a0d24)"},
  modeBid:{t:["Bidding","Wars"], ff:'"Share Tech Mono",ui-monospace,Menlo,monospace', fw:400, c1:"#ffd21a", c2:"#38e07b", k:.82, ink:"#ffd21a",
    sh:"0 0 .06em #ffb300,0 0 .28em rgba(255,170,0,.55)", tag:"Bid for the clue. Win it, or pay for it.", s:["#ffd21a","#07090c","#ffb21a"],
    bg:"radial-gradient(circle,rgba(255,178,26,.14) 1px,transparent 1.5px) 0 0/22px 22px,radial-gradient(circle at 50% 40%,#1a1d24,#07090c 70%)", base:"#07090c", g:{c:6,r:5,t:["$200","$300","$400","$500","$600","$800","$1,200","$1,500"],bg:"#07090c",ink:"#ffd21a",font:'"Share Tech Mono",monospace',bd:"#ffb21a",sh:"0 0 8px #ffb300"}},
  modeBingo:{t:["Category","Bingo"], ff:'"Bowlby One","Bebas Neue",Impact,sans-serif', fw:400, c1:"#ffcc33", c2:"#fff", k:.72, ink:"#fff",
    sh:".05em .05em 0 #000", tag:"Claim squares. Five in a row wins.", s:["#ffcc33","#10183f","#fff"],
    bg:"linear-gradient(90deg,#4DA3FF 0 14.3%,#FF8A4D 0 28.6%,#34D3A5 0 42.9%,#8FA4C4 0 57.1%,#FF6FA8 0 71.4%,#5FD068 0 85.7%,#A58BFF 0) bottom/100% 14px no-repeat,radial-gradient(circle,rgba(255,255,255,.08) 1.5px,transparent 2px) 0 0/26px 26px,radial-gradient(ellipse at 50% 30%,#1b2a7a,#10183f 60%,#080d26)", base:"#10183f", g:{c:7,r:7,f:(r,c)=>[[500,400,300,200][Math.max(Math.abs(r-3),Math.abs(c-3))],"#10183f",["#4DA3FF","#FF8A4D","#34D3A5","#8FA4C4","#FF6FA8","#5FD068","#A58BFF"][c]],font:'"Bowlby One",sans-serif',rad:"10px"}},
  modeHot:{t:["Hot","Seat"], ff:'"Abril Fatface","Playfair Display",Georgia,serif', fw:400, c1:"#f6ecd0", c2:"#ef6a5b", k:.95, ink:"#f6ecd0",
    sh:".04em .04em 0 rgba(0,0,0,.5)", tag:"One team, one streak. Bank it or risk it.", s:["#ef6a5b","#f6ecd0","#f6ecd0"],
    bg:"radial-gradient(ellipse at 50% 45%,#13704a,#0c4a2c 60%,#062616)", base:"#0c4a2c", g:{c:6,r:4,t:[100,200,400,800,"1,600","3,200"],bg:"#0c4a2c",ink:"#f6ecd0",font:'"Abril Fatface",serif',bd:"#f6ecd0",rad:"50%",dash:1}},
  modeSurv:{t:["Survival"], ff:'"Lalezar","Alfa Slab One",Impact,sans-serif', fw:400, c1:"#ffe066", k:1.05, ink:"#ffe066",
    sh:".05em .05em 0 #1b1410", x:"transform:rotate(-2deg);", tag:"Lose all your lives and you're out.", s:["#ffe066","#1b1410","#1b1410"],
    bg:"repeating-linear-gradient(-35deg,#6a2bb0 0 60px,#5d24a0 60px 120px)", base:"#6a2bb0", g:{c:7,r:5,t:["☠","✖"],bg:"#5a1f98",ink:"#ffe066",sh:"3px 3px 0 #1b1410",font:'"Lalezar",sans-serif',rad:"6px"}},
  modeImp:{t:["Imposter"], ff:'"Special Elite","Courier Prime",Courier,monospace', fw:400, c1:"#e6e1d3", k:.95, ink:"#e6e1d3",
    sh:".04em .04em 0 #000", tag:"Most of you share a secret. One of you doesn't.", s:["#e8574c","#e6e1d3","#e6e1d3"],
    bg:"radial-gradient(ellipse at 50% 25%,#3a2523,#1d1312 70%)", base:"#1d1312", g:{c:6,r:4,t:["?","▇▇▇","?","CLASSIFIED"],bg:"#2a1a19",ink:"#e6e1d3",bd:"#c8281f",font:'"Special Elite",monospace'}},
  modePsy:{t:["Psych"], ff:'"Archivo Narrow","Arial Narrow",sans-serif', fw:700, c1:"#1e2a26", k:1.1, ink:"#1e2a26",
    sh:"none", x:"text-transform:uppercase;letter-spacing:.06em;border-bottom:.08em solid #d2232a;padding:0 .2em;", tag:"Write a believable lie. Find the truth.", s:["#ef6a5b","#f6f3e8","#1e2a26"],
    bg:"linear-gradient(#f6f3e8,#ece6d2)", base:"#ece6d2", g:{c:6,r:4,t:["____","?","____","TRUE?"],bg:"#ddd5bb",ink:"#1e2a26",bd:"#1e2a26",font:'"Archivo Narrow",sans-serif'}},
  modeEst:{t:["Estimation"], ff:'"Playfair Display",Georgia,serif', fw:700, c1:"#fff", k:.82, ink:"#fff",
    sh:".04em .04em 0 #3a1e10", tag:"Call your tricks, then hit them exactly.", s:["#d8b45a","#2a1608","#3a1e10"],
    bg:"radial-gradient(ellipse at 50% 40%,#16884e,#0f6a3c 55%,#0a4d2b)", base:"#0f6a3c", g:{c:8,r:5,f:(r,c)=>{const k=(r*3+c)%4;return [["♠","♥","♦","♣"][k],k%3?"#c0392b":"#1a1a1a","#f6f0e0"]},font:'"Playfair Display",serif',rad:"8px"}},
  modeCn:{t:["Code","names"], ff:'"Chakra Petch","Share Tech Mono",sans-serif', fw:700, c1:"#cfe6ff", c2:"#ff4d63", k:.9, ink:"#cfe6ff",
    sh:"0 0 .2em rgba(54,163,255,.45)", x:"text-transform:uppercase;letter-spacing:.08em;", tag:"One word, one number. Find your agents.", s:["#36a3ff","#0a1626","#cfe6ff"],
    bg:"repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0 1px,transparent 1px 34px),repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 1px,transparent 1px 34px),#0a1626", base:"#0a1626", g:{c:5,r:5,f:(r,c)=>{const k=(r*5+c*3)%7,w=["AGENT","NILE","CODE","SPY","KEY","CAIRO","CLUE","MAP","SPHINX","BRIDGE","NIGHT","TEA"][(r*5+c)%12];return [w,k<2?"#fff":k<4?"#fff":"#2a2418",k<2?"#d23a4d":k<4?"#2a7fd0":"#d9cfae"]},font:'"Chakra Petch",sans-serif',rad:"6px"}},
  modeDec:{t:["Decrypto"], ff:'"Oswald","Arial Narrow",Impact,sans-serif', fw:600, c1:"#efe6cf", k:.95, ink:"#efe6cf",
    sh:".04em .04em 0 #000", x:"text-transform:uppercase;letter-spacing:.1em;border-bottom:.07em solid #c0392b;padding:0 .2em;", tag:"Pass the code. Don't get intercepted.", s:["#e0604f","#efe6cf","#a07c2c"],
    bg:"repeating-linear-gradient(90deg,#23251f 0 3px,#2a2c24 3px 6px)", base:"#23251f", g:{c:6,r:4,t:["3-1-4","2-4-1","1-3-2","4-2-3","2-1-3"],bg:"#2f3128",ink:"#efe6cf",bd:"#a07c2c",font:'"Oswald",sans-serif'}},
  modeLb:{t:["Liar's","Bar"], ff:'"Rye",Georgia,serif', fw:400, c1:"#f3d27a", c2:"#f0e2c2", k:1, ink:"#f0e2c2",
    sh:".04em .04em 0 #000", tag:"Bluff your cards. Call the liars. Survive the cylinder.", s:["#f3d27a","#1a0f09","#c9a24a"],
    bg:"radial-gradient(ellipse at 50% 40%,#3b2416,#1a0f09 75%)", base:"#1a0f09", g:{c:7,r:5,f:(r,c)=>{const t=["K","Q","A","★","LIAR!","1 in 6","BUST"][(r*3+c)%7];return [t,t==="LIAR!"||t==="BUST"?"#d8342a":"#1a0f09","#f0e2c2"]},font:'"Rye",serif',rad:"8px",bd:"#c9a24a"}},
  modeTb:{t:["Taboo"], ff:'"Bungee",Impact,sans-serif', fw:400, c1:"#fbeedd", k:1, ink:"#fbeedd",
    sh:"0 0 .3em rgba(227,38,59,.75)", tag:"Describe it. Don't say it.", s:["#f2c14e","#170509","#f2c14e"],
    bg:"radial-gradient(ellipse at 50% 0%,#4a1420,#2a0b12 58%,#170509)", base:"#170509", g:{c:6,r:4,t:["TABOO","SAY IT","BUZZ!","ON AIR","NO!","GUESS"],bg:"#2a0b12",ink:"#f2c14e",bd:"#e3263b",font:'"Bungee",sans-serif',rad:"6px"}},
  modeTn:{t:["Tarneeb"], ff:'"Reem Kufi","Cairo",sans-serif', fw:700, c1:"#f6ead2", k:1.05, ink:"#f6ead2",
    sh:".04em .04em 0 #1a0e06", tag:"Bid your tricks, name the trump, beat the other pair.", s:["#c49a4a","#2a190f","#f6ead2"],
    bg:"radial-gradient(ellipse at 50% 40%,#5c3a22,#2a190f 75%)", base:"#2a190f", g:{c:7,r:5,f:(r,c)=>{const k=(r+c*2)%4;return [(1+(r*3+c)%5)+["♠","♥","♦","♣"][k],k%3?"#e07a6a":"#f6ead2","#4a2c1a"]},font:'"Reem Kufi",sans-serif',rad:"8px"}},
  modeSale:{t:["For","Sale?"], ff:'"Abril Fatface","Playfair Display",Georgia,serif', fw:400, c1:"#f3d77a", c2:"#fbf6e6", k:.95, ink:"#fbf6e6",
    sh:".04em .04em 0 rgba(0,0,0,.45)", tag:"Bid for the deed. Sell it for more.", s:["#f3d77a","#26231c","#26231c"],
    bg:"radial-gradient(ellipse at 50% 40%,#1f6b45,#0d3a24 78%)", base:"#0d3a24", g:{c:7,r:5,f:(r,c)=>{const n=1+(r*7+c*4+r*c)%30;return [n,["#8b5a2b","#2a6fb0","#c0392b","#7b3fa0"][n<=7?0:n<=15?1:n<=23?2:3],"#fbf6e6"]},font:'"Abril Fatface",serif',rad:"6px"}},
  /* 7.6 (Omar): 3-5-8 title look moved off the Estimation green. Before: ff Playfair Display fw 900, c1 #fff, sh ".04em .04em 0 #0a3d24", s ["#d8b45a","#0a3d24","#fff"], bg radial-gradient(ellipse at 50% 40%,#16884e,#0f6a3c 55%,#0a4d2b), base #0f6a3c, tiles Playfair on white cards, rad 8px */
  modeTf:{t:["3-5-8"], ff:'"Alfa Slab One",Georgia,serif', fw:400, c1:"#f4d58a", k:1.1, ink:"#f4ecff",
    sh:".05em .05em 0 #1a0a2e", tag:"Three players. Eight, five, three. Take your tricks.", s:["#f4d58a","#2a1248","#f4ecff"],
    bg:"radial-gradient(ellipse at 50% 40%,#4b2a7a,#2a1248 60%,#150726)", base:"#2a1248", g:{c:7,r:5,f:(r,c)=>{const k=(r*3+c*2)%4,n=[8,5,3][(r+c)%3];return [n+["♠","♥","♦","♣"][k],k%3?"#e0607a":"#f4d58a","#3a1d63"]},font:'"Alfa Slab One",serif',rad:"6px",bd:"#f4d58a"}},
  modeHold:{t:["Texas","Hold'em"], ff:'"Limelight",Georgia,serif', fw:400, c1:"#e8c25a", c2:"#f6ecd6", k:.95, ink:"#f6ecd6",
    sh:".04em .04em 0 #000", tag:"Your cards on your phone. The table on the TV.", s:["#e8c25a","#2a1607","#7a1018"],
    bg:"radial-gradient(ellipse at 50% 38%,#1b8a50,#0f6a3c 52%,#0a3d24)", base:"#0f6a3c", g:{c:7,r:5,f:(r,c)=>{const k=(r*3+c*2)%4;return [["♠","♥","♦","♣"][k],k%3?"#d32f2f":"#1a1a1a","#fff"]},font:'"Barlow",sans-serif',rad:"8px"}},
};
let ttSel = "";   // id of the chosen mode button, "" on the home screen
let ttJnTagHtml = "<span>Pick your teams.</span> <span>Pick your categories.</span> <span>Pick your poison.</span>";

function ttFallback(b){   // a mode with no TT entry: borrow the button's own look
  const cs = getComputedStyle(b), col = cs.color, bgc = cs.backgroundColor === "rgba(0, 0, 0, 0)" ? "#10183f" : cs.backgroundColor;
  const w = b.textContent.trim().split(/\s+/), t = w.length > 1 ? [w[0], w.slice(1).join(" ")] : [w[0]];
  return {t, ff:cs.fontFamily, fw:cs.fontWeight, c1:col, c2:col, k:t.join("").length > 11 ? .8 : 1, ink:col, sh:"none",
    tag:(b.dataset.tip || "").split("\n")[0], s:[col, bgc, col], bg:bgc, base:bgc};
}
let ttGhostJn = null;   // the 30 Jeopardy tiles built in app.js, put back when Jeopardy Night is chosen
function ttGhost(g, jn){   // 6.86 (Omar): every mode gets a tile-wall background like Jeopardy Night's, made of that mode's own pieces (g in TT)
  const gh = $("#titleScreen .ghost"); if(!gh) return;
  if(ttGhostJn === null) ttGhostJn = { html:gh.innerHTML, cols:gh.style.gridTemplateColumns };
  gh.className = "ghost";
  if(jn){ gh.style.display = ""; gh.innerHTML = ttGhostJn.html; gh.style.gridTemplateColumns = ttGhostJn.cols; return; }
  if(!g){ gh.style.display = "none"; return; }
  gh.style.display = ""; gh.classList.add("themed"); gh.style.gridTemplateColumns = `repeat(${g.c},1fr)`;
  gh.style.setProperty("--gf", g.font || "inherit"); gh.style.setProperty("--gr", g.rad || "0"); gh.style.setProperty("--gs", g.sh || "none");
  let html = "";
  for(let r = 0; r < g.r; r++) for(let c = 0; c < g.c; c++){
    const v = g.f ? g.f(r, c) : [g.t[(r * g.c + c + r) % g.t.length], g.ink, g.bg];
    html += `<i style="color:${v[1] || g.ink};background:${v[2] || g.bg};${g.bd ? `border:2px ${g.dash ? "dashed" : "solid"} ${g.bd};` : ""}">${esc(String(v[0]))}</i>`;
  }
  gh.innerHTML = html;
}
function ttApply(id){
  const ts = $("#titleScreen"), b = id ? document.getElementById(id) : null;
  if(id && !b) id = "", ttSel = "";
  const jn = id === "modeJn", th = !id ? TT.home : jn ? null : (TT[id] || ttFallback(b));
  ttSel = id || "";
  ts.dataset.sel = id || "home";
  ttGhost(th && th.g ? th.g : null, jn);
  ts.style.background = th ? "transparent" : "";   // 6.86: the theme background lives on the page itself (see --ttbg in head.html), so it carries on under the scrollbar with no seam
  document.documentElement.style.setProperty("--ttbg", th ? th.bg : "none"); document.documentElement.style.setProperty("--ttbc", th ? th.base || "#10183f" : "#10183f");
  ts.style.color = th ? th.ink : "";
  $("#homeHead").hidden = !!id; $("#jnTitle").hidden = !jn; $("#brandCorner").hidden = !id;
  const mt = $("#modeTitle"); mt.hidden = !id || jn;
  if(th && id){
    mt.innerHTML = th.t.map((x, i) => `<span style="color:${i ? th.c2 || th.c1 : th.c1}">${esc(x)}</span>`).join("");
    /* 6.97 (Omar): every mode title is the same size, between the Jeopardy Night title and the old smaller ones. Was font-size:calc(clamp(46px,9.5vw,128px) * ${th.k || 1}) (k is still in TT but no longer used) */
    mt.style.cssText = `font:${th.fw || 400} 1em ${th.ff};font-size:clamp(52px,11.5vw,150px);line-height:.92;text-shadow:${th.sh || "none"};${th.x || ""}`;
    mt.style.animation = "none"; void mt.offsetWidth; mt.style.animation = "";
  }
  const tag = $("#tagline"); tag.style.color = th ? th.ink : ""; tag.style.textShadow = th ? "none" : "";
  tag.innerHTML = jn ? ttJnTagHtml : esc(th.tag || "");
  const go = $("#modeGo"), play = $("#play");
  go.hidden = !id || jn; play.hidden = !jn;
  if(id && !jn){ go.textContent = "Start";   /* 6.87 (Omar): just "Start" (6.84-6.86: "Start " + the mode name) */ go.style.cssText = `background:${th.s[0]};border-color:${th.s[2]}`;   /* 6.99 (Omar): every Start button uses Jeopardy Night's Start font and text colour (the .btn.primary rules); only the background and border follow the mode. Was also color:${th.s[1]};font-family:${th.ff};font-weight:${th.fw || 700} */ }
  const look = $("#lookBtn"); if(look) look.style.display = jn ? "" : "none";   // the Billboard look only changes Jeopardy Night
  const vb = $("#verBtn"); vb.style.color = th ? th.ink : ""; vb.style.opacity = th ? ".85" : "";
  document.querySelectorAll("#modeRow .modebtn").forEach(x => { const on = x.id === id; x.classList.toggle("sel", on); x.setAttribute("aria-pressed", on); });
}
function ttHome(){ ttApply(""); }
function ttPick(b, e){
  if(ttSel === b.id){ if(b._go) b._go.call(b, e); return; }   // second tap on the chosen mode opens it
  ttApply(b.id);   /* 6.90 (Omar): no click sound when picking a mode (6.84-6.89: try{ Snd.unlock(); Snd.blip(); }catch(_){}) */
}
function ttInit(){
  const row = $("#modeRow"); if(!row) return;
  row.querySelectorAll(".modebtn").forEach(b => {
    b._go = b.id === "modeJn" ? (() => $("#play").click()) : b.onclick;
    b.onclick = e => ttPick(b, e);
  });
  $("#modeGo").onclick = e => { const b = ttSel && document.getElementById(ttSel); if(b && b._go) b._go.call(b, e); };
  $("#brandCorner").onclick = ttHome;
  ttHome();
}
