"""Independent Fraction validation; raw historical provider words, not TS value inputs."""
import json
from fractions import Fraction as F
from pathlib import Path
root = Path(__file__).resolve().parent.parent
records = json.loads((root / 'artifacts/outcomes.json').read_text())
count = 0
for record in records:
    prefix = root / '.web-data' / record['directory']
    meta = json.loads((prefix / 'metadata.json').read_text())
    event = next(e for e in json.loads((prefix / f"events-{record['index'] // meta['pageSize']}.json").read_text()) if e['index'] == record['index'])
    if record['directory']:
        raw_marks = json.loads((root / 'fixtures/positions' / record['directory'] / 'marks.json').read_text())
    else:
        raw_marks = json.loads((root / 'fixtures/history/valuation-inputs.json').read_text())['records']
    prices = {m['block']: F(int(m.get('result', m.get('raw', ''))[130:194], 16), 2**64) for m in raw_marks if m.get('result') or m.get('raw')}
    flows = [f for f in meta['funding'] if f['index'] <= event['index']]
    for unit, key in [('USDT', 'usdt'), ('CRCLB', 'stock')]:
        def value(tokens, block):
            if block not in prices: return None
            a, b = map(int, tokens)
            result = a * prices[block] + b
            return result if unit == 'USDT' else result / prices[block]
        inputs, outputs = F(0), F(0)
        known_in = known_out = True
        for f in flows:
            v = value(f['tokens'], f['block'])
            if all(int(t) >= 0 for t in f['tokens']):
                if v is None: known_in = False
                else: inputs += v
            else:
                if v is None: known_out = False
                else: outputs -= v
        held = value(event['after'], event['block'])
        net = outputs + held - inputs if known_in and known_out and held is not None else None
        expected = {'input': inputs if known_in else None, 'output': outputs if known_out else None, 'held': held, 'net': net,
                    'percentage': net * 100 / inputs if net is not None and inputs > 0 else None}
        for field, actual in expected.items():
            saved = record[key][field]
            assert saved is None if actual is None else saved is not None and F(int(saved['n']), int(saved['d'])) == actual, (record['id'], record['index'], unit, field)
            count += 1
print(f'Independent Python Fraction lifecycle checks: PASS ({len(records)} selected events, {count} exact value/percentage comparisons)')
