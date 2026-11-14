import type {NearConnector, EventMap} from '@hot-labs/near-connect';
import type {api as Api, User} from './api';

type Connector = Pick<NearConnector, 'connect' | 'on' | 'off'>;
/** One authenticated connection, shared by concurrent callers and reused across visits. */
export function createWalletSession(api: typeof Api, connector: () => Connector) {
  let connecting: Promise<User> | undefined;
  return function connect(name?: string): Promise<User> {
    if (connecting) return connecting;
    connecting = (async () => {
      const existing = await api<User | null>('/me');
      if (existing?.kind === 'wallet') return name && name !== existing.name ? api<User>('/profile', {name}) : existing;
      const challenge = await api<{id: string; nonce: string; recipient: string; message: string}>('/auth/challenge', name ? {name} : {});
      const client = connector();
      let signed: {accountId: string; publicKey: string; signature: string} | undefined;
      const capture: (result: EventMap['wallet:signInAndSignMessage']) => void = result => {
        const account = result.success ? result.accounts[0] : undefined;
        if (account && account.signedMessage?.accountId === account.accountId) signed = account.signedMessage;
      };
      client.on('wallet:signInAndSignMessage', capture);
      try {
        await client.connect({signMessageParams: {message: challenge.message, recipient: challenge.recipient, nonce: Uint8Array.from(atob(challenge.nonce), c => c.charCodeAt(0))}});
        if (!signed) throw Error('Sign-in wasn’t completed. Please try again.');
        return await api<User>('/auth/verify', {id: challenge.id, ...signed});
      } finally {client.off('wallet:signInAndSignMessage', capture);}
    })().finally(() => {connecting = undefined;});
    return connecting;
  };
}
