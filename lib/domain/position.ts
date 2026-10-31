// A public position identity is provider + uint80 salt, never a caller-selected path.
export function positionIdentity(input: string) {
  if (!/^0x[0-9a-fA-F]{40}:\d{1,25}$/.test(input)) throw new Error('Invalid position identifier');
  const [provider, value] = input.split(':'), salt = BigInt(value);
  if (salt >= 1n << 80n) throw new Error('Invalid position salt: exceeds uint80');
  return provider.toLowerCase() + ':' + salt;
}
