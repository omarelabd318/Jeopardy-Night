# v4.54: writes v4work/add/cal.json, 30 new Most Calories trios (6 per value) built only from the
# calorie figures already in out/cal.json, so no new numbers are introduced. Run before merge.py cal.
import json,re,random
d=json.load(open('v4work/out/cal.json')); M={}; seen=set()
for v in d['data']:
  for q,a in d['data'][v]:
    items=dict(re.findall(r'^([ABC])\) (.+)$',q,re.M)); seen.add(frozenset(items.values()))
    w,_,kc=re.match(r'([ABC])\) (.+?): (\d+) kcal',a).groups(); M[items[w]]=int(kc)
    for L,n in re.findall(r'([ABC])\) (\d+)',a.split('others:')[1]): M[items[L]]=int(n)
FAM=["ta'meya","Medjool","Kit Kat","honey","watermelon","Coca-Cola","Coke","cucumber","banana","almonds","Krispy Kreme","Cinnabon","tea","coffee","KFC Original","Quarter Pounder","fries","milk","potato"]
fam=lambda n:{f for f in FAM if f.lower() in n.lower()}
BANDS={100:(2.5,99),200:(1.7,2.5),300:(1.35,1.7),400:(1.18,1.35),500:(1.08,1.18)}
random.seed(54); names=list(M); out={}; used={}
for v,(lo,hi) in BANDS.items():
  out[str(v)]=[]
  while len(out[str(v)])<6:
    t=random.sample(names,3); s=sorted(t,key=lambda n:-M[n])
    if frozenset(t) in seen or len({M[n] for n in t})<3: continue
    fs=[fam(n) for n in t]
    if fs[0]&fs[1] or fs[0]&fs[2] or fs[1]&fs[2]: continue
    r=M[s[0]]/M[s[1]]
    if not(lo<=r<hi) or any(used.get(n,0)>=2 for n in t): continue
    seen.add(frozenset(t)); [used.__setitem__(n,used.get(n,0)+1) for n in t]
    L="ABC"; w=t.index(s[0])
    oth=", ".join(f"{L[i]}) {M[n]}" for i,n in enumerate(t) if i!=w)
    out[str(v)].append(["Which has the most calories?\n"+"\n".join(f"{L[i]}) {n}" for i,n in enumerate(t)),
      f"{L[w]}) {s[0]}: {M[s[0]]} kcal\n(others: {oth} kcal)"])
out['allow_dup_answers']=sorted({a for v in out.values() for q,a in v})
json.dump(out,open('v4work/add/cal.json','w'),ensure_ascii=False,indent=1)
