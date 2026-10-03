# Prints a category's style (2 sample clues per value) and every existing answer, to write new clues without repeats.
import json,sys,re
for cid in sys.argv[1:]:
    o=json.load(open(f'v4work/out/{cid}.json')); t=o.get('type','text')
    print(f'=== {cid} ({o["name"]}, {t}) desc: {o.get("desc","")}')
    for v in ['100','300','500']:
        for e in o['data'][v][:2]: print(f'  {v}: {json.dumps(e,ensure_ascii=False)[:160]}')
    ans=[]
    for v in o['data']:
        for e in o['data'][v]:
            a = e if isinstance(e,str) else (e[0] if t=='pin' else e[1] if len(e)>1 else e[0])
            ans.append(re.sub(r'\s+',' ',str(a))[:40])
    print('  ANSWERS:', ' | '.join(ans))
