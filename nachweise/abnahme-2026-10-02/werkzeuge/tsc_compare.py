#!/usr/bin/env python3
"""Vergleicht zwei tsc-Ausgaben (gleicher Befehl/Konfiguration) normalisiert:
Zeilen-/Spaltennummern entfernt, Union-Mitglieder in Meldungen sortiert; Vergleich als Multimenge.
Aufruf: tsc_compare.py <baseline.txt> <current.txt> <out.json>"""
import re, sys, json
from collections import Counter

def parse(path):
    items = []
    cur = None
    for line in open(path, encoding='utf-8', errors='replace'):
        m = re.match(r'^(\S.*?)\((\d+),(\d+)\): error (TS\d+): (.*)$', line.rstrip('\n'))
        if m:
            if cur: items.append(cur)
            cur = [m.group(1), m.group(4), m.group(5)]
        elif cur and line.startswith('  '):
            cur[2] += ' ' + line.strip()
    if cur: items.append(cur)
    return items

def norm_msg(msg):
    def sort_union(match):
        parts = [p.strip() for p in match.group(1).split('|')]
        return "'" + ' | '.join(sorted(parts)) + "'"
    msg = re.sub(r"'([^']*\|[^']*)'", sort_union, msg)
    msg = re.sub(r'\s+', ' ', msg)
    return msg

def key(item):
    return (item[0], item[1], norm_msg(item[2]))

base = Counter(key(i) for i in parse(sys.argv[1]))
cur = Counter(key(i) for i in parse(sys.argv[2]))
added = cur - base
removed = base - cur
res = {
    'baseline': sum(base.values()), 'current': sum(cur.values()),
    'added': sum(added.values()), 'removed': sum(removed.values()),
    'remaining_common': sum((base & cur).values()),
    'added_list': [list(k) + [n] for k, n in sorted(added.items())],
    'removed_by_file': dict(Counter(k[0] for k in removed.elements())),
}
json.dump(res, open(sys.argv[3], 'w'), ensure_ascii=False, indent=1)
print(json.dumps({k: v for k, v in res.items() if k not in ('added_list', 'removed_by_file')}))
for a in res['added_list'][:40]: print('ADDED', a)
