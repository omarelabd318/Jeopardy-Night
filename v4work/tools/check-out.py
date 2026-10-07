# Checks v4work/out/<id>.json files: valid JSON, no duplicate clues, counts per value within 2.
#   python3 v4work/tools/check-out.py tennis facts rid      (no ids = every file)
import json,sys,glob,os
here=os.path.dirname(os.path.abspath(__file__)); out=os.path.abspath(here+'/../out')
ids=sys.argv[1:] or [os.path.basename(f)[:-5] for f in glob.glob(out+'/*.json')]
for i in sorted(ids):
    o=json.load(open(f'{out}/{i}.json')); d=o['data']
    key=lambda e: json.dumps(e) if o.get('type')=='order' or not isinstance(e,list) else json.dumps(e[0])
    qs=[key(e) for v in d.values() for e in v]; dup={q for q in qs if qs.count(q)>1}
    n=[len(d.get(k,[])) for k in ['100','200','300','400','500']]
    print(f"{i:10} {n} total {sum(n)}" + ("  UNEVEN" if max(n)-min(n)>2 else "") + (f"  {len(dup)} DUPLICATES" if dup else ""))
