# v4.56: NEW holds foods added in 4.56 (published nutrition values); each new trio then includes at least one of them.
# v4.54: writes v4work/add/cal.json, 30 new Most Calories trios (6 per value) built only from the
# calorie figures already in out/cal.json, so no new numbers are introduced. Run before merge.py cal.
import json,re,random
d=json.load(open('v4work/out/cal.json')); M={}; seen=set()
for v in d['data']:
  for q,a in d['data'][v]:
    items=dict(re.findall(r'^([ABC])\) (.+)$',q,re.M)); seen.add(frozenset(items.values()))
    w,_,kc=re.match(r'([ABC])\) (.+?): (\d+) kcal',a).groups(); M[items[w]]=int(kc)
    for L,n in re.findall(r'([ABC])\) (\d+)',a.split('others:')[1]): M[items[L]]=int(n)
NEW={"a McDonald's McDouble":400,"a McDonald's Double Cheeseburger":450,"a McDonald's Sausage McMuffin with Egg":480,"McDonald's Hotcakes (with syrup and butter)":580,"McDonald's small fries":230,"a McDonald's Big Breakfast with Hotcakes":1340,"a McDonald's McCrispy":470,"a McDonald's Chocolate Chip Cookie":170,"a Burger King Whopper Jr.":330,"a Starbucks grande Caffè Latte":190,"a Starbucks grande Caramel Macchiato":250,"a Starbucks grande Caramel Frappuccino":380,"a Starbucks grande Java Chip Frappuccino":440,"a Starbucks grande Caffè Mocha":370,"a Starbucks grande White Chocolate Mocha":430,"a Starbucks grande Pumpkin Spice Latte":390,"a Twix (2 bars, 50 g)":250,"a bag of M&M's (48 g)":240,"a tablespoon of butter":102,"a cup of cooked spaghetti":221,"a cup of cooked quinoa":222,"100 g of grilled chicken breast":165,"a slice of cheddar (28 g)":115,"a bowl of oatmeal made with water (1 cup)":166,"a medium pear":101,"a cup of blueberries":84,"a cup of cooked brown rice":218,"a tablespoon of mayonnaise":94,"100 g of dark chocolate (70–85%)":598,"a butter croissant (57 g)":231}
M.update(NEW)
FAM=["Starbucks","McMuffin","Hotcakes","cheese","rice","chocolate","ta'meya","Medjool","Kit Kat","honey","watermelon","Coca-Cola","Coke","cucumber","banana","almonds","Krispy Kreme","Cinnabon","tea","coffee","KFC Original","Quarter Pounder","fries","milk","potato"]
fam=lambda n:{f for f in FAM if f.lower() in n.lower()}
BANDS={100:(2.5,99),200:(1.7,2.5),300:(1.35,1.7),400:(1.18,1.35),500:(1.08,1.18)}
random.seed(56); names=list(M); out={}; used={}
for v,(lo,hi) in BANDS.items():
  out[str(v)]=[]
  while len(out[str(v)])<6:
    t=random.sample(names,3); s=sorted(t,key=lambda n:-M[n])
    if frozenset(t) in seen or len({M[n] for n in t})<3: continue
    fs=[fam(n) for n in t]
    if fs[0]&fs[1] or fs[0]&fs[2] or fs[1]&fs[2]: continue
    r=M[s[0]]/M[s[1]]
    if not any(n in NEW for n in t): continue
    if not(lo<=r<hi) or any(used.get(n,0)>=2 for n in t): continue
    seen.add(frozenset(t)); [used.__setitem__(n,used.get(n,0)+1) for n in t]
    L="ABC"; w=t.index(s[0])
    oth=", ".join(f"{L[i]}) {M[n]}" for i,n in enumerate(t) if i!=w)
    out[str(v)].append(["Which has the most calories?\n"+"\n".join(f"{L[i]}) {n}" for i,n in enumerate(t)),
      f"{L[w]}) {s[0]}: {M[s[0]]} kcal\n(others: {oth} kcal)"])
out['allow_dup_answers']=sorted({a for v in out.values() for q,a in v})
json.dump(out,open('v4work/add/cal.json','w'),ensure_ascii=False,indent=1)
