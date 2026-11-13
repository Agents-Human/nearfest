import { NearConnector } from '@hot-labs/near-connect';
import type { SignAndSendTransactionParams } from '@hot-labs/near-connect';
import { api, type User } from './api';
let connector: NearConnector | undefined;
const getConnector = () => connector ||= new NearConnector({ network: 'testnet', features: { signMessage: true, signAndSendTransaction: true } });
export async function connectWallet() {
  const wallet = await getConnector().connect();
  const accounts = await wallet.getAccounts(); const account = accounts[0]; if (!account) throw Error('No account was selected.');
  const challenge = await api<{ id: string; nonce: string; recipient: string; message: string }>('/auth/challenge', { account_id: account.accountId });
  const signed = await wallet.signMessage({ message: challenge.message, recipient: challenge.recipient, nonce: Uint8Array.from(atob(challenge.nonce), c => c.charCodeAt(0)), network: 'testnet', signerId: account.accountId });
  return api<User>('/auth/verify', { id: challenge.id, ...signed });
}
export async function sendTransaction(transaction: SignAndSendTransactionParams) {
  const wallet = await getConnector().wallet();
  const result = await wallet.signAndSendTransaction({ ...transaction, network: 'testnet' });
  if (result && [result.status, ...(result.receipts_outcome || []).map((r: { outcome: { status: unknown } }) => r.outcome.status)].some(s => s && typeof s === 'object' && 'Failure' in s)) throw Error('The NEAR transaction failed. Refresh the room before trying again.');
  return result;
}
export async function disconnectWallet() { if (connector) await connector.disconnect(); }
