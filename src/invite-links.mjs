export function roomInvite(origin, kind, id, invite = '') {
  if (!['party', 'club', 'room'].includes(kind)) throw Error('Unknown invitation type.');
  const url = new URL('/', origin);
  url.searchParams.set(kind, id);
  if (kind === 'party' && invite) url.searchParams.set('invite', invite);
  return url.href;
}
export function socialInvites(url, title) {
  const text = `Join me for ${title} on NearFest!`;
  return [
    {name: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`},
    {name: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`},
    {name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`},
    {name: 'X', href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`},
  ];
}
