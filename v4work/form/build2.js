const fs=require('fs');const rows=[];
for(const f of ['res1.txt','res2.txt','res3.txt']) for(const l of fs.readFileSync(f,'utf8').trim().split('\n')){const p=l.split(' | ');rows.push({f:p[1],s:p[2],a:p[3].trim(),src:p[4]});}
for(const f of ['res4.txt','res5.txt']) for(const l of fs.readFileSync(f,'utf8').trim().split('\n')){const p=l.split(' | ');rows.push({f:p[0],s:p[1],a:p[2].trim(),src:p[3]});}
const T={100:["Barcelona, 2011","Spain, 2010","Manchester United, 2008","Liverpool, 2019","Argentina, 2022","France, 2018","Arsenal, 2003","Germany, 2014","Real Madrid, 2017","Barcelona, 2015","Liverpool, 2005","Leicester","Chelsea, 2012","Barcelona, 2009","Real Madrid, 2014","Spain, 2024","Italy, 2006","Manchester City, 2023"],
200:["Paris Saint-Germain","Brazil, 2002","Inter, 2010","Bayern Munich, 2013","Real Madrid, 2022","Chelsea, 2021","Manchester United, 1999","AC Milan, 2007","Tottenham","Portugal, 2016","Liverpool, 2018","Manchester City, 2012","Spain, 2012","Bayern Munich, 2020","Greece","Croatia","Netherlands","Napoli"],
300:["Chelsea, 2008","Atlético Madrid, 2014","Real Madrid, 2024","Porto","Arsenal, 2006","Borussia Dortmund, 2013","Real Madrid, 2002","Germany, 2002","Inter, 2023","Argentina, 2021","Manchester United, 2009","Bayer Leverkusen, 2023","Morocco, 2022 (World Cup quarter","Iceland","Egypt, 2017","Juventus, 2015","Liverpool, 2007","Atlético Madrid, 2016","Manchester City, 2022"],
400:["Chelsea, 2019","Manchester United, 2017","Manchester City, 2021","Ajax","Borussia Dortmund, 2024","Barcelona, 2006","Juventus, 2017","Saudi","Egypt, 2018","Atalanta","Eintracht","Roma","Morocco, 2022 (World Cup semi","Wales","Chelsea, 2013","Liverpool, 2001","Uruguay","Sevilla","Egypt, 2010"],
500:["Monaco","Bayer Leverkusen, 2002","Valencia","Celtic","Middlesbrough","Fulham","Alavés","Zenit","Shakhtar","Wigan","Portsmouth","South Korea","Senegal","Egypt, 2009","Zambia","Costa Rica","Leeds","Deportivo","Al Ahly"]};
const used=new Set(), data={}, srcs=[];
for(const v in T){data[v]=T[v].map(k=>{const m=rows.filter(r=>r.a.startsWith(k)); if(m.length!==1) throw new Error(k+' matches '+m.length); const r=m[0]; used.add(r);
 const rs=r.s.replace(/"Okka"\s*/,'').split(';').map(x=>x.split(',').map(y=>y.trim()).filter(Boolean));
 const sizes=[1,...r.f.trim().split('-').map(Number)]; if(rs.length!==sizes.length||rs.some((x,i)=>x.length!==sizes[i])) throw new Error('shape '+r.a+' '+r.f+' '+rs.map(x=>x.length));
 srcs.push(v+' | '+r.a+' | '+r.src);
 return [r.f.trim()+"\n"+rs.slice().reverse().map(x=>x.join(' · ')).join("\n"), r.a.replace(/,? played Nov 2020/,'')];});}
const left=rows.filter(r=>!used.has(r)).map(r=>r.a); console.log('unused:',left);
const old=JSON.parse(fs.readFileSync('/mnt/project-files/jeopardy/v4work/out/form.json','utf8'));
old.data=data; fs.writeFileSync('form.json',JSON.stringify(old,null,1)); fs.writeFileSync('sources.txt',srcs.join('\n')+'\n');
console.log(Object.values(data).map(a=>a.length), rows.length);
