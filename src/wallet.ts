import { NearConnector } from '@hot-labs/near-connect';
import type { SignAndSendTransactionParams } from '@hot-labs/near-connect';
import {api,type User} from './api';
import {createAccountSession} from './account-session';
import {createWalletSession} from './wallet-session';
let connector: NearConnector | undefined;
const getConnector = () => connector ||= new NearConnector({ network: 'testnet', features: { testnet: true, signMessage: true, signAndSendTransaction: true } });
export const connectWallet = createWalletSession(api, getConnector);
export const signInAccount = createAccountSession(api);
export async function sendTransaction(transaction: SignAndSendTransactionParams, resuming = false) {
  const user=await api<User|null>('/me');
  if(user?.managed)return api('/near/submit',{transaction});
  if(resuming)return;
  const wallet = await getConnector().wallet();
  const accounts = await wallet.getAccounts();
  if (transaction.signerId && !accounts.some(account => account.accountId === transaction.signerId)) throw Error('Your selected wallet account changed. Reconnect the account used for this room.');
  const result = await wallet.signAndSendTransaction({ ...transaction, network: 'testnet' });
  if (result && [result.status, ...(result.receipts_outcome || []).map((r: { outcome: { status: unknown } }) => r.outcome.status)].some(s => s && typeof s === 'object' && 'Failure' in s)) throw Error('The NEAR transaction failed. Refresh the room before trying again.');
  return result;
}
export async function disconnectWallet(name?: string) { if (connector) await connector.disconnect(); }
