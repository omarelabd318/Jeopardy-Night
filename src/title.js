/* 6.84 (Omar): universal title screen. Spliced into src/app.js at the modes marker (build.js MODE_FILES); ttInit() is called once at the end of app.js.
   Home says Sahra. Picking a mode button keeps you on the title screen and swaps the big title, the background, the tagline and the Start button to that mode's theme
   (TT below, keyed by the button's id), and Sahra moves to the top left. Tap the selected mode again, or its Start button, to open it (each button's own handler).
   A mode with no entry in TT still works: ttFallback() builds a theme from the button's own font and colours, so a new mode only needs its button (and a data-tip).
   To add a theme: copy an entry. t = title lines, ff/fw = title font, c1/c2 = line colours, sh = text-shadow, ink = text colour, bg = page background,
   s = Start button [background, text, border], k = title size factor, x = extra CSS for the title. */
const TT_NAME = "Sahra";   // the overall name (Omar's pick, 6.84)
const TT = {
  home:{ff:'"Rakkas","Playfair Display",serif', ink:"#f6e7c8", tag:"Pick a game. Gather the group. The night is long.",
    bg:"radial-gradient(ellipse at 50% -10%,rgba(255,176,60,.3),transparent 60%),radial-gradient(circle,rgba(255,255,255,.08) 1.2px,transparent 1.8px) 0 0/34px 34px,linear-gradient(#18204a,#0a0d24)"},
  modeBid:{t:["Bidding","Wars"], ff:'"Share Tech Mono",ui-monospace,Menlo,monospace', fw:400, c1:"#ffd21a", c2:"#38e07b", k:.82, ink:"#ffd21a",
    sh:"0 0 .06em #ffb300,0 0 .28em rgba(255,170,0,.55)", tag:"Bid for the clue. Win it, or pay for it.", s:["#ffd21a","#07090c","#ffb21a"],
    bg:"radial-gradient(circle,rgba(255,178,26,.14) 1px,transparent 1.5px) 0 0/22px 22px,radial-gradient(circle at 50% 40%,#1a1d24,#07090c 70%)"},
  modeBingo:{t:["Category","Bingo"], ff:'"Bowlby One","Bebas Neue",Impact,sans-serif', fw:400, c1:"#ffcc33", c2:"#fff", k:.72, ink:"#fff",
    sh:".05em .05em 0 #000", tag:"Claim squares. Five in a row wins.", s:["#ffcc33","#10183f","#fff"],
    bg:"linear-gradient(90deg,#4DA3FF 0 14.3%,#FF8A4D 0 28.6%,#34D3A5 0 42.9%,#8FA4C4 0 57.1%,#FF6FA8 0 71.4%,#5FD068 0 85.7%,#A58BFF 0) bottom/100% 14px no-repeat,radial-gradient(circle,rgba(255,255,255,.08) 1.5px,transparent 2px) 0 0/26px 26px,radial-gradient(ellipse at 50% 30%,#1b2a7a,#10183f 60%,#080d26)"},
  modeHot:{t:["Hot","Seat"], ff:'"Abril Fatface","Playfair Display",Georgia,serif', fw:400, c1:"#f6ecd0", c2:"#ef6a5b", k:.95, ink:"#f6ecd0",
    sh:".04em .04em 0 rgba(0,0,0,.5)", tag:"One team, one streak. Bank it or risk it.", s:["#c0392b","#f6ecd0","#f6ecd0"],
    bg:"radial-gradient(ellipse at 50% 45%,#13704a,#0c4a2c 60%,#062616)"},
  modeSurv:{t:["Survival"], ff:'"Lalezar","Alfa Slab One",Impact,sans-serif', fw:400, c1:"#ffe066", k:1.05, ink:"#ffe066",
    sh:".05em .05em 0 #1b1410", x:"transform:rotate(-2deg);", tag:"Lose all your lives and you're out.", s:["#ffe066","#1b1410","#1b1410"],
    bg:"repeating-linear-gradient(-35deg,#6a2bb0 0 60px,#5d24a0 60px 120px)"},
  modeImp:{t:["Imposter"], ff:'"Special Elite","Courier Prime",Courier,monospace', fw:400, c1:"#e6e1d3", k:.95, ink:"#e6e1d3",
    sh:".04em .04em 0 #000", tag:"Most of you share a secret. One of you doesn't.", s:["#c8281f","#e6e1d3","#e6e1d3"],
    bg:"radial-gradient(ellipse at 50% 25%,#3a2523,#1d1312 70%)"},
  modePsy:{t:["Psych"], ff:'"Archivo Narrow","Arial Narrow",sans-serif', fw:700, c1:"#1e2a26", k:1.1, ink:"#1e2a26",
    sh:"none", x:"text-transform:uppercase;letter-spacing:.06em;border-bottom:.08em solid #d2232a;padding:0 .2em;", tag:"Write a believable lie. Find the truth.", s:["#d2232a","#f6f3e8","#1e2a26"],
    bg:"linear-gradient(#f6f3e8,#ece6d2)"},
  modeEst:{t:["Estimation"], ff:'"Playfair Display",Georgia,serif', fw:700, c1:"#fff", k:.82, ink:"#fff",
    sh:".04em .04em 0 #3a1e10", tag:"Call your tricks, then hit them exactly.", s:["#d8b45a","#2a1608","#3a1e10"],
    bg:"radial-gradient(ellipse at 50% 40%,#16884e,#0f6a3c 55%,#0a4d2b)"},
  modeCn:{t:["Code","names"], ff:'"Chakra Petch","Share Tech Mono",sans-serif', fw:700, c1:"#cfe6ff", c2:"#ff4d63", k:.9, ink:"#cfe6ff",
    sh:"0 0 .2em rgba(54,163,255,.45)", x:"text-transform:uppercase;letter-spacing:.08em;", tag:"One word, one number. Find your agents.", s:["#36a3ff","#0a1626","#cfe6ff"],
    bg:"repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0 1px,transparent 1px 34px),repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 1px,transparent 1px 34px),#0a1626"},
  modeDec:{t:["Decrypto"], ff:'"Oswald","Arial Narrow",Impact,sans-serif', fw:600, c1:"#efe6cf", k:.95, ink:"#efe6cf",
    sh:".04em .04em 0 #000", x:"text-transform:uppercase;letter-spacing:.1em;border-bottom:.07em solid #c0392b;padding:0 .2em;", tag:"Pass the code. Don't get intercepted.", s:["#c0392b","#efe6cf","#a07c2c"],
    bg:"repeating-linear-gradient(90deg,#23251f 0 3px,#2a2c24 3px 6px)"},
  modeTn:{t:["Tarneeb"], ff:'"Reem Kufi","Cairo",sans-serif', fw:700, c1:"#f6ead2", k:1.05, ink:"#f6ead2",
    sh:".04em .04em 0 #1a0e06", tag:"Bid your tricks, name the trump, beat the other pair.", s:["#c49a4a","#2a190f","#f6ead2"],
    bg:"radial-gradient(ellipse at 50% 40%,#5c3a22,#2a190f 75%)"},
};
let ttSel = "";   // id of the chosen mode button, "" on the home screen
let ttJnTagHtml = "<span>Pick your teams.</span> <span>Pick your categories.</span> <span>Pick your poison.</span>";

