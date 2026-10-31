"""Independent rational cross-check of second sample endpoint cashflow valuation.

Uses captured raw provider return words and receipt-reconciled token cashflows,
not TypeScript valuation output as calculation inputs. Run after prepare:web.
"""
import json
from fractions import Fraction
from pathlib import Path

root = Path(__file__).resolve().parent.parent
fixture = root / 'fixtures/positions/632f7d8c3d6ef54f'
config = json.loads((fixture / 'config.json').read_text())
marks = {m['block']: Fraction(int(m['result'][130:194], 16), 2**64)
         for m in json.loads((fixture / 'marks.json').read_text()) if m.get('result')}
funding_value = sum(Fraction(int(f['tokens'][0])) * marks[f['block']] + int(f['tokens'][1])
                    for f in config['funding'])
final_value = int(config['final'][0]) * marks[config['through']] + int(config['final'][1])
pnl = final_value - funding_value
assert pnl == Fraction(-8357518905092697945526481265371851545, 4611686018427387904)

def display(value):
    scaled = abs(value) * Fraction(10**6, 10**18)
    units = scaled.numerator // scaled.denominator
    return ('-' if value < 0 else '') + f'{units // 10**6}.{units % 10**6:06d}'

assert display(pnl) == '-1.812248'
assert display(final_value) == '0.000000'
generated = root / '.web-data/632f7d8c3d6ef54f/metadata.json'
if generated.exists():
    web = json.loads(generated.read_text())
    assert web['performance']['cashflowPnl'] == display(pnl)
    assert web['performance']['finalValue'] == display(final_value)
    assert web['performance']['vsHolding'] is None
    assert web['performance']['holdingPnl'] is None
else:
    print('Generated replay absent; prepare:web is needed to cross-check app output')
assert sum(int(f['tokens'][1]) for f in config['funding']) < 0  # Matched withdrawal infeasible.
print('Independent Python Fraction second-position PnL: PASS; -1.812248 USDT-equivalent; holding UNSUPPORTED')
