"""Independent Fraction calculator using raw historical ABI quote words and verified token flows."""
import json
from pathlib import Path
from fractions import Fraction
root = Path(__file__).resolve().parents[1]
h = json.loads((root / 'fixtures/history/position-history.json').read_text())
inputs = json.loads((root / 'fixtures/history/valuation-inputs.json').read_text())
result = json.loads((root / 'fixtures/history/performance.json').read_text())
prices = {r['block']: Fraction(int(r['raw'][130:194], 16), 2**64) for r in inputs['records'] if 'raw' in r}
assert all(b in prices for b in [h['through']] + [f['block'] for f in h['funding']]), 'Missing historical valuation'
funded = [0, 0]
cash = Fraction(0)
for f in h['funding']:
    a, b = map(int, f['tokenDelta'])
    funded[0] += a
    funded[1] += b
    cash += a * prices[f['block']] + b
end = int(h['final'][0]) * prices[h['through']] + int(h['final'][1])
hold = funded[0] * prices[h['through']] + funded[1]
for name, value in [('finalValue', end), ('cashflowPnl', end-cash), ('holdingPnl', hold-cash), ('vsHolding', end-hold)]:
    assert Fraction(int(result['result'][name]), int(result['result']['denominator'])) == value, name
assert end-cash == (hold-cash) + (end-hold)
print('Independent Python Fraction verification: PASS (final value, cashflow PnL, holding PnL, vs-holding bridge)')
