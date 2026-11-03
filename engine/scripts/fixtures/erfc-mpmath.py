# Writes engine/tests/fixtures/erfc-mpmath.json: erfc(x) at 50 significant digits (mpmath), rounded to the
# nearest double. Base R has no erfc, and 2 * pnorm(-sqrt(2) * x) loses relative precision for large x
# because sqrt(2) * x is rounded, so the reference for erfc comes from arbitrary precision instead.
# Run from engine/:  python3 -I scripts/fixtures/erfc-mpmath.py   (needs mpmath)
import json
import os
import random
import sys

import mpmath as mp

mp.mp.dps = 50
here = os.path.abspath(__file__)
out = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(here))), "tests", "fixtures", "erfc-mpmath.json")

rng = random.Random(20261031)


def nb(x):
    """x and its two neighbouring doubles."""
    import math
    return [math.nextafter(x, -math.inf), x, math.nextafter(x, math.inf)]


special = [0.0, 1e-300, 1e-20, 1.1102230246251565e-16, 1e-10, 1e-5, 0.25] + nb(0.46875) + nb(4.0) + [10.0, 20.0, 26.0, 26.5, 26.54]
grid = [-6 + 0.05 * k for k in range(int(32.5 / 0.05) + 1)]  # -6 ... 26.5
xs = grid + [rng.uniform(-6, 26.5) for _ in range(1500)] + [rng.uniform(-1, 1) for _ in range(300)]
xs += special + [-s for s in special if s <= 6]
seen = set()
x_out = []
for x in xs:
    if -6 <= x <= 26.5 and x not in seen:
        seen.add(x)
        x_out.append(x)

values = [float(mp.erfc(mp.mpf(x))) for x in x_out]  # mpf(x) is the exact double; float() rounds to nearest

with open(here, encoding="utf-8") as f:
    code = f.read()
doc = {
    "description": "erfc(x) from mpmath at 50 significant digits, rounded to the nearest double, for pr-core erfc (engine/src/special.ts).",
    "mpmath_version": mp.__version__,
    "python_version": sys.version.split()[0],
    "generator": "engine/scripts/fixtures/erfc-mpmath.py",
    "code": code,
    "x": x_out,
    "erfc": values,
}
with open(out, "w", encoding="utf-8") as f:
    json.dump(doc, f, indent=None, separators=(",", ": "))
    f.write("\n")
print(f"wrote {out}: {len(x_out)} values")
