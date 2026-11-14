import {useState} from 'react';
import Modal from './Modal';
import {roomInvite, socialInvites} from './invite-links.mjs';
import './onboarding.css';

export default function InviteShare({kind = 'party', id, title, invite = ''}: {
  kind?: 'party' | 'club' | 'room'; id: string; title: string; invite?: string;
}) {
  const [open, setOpen] = useState(false), [message, setMessage] = useState('');
  const url = roomInvite(location.origin, kind, id, invite);
  async function share() {
    try {await navigator.share({title: `${title} · NearFest`, text: `Join me for ${title} on NearFest!`, url});}
    catch (e) {if ((e as Error).name !== 'AbortError') setMessage('Choose an app below or copy the link.');}
  }
  async function copy() {
    try {await navigator.clipboard.writeText(url); setMessage('Invite link copied.');}
    catch {setMessage('Select the link below and copy it to share.');}
  }
  return <><button className="secondary" onClick={() => {setMessage(''); setOpen(true);}}>Invite friends ↗</button>
    {open && <Modal title="Good games need good company." close={() => setOpen(false)}>
      <div className="invite-share"><p className="modal-intro">Invite friends to <b>{title}</b>. New players can set up their account and wallet before joining.</p>
        {typeof navigator.share === 'function' && <button className="primary full" onClick={() => void share()}>Share with an app…</button>}
        <div className="invite-socials">{socialInvites(url, title).map(item => <a className="secondary" key={item.name} href={item.href} target="_blank" rel="noopener noreferrer">{item.name} ↗</a>)}</div>
        <label>Room invitation<input aria-label="Room invitation link" readOnly value={url} onFocus={e => e.target.select()}/></label>
        <button className="primary full" onClick={() => void copy()}>Copy invite link</button>
        {message && <p role="status">{message}</p>}
        <p className="fine-print">Anyone you share this link with can open the room and join an available seat.</p>
      </div>
    </Modal>}
  </>;
}
