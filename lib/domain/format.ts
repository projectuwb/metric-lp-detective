export function tokens(value: string, digits = 6) {
  const n = BigInt(value), negative = n < 0n, amount = negative ? -n : n;
  const whole = (amount / 10n ** 18n).toLocaleString('en-US');
  const fraction = (amount % 10n ** 18n).toString().padStart(18, '0').slice(0, digits).replace(/0+$/, '');
  return `${negative ? '−' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}
export function price(value: string) { return tokens((BigInt(value) * 10n ** 18n / (1n << 64n)).toString(), 5); }
export const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
export const eventTitle = (type: string) => ({ deposit: 'Liquidity added', withdrawal: 'Liquidity withdrawn', swap: 'Attributable swap', rounding: 'Liquidity rounding adjustment' }[type] ?? type);
