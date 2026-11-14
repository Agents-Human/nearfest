import {useState} from 'react';
import {money} from './api';
import type {PendingPayment, WalletActivity} from './useWalletRecovery';

const operations: Record<string, string> = {create_room: 'Room created', contribute_room: 'Entry paid', start_room: 'Game started', leave_room: 'Left room', cancel_room: 'Room cancelled', refund_room: 'Refund confirmed', remove_player: 'Player refunded', claim_room: 'Result submitted', vote_room: 'Result reviewed', top_up: 'Received', reward: 'Winnings credited', refund: 'Refund credited'};
export default function NearPending({pending, history, checking, error, refresh, resume}: {
  pending: PendingPayment[]; history: WalletActivity[]; checking: boolean; error: string; refresh: () => Promise<void>; resume: (id: string) => Promise<void>;
}) {
  const [working, setWorking] = useState(''), [failure, setFailure] = useState('');
  async function continuePayment(id: string) {
    setWorking(id); setFailure('');
    try {await resume(id);} catch (e) {setFailure((e as Error).message);} finally {setWorking('');}
  }
  return <div className="wallet-activity-list">
    {pending.map(item => <div className="wallet-activity-row" key={item.intent_id}>
      <div><b>{item.title}</b><span>{item.status === 'awaiting_wallet' ? 'Ready to continue' : item.status === 'unavailable' ? 'Reconnecting automatically' : 'Confirming payment'}{BigInt(item.amount) > 0n ? ` · ${money(item.amount)} NEAR` : ''}</span></div>
      {item.status === 'awaiting_wallet' && <button className="text-button" disabled={Boolean(working)} onClick={() => void continuePayment(item.intent_id)}>{working === item.intent_id ? 'Opening…' : 'Continue'}</button>}
    </div>)}
    {history.map(item => <div className="wallet-activity-row" key={item.id}>
      <div><b>{item.title}</b><span>{item.status === 'expired' ? 'Expired · No payment' : item.status === 'failed' ? 'Transfer failed' : item.status === 'pending' ? 'Confirming automatically' : item.status === 'cancelled' ? 'Cancelled' : operations[item.operation] || 'Confirmed'}{BigInt(item.amount) > 0n ? ` · ${money(item.amount)} NEAR` : ''}</span><time dateTime={new Date(item.created_at).toISOString()}>{new Date(item.created_at).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time></div>
      {item.explorer && <a href={item.explorer} target="_blank" rel="noreferrer" aria-label={`View ${item.title} on NEAR`}>↗</a>}
    </div>)}
    {!pending.length && !history.length && <p>{checking ? 'Loading activity…' : 'Your payments and top-ups will appear here.'}</p>}
    {(failure || error) && <p className="inline-error" role="alert">{failure || error} <button className="text-button" disabled={checking} onClick={() => void refresh()}>Retry</button></p>}
  </div>;
}