function ttFallback(b){   // a mode with no TT entry: borrow the button's own look
  const cs = getComputedStyle(b), col = cs.color, bgc = cs.backgroundColor === "rgba(0, 0, 0, 0)" ? "#10183f" : cs.backgroundColor;
  const w = b.textContent.trim().split(/\s+/), t = w.length > 1 ? [w[0], w.slice(1).join(" ")] : [w[0]];
  return {t, ff:cs.fontFamily, fw:cs.fontWeight, c1:col, c2:col, k:t.join("").length > 11 ? .8 : 1, ink:col, sh:"none",
    tag:(b.dataset.tip || "").split("\n")[0], s:[col, bgc, col], bg:bgc};
}
function ttApply(id){
  const ts = $("#titleScreen"), b = id ? document.getElementById(id) : null;
  if(id && !b) id = "", ttSel = "";
  const jn = id === "modeJn", th = !id ? TT.home : jn ? null : (TT[id] || ttFallback(b));
  ttSel = id || "";
  ts.dataset.sel = id || "home";
  $("#titleScreen .ghost").style.display = jn ? "" : "none";
  ts.style.background = th ? th.bg : "";
  ts.style.color = th ? th.ink : "";
  $("#homeHead").hidden = !!id; $("#jnTitle").hidden = !jn; $("#brandCorner").hidden = !id;
  const mt = $("#modeTitle"); mt.hidden = !id || jn;
  if(th && id){
    mt.innerHTML = th.t.map((x, i) => `<span style="color:${i ? th.c2 || th.c1 : th.c1}">${esc(x)}</span>`).join("");
    mt.style.cssText = `font:${th.fw || 400} 1em ${th.ff};font-size:calc(clamp(46px,9.5vw,128px) * ${th.k || 1});line-height:.92;text-shadow:${th.sh || "none"};${th.x || ""}`;
    mt.style.animation = "none"; void mt.offsetWidth; mt.style.animation = "";
  }
  const tag = $("#tagline"); tag.style.color = th ? th.ink : ""; tag.style.textShadow = th ? "none" : "";
  tag.innerHTML = jn ? ttJnTagHtml : esc(th.tag || "");
  const go = $("#modeGo"), play = $("#play");
  go.hidden = !id || jn; play.hidden = !jn;
  if(id && !jn){ go.textContent = "Start " + b.textContent.trim(); go.style.cssText = `background:${th.s[0]};color:${th.s[1]};border-color:${th.s[2]};font-family:${th.ff};font-weight:${th.fw || 700}`; }
  const look = $("#lookBtn"); if(look) look.style.display = jn ? "" : "none";   // the Billboard look only changes Jeopardy Night
  const vb = $("#verBtn"); vb.style.color = th ? th.ink : ""; vb.style.opacity = th ? ".85" : "";
  document.querySelectorAll("#modeRow .modebtn").forEach(x => { const on = x.id === id; x.classList.toggle("sel", on); x.setAttribute("aria-pressed", on); });
}
function ttHome(){ ttApply(""); }
function ttPick(b, e){
  if(ttSel === b.id){ if(b._go) b._go.call(b, e); return; }   // second tap on the chosen mode opens it
  ttApply(b.id); try{ Snd.unlock(); Snd.blip(); }catch(_){}
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
