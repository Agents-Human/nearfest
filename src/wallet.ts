import { NearConnector } from '@hot-labs/near-connect';
import type { SignAndSendTransactionParams } from '@hot-labs/near-connect';
import {api} from './api';
import {createWalletSession} from './wallet-session';
let connector: NearConnector | undefined;
const getConnector = () => connector ||= new NearConnector({ network: 'testnet', features: { testnet: true, signMessage: true, signAndSendTransaction: true } });
export const connectWallet = createWalletSession(api, getConnector);
export async function sendTransaction(transaction: SignAndSendTransactionParams) {
  const wallet = await getConnector().wallet();
  const accounts = await wallet.getAccounts();
  if (transaction.signerId && !accounts.some(account => account.accountId === transaction.signerId)) throw Error('Your selected wallet account changed. Reconnect the account used for this room.');
  const result = await wallet.signAndSendTransaction({ ...transaction, network: 'testnet' });
  if (result && [result.status, ...(result.receipts_outcome || []).map((r: { outcome: { status: unknown } }) => r.outcome.status)].some(s => s && typeof s === 'object' && 'Failure' in s)) throw Error('The NEAR transaction failed. Refresh the room before trying again.');
  return result;
}
export async function disconnectWallet(name?: string) { if (connector) await connector.disconnect(); }
