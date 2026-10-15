#!/usr/bin/env python3
"""Reads words.txt next to this file and writes words.json ({cats:{name:[[word, "e"|"h", [alts]?]...]}}). build.js embeds words.json as FAW. Run: python3 v4work/fakeartist/build-words.py"""
import json, os
d = os.path.dirname(os.path.abspath(__file__)); cats = {}; cur = None
for ln in open(os.path.join(d, 'words.txt'), encoding='utf8'):
    ln = ln.rstrip('\n')
    if ln.startswith('## '): cur = ln[3:].strip(); cats[cur] = []; continue
    if not ln or ln.startswith('#'): continue
    alt = []; lvl = 'e'
    if '=' in ln:
        ln, a = ln.split('=', 1); alt = [x.strip() for x in a.split(',') if x.strip()]
    if ln.endswith(':h'): ln = ln[:-2]; lvl = 'h'
    cats[cur].append([ln.strip(), lvl] + ([alt] if alt else []))
for k, v in cats.items():
    ws = [x[0] for x in v]; dup = sorted({w for w in ws if ws.count(w) > 1})
    print(f"{k}: {len(v)} words, {sum(1 for x in v if x[1] == 'h')} hard, duplicates {dup}")
json.dump({'cats': cats}, open(os.path.join(d, 'words.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
