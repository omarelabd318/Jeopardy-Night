# v4.54: merges v4work/add/<id>.json ({"100":[...],..,"500":[...]} plus optional act_kind / arabic_answers)
# into v4work/out/<id>.json. Refuses the whole file if a new question or answer repeats one already in the
# category (or within the batch), so nothing is written until the batch is clean.
# Usage: python3 v4work/add/merge.py id [id ...]      (add --check to only report)
import json,sys,os,re,unicodedata
here=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(here,'..','out')
def norm(s): s=unicodedata.normalize('NFKD',str(s)).lower(); return re.sub(r'[^a-z0-9؀-ۿ]+','',s)
def keys(e,typ):
    if typ=='act' or typ=='password': return norm(e), norm(e)
    if typ=='pin': return norm(e[0]+e[1]), norm(e[0])
    if typ=='closest': return norm(e[0]), None
    if typ=='emoji': return e[0].strip(), norm(e[1])  # compare emoji strings raw: norm() strips emoji (and keeps only digits)
    q,a=e[0],e[1]; a=re.sub(r'\(.*?\)','',a)  # ignore bracketed extras when comparing answers
    return norm(q), norm(a)
check='--check' in sys.argv
for cid in [a for a in sys.argv[1:] if not a.startswith('--')]:
    o=json.load(open(f'{OUT}/{cid}.json')); add=json.load(open(f'{here}/{cid}.json')); typ=o.get('type','text')
    seenq={}; seena={}
    for v,L in o['data'].items():
        for e in L:
            q,a=keys(e,typ); seenq[q]=v
            if a and typ not in ('closest',): seena[a]=v
    allow={norm(re.sub(r'\(.*?\)','',x)) for x in add.get('allow_dup_answers',[])}  # answers deliberately reused with a clearly different question
    probs=[]; n=0
    for v in ['100','200','300','400','500']:
        for e in add.get(v,[]):
            q,a=keys(e,typ); n+=1
            if q in seenq: probs.append(f'  {v} question repeats ({seenq[q]}): {e if typ in ("act","password") else e[0]}')
            elif typ not in ('closest','pin') and a and a in seena and a not in allow: probs.append(f'  {v} answer repeats ({seena[a]}): {e if typ in ("act","password") else e[1]}  <- {e if typ in ("act","password") else e[0]}')
            seenq[q]=v
            if a: seena[a]=v
    counts=[len(o['data'][v])+len(add.get(v,[])) for v in ['100','200','300','400','500']]
    status='OK' if not probs else f'{len(probs)} PROBLEMS'
    print(f'{cid}: +{n} -> {sum(counts)} ({"/".join(map(str,counts))}) {status}')
    for p in probs: print(p)
    if probs or check: continue
    for v in ['100','200','300','400','500']: o['data'][v]+=add.get(v,[])
    if add.get('act_kind'): o.setdefault('act_kind',{}).update(add['act_kind'])
    if add.get('arabic_answers'): o['arabic_answers']=sorted(set(o.get('arabic_answers',[]))|set(add['arabic_answers']))
    json.dump(o,open(f'{OUT}/{cid}.json','w'),ensure_ascii=False,indent=1)
    os.rename(f'{here}/{cid}.json',f'{here}/done-{cid}.json')
