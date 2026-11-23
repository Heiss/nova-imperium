"""Builds the HTML pages of the UX study „Modern“ into the parent folder.

Run: python3 build.py (then prettier). Proposal only, not game code.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import pages_a  # noqa: E402

PAGES = {
    '01-navigation.html': pages_a.navigation,
    '02-bauen.html': pages_a.bauen,
}

try:
    import pages_b  # noqa: E402
    PAGES.update(pages_b.PAGES)
except ImportError:
    pass

out = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for name, fn in PAGES.items():
    with open(os.path.join(out, name), 'w', encoding='utf-8') as f:
        f.write(fn())
    print('wrote', name)
