import type {User} from './api';

export type AccessRequest = {
  wallet?: boolean;
  autoConnect?: boolean;
  minimum?: string;
  label?: string;
  next?: () => void | Promise<void>;
};
export const GAS_ALLOWANCE = 10n ** 22n;
export function parseNearEntry(value: string) {
  if (!/^(0|[1-9]\d*)(\.\d{1,24})?$/.test(value)) throw Error('Enter a valid NEAR amount, with up to 24 decimals.');
  const [whole, fraction = ''] = value.split('.');
  return (BigInt(whole) * 10n ** 24n + BigInt(fraction.padEnd(24, '0'))).toString();
}
export function roomBudget(entry: string, creating = false) {
  return BigInt(entry) > 0n ? (BigInt(entry) + (creating ? 10n ** 23n : 10n ** 22n) + GAS_ALLOWANCE).toString() : '0';
}
export function hasAccess(user: User | null, request: AccessRequest) {
  return Boolean(user && (!request.wallet || user.kind === 'wallet' && !user.chain_error && BigInt(user.balance) >= BigInt(request.minimum || '0')));
}
export function requestOnboarding(request: AccessRequest = {}) {
  window.dispatchEvent(new CustomEvent('nearfest:onboard', {detail: {autoConnect:true,...request}}));
}
