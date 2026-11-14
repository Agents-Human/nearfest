import {useRef, useState} from 'react';
import {api, money, type User} from './api';
import type {Party} from './Multiplayer';
import {hasAccess, requestOnboarding, roomBudget} from './account-access';

export default function RoomJoinButton<T extends Party>({room, user, joined, data = {}}: {
  room: T; user: User | null; joined: (room: T) => void; data?: Record<string, unknown>;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const joining = useRef(false);
  const paid = BigInt(room.entry) > 0n;
  const full = room.players.length >= room.max_players;
  async function enter() {
    if (joining.current) return;
    joining.current = true; setBusy(true); setError('');
    try {
      const invite = room.invite_key || new URLSearchParams(location.search).get('invite');
      const path = room.id.startsWith('arena-') ? 'arcade' : 'parties';
      const next = await api<T>(`/${path}/${room.id}/action${invite ? '?invite=' + encodeURIComponent(invite) : ''}`, {...data, type: 'join'});
      joined(next);
    } catch (e) {setError((e as Error).message); throw e;} finally {joining.current = false; setBusy(false);}
  }
  function begin() {
    const request = {wallet: paid, minimum: roomBudget(room.entry), label: `Join ${room.title}`, next: enter};
    // Staked joins always review the entry and current wallet balance before signing.
    if (paid || !hasAccess(user, request)) requestOnboarding(request);
    else void enter().catch(() => {});
  }
  return <div className="room-join-action"><button className="primary" disabled={busy || full || room.status !== 'lobby'} onClick={begin}>{busy ? 'Joining…' : full ? 'Room is full' : paid ? `Join room · ${money(room.entry)} NEAR` : 'Join the room →'}</button>{error && <p className="inline-error" role="alert">{error}</p>}</div>;
}
