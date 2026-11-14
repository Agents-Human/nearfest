import {useState} from 'react';
import Modal from './Modal';
import UiIcon from './UiIcon';
import {PlatformIcon, type PlatformIconName} from './PlatformIcon';
import {roomInvite, socialInvites} from './invite-links.mjs';
import './onboarding.css';

export default function InviteShare({kind = 'party', id, title, invite = ''}: {
  kind?: 'party' | 'club' | 'room'; id: string; title: string; invite?: string;
}) {
  const [open, setOpen] = useState(false), [message, setMessage] = useState(''), [copied, setCopied] = useState(false);
  const url = roomInvite(location.origin, kind, id, invite);
  async function share() {
    try {await navigator.share({title: `${title} · NearFest`, text: `Join me for ${title} on NearFest!`, url});}
    catch (e) {if ((e as Error).name !== 'AbortError') setMessage('Choose an app below or copy the link.');}
  }
  async function copy() {
    try {await navigator.clipboard.writeText(url); setCopied(true); setMessage('Invite link copied.');}
    catch {setMessage('Select the link and copy it to share.');}
  }
  return <><button className="secondary" onClick={() => {setMessage('');setCopied(false);setOpen(true);}}><UiIcon name="share" size={18}/>Invite friends</button>
    {open && <Modal className="invite-modal" title="Invite friends" close={() => setOpen(false)}>
      <div className="invite-share"><p className="modal-intro">Play <b>{title}</b> together.</p>
        <div className="invite-socials">{socialInvites(url, title).map(item => <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer"><span className="invite-app-icon"><PlatformIcon name={item.name.toLowerCase() as PlatformIconName}/></span><span>{item.name}</span></a>)}</div>
        {typeof navigator.share === 'function' && <button className="secondary full invite-native-share" onClick={() => void share()}><UiIcon name="share" size={17}/>More apps</button>}
        <label className="invite-copy-label" htmlFor={`invite-${id}`}>Invite link</label>
        <div className="invite-copy-row"><input id={`invite-${id}`} aria-label="Room invitation link" readOnly value={url} onFocus={e => e.target.select()}/><button className="primary" onClick={() => void copy()} aria-label={copied ? 'Invite link copied' : 'Copy invite link'}><UiIcon name={copied?'check':'copy'} size={17}/>{copied?'Copied':'Copy'}</button></div>
        <p className="invite-copy-status" role="status">{message}</p>
        <p className="fine-print">Friends can join an available seat using this link.</p>
      </div>
    </Modal>}
  </>;
}
