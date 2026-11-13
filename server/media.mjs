export const covers = new Set(['chess', 'sports', 'science']);
export function coverKey(value) {
  if (value == null || value === '') return null;
  if (!covers.has(value)) throw Error('Choose one of the available challenge covers.');
  return value;
}
export function streamLink(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 300) throw Error('Use a public YouTube video or Twitch channel URL.');
  let url; try { url = new URL(value.trim()); } catch { throw Error('Use a complete https:// YouTube or Twitch link.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw Error('Use a public HTTPS stream URL without credentials.');
  const host=url.hostname.toLowerCase(), path=url.pathname.split('/').filter(Boolean);
  if (['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(host)) {
    const id=host==='youtu.be'?path[0]:url.pathname==='/watch'?url.searchParams.get('v'):['live','embed','shorts'].includes(path[0])?path[1]:null;
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw Error('Paste the public video link, not a YouTube channel or studio link.');
    return {platform:'youtube',id,url:`https://www.youtube.com/watch?v=${id}`};
  }
  if (['twitch.tv','www.twitch.tv','m.twitch.tv'].includes(host) && path.length===1 && /^[A-Za-z0-9_]{3,25}$/.test(path[0]) && !['directory','settings','downloads','videos','subscriptions','inventory'].includes(path[0].toLowerCase())) return {platform:'twitch',id:path[0].toLowerCase(),url:`https://www.twitch.tv/${path[0].toLowerCase()}`};
  throw Error('Only public YouTube videos and Twitch channels can be embedded.');
}
