// v4.39: builds out/igf.json (Most Instagram Followers) and out/spot.json (Most Spotify Listeners).
// Each clue lists 3 names; the winner must beat second place by a safe margin (bigger when a figure
// comes from a web search rather than the Wikipedia list), and the value follows how close it is.
// Data: w = Wikipedia list (Instagram: Sept 2026; Spotify: 2 Oct 2026), s = web search summaries (Aug-Sept 2026).
const fs=require('fs'),path=require('path');
const IG={"Cristiano Ronaldo":[679,"w"],"Lionel Messi":[517,"w"],"Selena Gomez":[403,"w"],"Dwayne Johnson (The Rock)":[381,"w"],"Kylie Jenner":[380,"w"],"Ariana Grande":[362,"w"],"Kim Kardashian":[343,"w"],"Beyoncé":[299,"w"],"Khloé Kardashian":[291,"w"],"Justin Bieber":[286,"w"],"Kendall Jenner":[277,"w"],"Taylor Swift":[272,"w"],"Virat Kohli":[271,"w"],"Neymar":[241,"w"],"Jennifer Lopez":[240,"w"],"Kourtney Kardashian":[209,"w"],"Miley Cyrus":[205,"w"],"Katy Perry":[195,"w"],"Zendaya":[178,"w"],"Kevin Hart":[172,"w"],"Cardi B":[160,"w"],"LeBron James":[153,"w"],"Demi Lovato":[147,"w"],"Rihanna":[145,"w"],"Chris Brown":[139,"w"],"Drake":[139,"w"],"Kylian Mbappé":[136,"w"],"Ellen DeGeneres":[129,"w"],"Billie Eilish":[123,"w"],"Lisa (Blackpink)":[105,"w"],"Vin Diesel":[103,"w"],"Gal Gadot":[103,"w"],"Shakira":[103,"w"],
"MrBeast":[89,"s"],"David Beckham":[88,"s"],"Dua Lipa":[88,"s"],"Ronaldinho":[78,"s"],"Karim Benzema":[75,"s"],"Gigi Hadid":[75,"s"],"Marcelo":[68,"s"],"Will Smith":[68,"s"],"Sergio Ramos":[67,"s"],"Mohamed Salah":[67,"s"],"Zlatan Ibrahimović":[65,"s"],"Tom Holland":[64,"s"],"Lamine Yamal":[54,"s"],"Tamer Hosny":[51,"s"],"Mohamed Ramadan":[50,"s"],"Eminem":[44,"s"],"Erling Haaland":[40,"s"],"Amr Diab":[30,"s"],"Jude Bellingham":[27,"s"],"Achraf Hakimi":[25,"s"],"Mustafa Hosny":[25,"s"],"Yasmine Sabri":[22.6,"s"],"Hannah El-Zahed":[22,"s"],"Yasmin Abdulaziz":[20.4,"s"],"Mai Ezz Eldin":[11.6,"s"],"Dina El Sherbiny":[11.3,"s"],"Mona Zaki":[10,"s"]};
const SP={"Bruno Mars":[131.3,"w"],"Rihanna":[116.4,"w"],"The Weeknd":[114.8,"w"],"Justin Bieber":[114.1,"w"],"Taylor Swift":[104.6,"w"],"Lady Gaga":[100.5,"w"],"Coldplay":[95.1,"w"],"Drake":[94.1,"w"],"Bad Bunny":[94.1,"w"],"Ariana Grande":[93.8,"w"],"Shakira":[92.2,"w"],"Katy Perry":[89.9,"w"],"Michael Jackson":[88.2,"w"],"David Guetta":[83.6,"w"],"Maroon 5":[80.6,"w"],"Ed Sheeran":[80.5,"w"],"Pitbull":[79.7,"w"],"Billie Eilish":[78,"w"],"Dua Lipa":[77.8,"w"],"Calvin Harris":[76.6,"w"],"Eminem":[74,"w"],"J Balvin":[72.3,"w"],"Kendrick Lamar":[71,"w"],"Kanye West":[70.9,"w"],"Sia":[69.3,"w"],"Karol G":[68.9,"w"],"Post Malone":[68.6,"w"],"Olivia Rodrigo":[67.1,"w"],"SZA":[66.2,"w"],"Lana Del Rey":[65.8,"w"],"Beyoncé":[65.8,"w"],"Black Eyed Peas":[65.1,"w"],"Daddy Yankee":[64.1,"w"],"Harry Styles":[64,"w"],"Miley Cyrus":[63.6,"w"],"Tame Impala":[61.6,"w"],"Travis Scott":[61.6,"w"],"Adele":[59.4,"w"],"Sean Paul":[59.4,"w"],"Justin Timberlake":[58.9,"w"],"Linkin Park":[57.6,"w"],"Shawn Mendes":[56.7,"w"],"Chris Brown":[56.5,"w"],"Marshmello":[56.2,"w"],"Arctic Monkeys":[55.9,"w"],"Ellie Goulding":[55.9,"w"],"Zara Larsson":[55.3,"w"],"Doja Cat":[54.7,"w"],"Madonna":[54.6,"w"],
"Imagine Dragons":[52.2,"s"],"Queen":[50.6,"s"],"Lil Wayne":[47.6,"s"],"Red Hot Chili Peppers":[45.7,"s"],"50 Cent":[45,"s"],"Guns N' Roses":[40,"s"],"Metallica":[33,"s"],"Lewis Capaldi":[32.8,"s"],"Sherine":[6,"s"],"Amr Diab":[5,"s"],"Elissa":[3,"s"],"Tamer Hosny":[2.3,"s"],"Mohamed Ramadan":[2,"s"],"Wegz":[1.7,"s"],"Marwan Pablo":[1,"s"]};
const EG=new Set(["Mohamed Salah","Tamer Hosny","Mohamed Ramadan","Amr Diab","Achraf Hakimi","Mustafa Hosny","Yasmine Sabri","Hannah El-Zahed","Yasmin Abdulaziz","Mai Ezz Eldin","Dina El Sherbiny","Mona Zaki","Sherine","Elissa","Wegz","Marwan Pablo"]);
// value bands by winner/second ratio
let BANDS={100:[2.2,99],200:[1.6,2.2],300:[1.35,1.6],400:[1.2,1.35],500:[1.12,1.2]};
let seed=7, CAP=5, WCAP=3; const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
function gen(D,q,fmt,unit,perVal){
  const names=Object.keys(D), out={}, used={}, wins={}, seen=new Set();
  for(const v of [500,400,300,200,100]){ out[v]=[]; const [lo,hi]=BANDS[v]; let tries=0, egN=0;
    while(out[v].length<perVal && tries++<200000){
      const t=[0,1,2].map(()=>names[Math.floor(rnd()*names.length)]); if(new Set(t).size<3) continue;
      const key=[...t].sort().join("|"); if(seen.has(key)) continue;
      const s=[...t].sort((a,b)=>D[b][0]-D[a][0]); const r=D[s[0]][0]/D[s[1]][0];
      const safe = (D[s[0]][1]==="w"&&D[s[1]][1]==="w") ? 1.12 : 1.3; if(r<Math.max(lo,safe)||r>=hi) continue;
      if(t.some(n=>(used[n]||0)>=CAP) || (wins[s[0]]||0)>=WCAP) continue;
      const eg=t.some(n=>EG.has(n)); if(eg && v!==100 && egN>=Math.ceil(perVal/3)) continue;
      if(v===100 && !eg && egN<5 && out[v].length>=perVal-5) continue;
      if(eg) egN++;
      seen.add(key); t.forEach(n=>used[n]=(used[n]||0)+1); wins[s[0]]=(wins[s[0]]||0)+1;
      const L="ABC", w=t.indexOf(s[0]);
      const others=t.map((n,i)=>i===w?null:`${L[i]}) ${fmt(D[n][0])}`).filter(Boolean).join(", ");
      out[v].push([`${q}\n`+t.map((n,i)=>`${L[i]}) ${n}`).join("\n"), `${L[w]}) ${s[0]}: ${fmt(D[s[0]][0])}${unit}\n(others: ${others})`]);
    }
    if(out[v].length<perVal) throw new Error(`only ${out[v].length} at ${v}`);
  }
  return {100:out[100],200:out[200],300:out[300],400:out[400],500:out[500]};
}
const fm=x=>x>=10?`${Math.round(x)}M`:`${x}M`;
const W=path.join(__dirname,'..','out');
fs.writeFileSync(W+'/igf.json',JSON.stringify({id:"igf",name:"Most Instagram Followers",type:"text",desc:"Three famous people. Who has the most Instagram followers? Figures are from September 2026 and keep changing, so the host's answer is what counts.",data:gen(IG,"Who has the most Instagram followers?",fm," followers",16)},null,1));
seed=11; CAP=6; WCAP=4; BANDS={100:[1.9,99],200:[1.5,1.9],300:[1.3,1.5],400:[1.2,1.3],500:[1.12,1.2]};
fs.writeFileSync(W+'/spot.json',JSON.stringify({id:"spot",name:"Most Spotify Listeners",type:"text",desc:"Three artists. Who has the most monthly listeners on Spotify? Figures are from early October 2026 and change every month.",data:gen(SP,"Who has the most monthly listeners on Spotify?",fm," monthly listeners",16)},null,1));
console.log("ok");
