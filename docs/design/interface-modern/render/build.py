"""Builds the HTML pages of the four UX studies into the parent folder.

Run: python3 build.py (then prettier). Proposal only, not game code.
"""
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

PAGES = [('a-browser-strategie.html', 'study_a'), ('b-weltraum-4x.html', 'study_b'),
         ('c-mobile-strategie.html', 'study_c'), ('d-dashboard-karte.html', 'study_d')]

out = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
only = sys.argv[1:]
for name, mod in PAGES:
    if only and not any(name.startswith(o) for o in only):
        continue
    try:
        m = importlib.import_module(mod)
    except ModuleNotFoundError:
        continue
    with open(os.path.join(out, name), 'w', encoding='utf-8') as f:
        f.write(m.build())
    print('wrote', name)
