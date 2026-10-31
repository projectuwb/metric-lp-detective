export interface Rational { n: bigint; d: bigint }
const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; };
export function rational(n: bigint, d = 1n): Rational {
  if (d <= 0n) throw new Error('Positive denominator required');
  const g = gcd(n, d); return { n: n / g, d: d / g };
}
export const plus = (a: Rational, b: Rational) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
export const minus = (a: Rational, b: Rational) => rational(a.n * b.d - b.n * a.d, a.d * b.d);
export function decimal(a: Rational, digits = 6, base = 10n ** 18n) {
  const scale = 10n ** BigInt(digits), units = (a.n < 0n ? -a.n : a.n) * scale / (a.d * base);
  return `${a.n < 0n && units ? '-' : ''}${units / scale}.${String(units % scale).padStart(digits, '0')}`;
}
