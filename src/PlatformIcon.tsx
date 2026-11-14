import './platform-icons.css';

export type PlatformIconName = 'youtube' | 'twitch' | 'broadcast' | 'external-link' | 'play' | 'whatsapp' | 'telegram' | 'facebook' | 'x';

type PlatformIconProps = {
  name: PlatformIconName;
  /** Supply a label only when the icon has no adjacent text equivalent. */
  label?: string;
  className?: string;
};

/** Brand silhouettes: https://brand.youtube/ and https://brand.twitch.com/. */
export function PlatformIcon({ name, label, className = '' }: PlatformIconProps) {
  return (
    <svg
      className={`platform-icon platform-icon--${name}${className ? ` ${className}` : ''}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {name === 'youtube' && <>
        <path fill="currentColor" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.016 3.016 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.121 2.136c1.872.505 9.377.505 9.377.505s7.505 0 9.376-.505a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814Z" />
        <path fill="#fff" d="m9.545 15.568 6.273-3.568-6.273-3.568v7.136Z" />
      </>}
      {name === 'twitch' && <path fill="currentColor" d="M11.571 4.714h1.715v5.143h-1.715zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />}
      {name === 'broadcast' && <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="6" width="12" height="12" rx="3" />
        <path d="m14.5 10 7-4v12l-7-4" />
        <circle cx="6.5" cy="10" r="1" fill="currentColor" stroke="none" />
      </g>}
      {name === 'external-link' && <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 4h6v6M20 4l-9 9" />
        <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
      </g>}
      {name === 'play' && <path fill="currentColor" d="M7 4.8a1 1 0 0 1 1.5-.87l12 7.2a1 1 0 0 1 0 1.74l-12 7.2A1 1 0 0 1 7 19.2Z" />}
      {name === 'whatsapp' && <><path fill="currentColor" d="M12 1a11 11 0 0 0-9.5 16.5L1 23l5.6-1.5A11 11 0 1 0 12 1Zm0 20a9 9 0 0 1-4.6-1.3l-.4-.2-3.3.9.9-3.2-.3-.5A9 9 0 1 1 12 21Z"/><path fill="currentColor" d="M8 6.8c-.3-.6-.6-.6-.9-.6-.8 0-1.7 1-1.7 2.2 0 1.1.8 2.4 1 2.6.1.2 1.9 3 4.6 4.1 2.3 1 2.8.8 3.3.7.5 0 1.6-.7 1.8-1.3.2-.6.2-1.1.1-1.2l-1.9-.9c-.3-.1-.5-.2-.7.1l-.9 1c-.2.2-.3.3-.6.1a7.6 7.6 0 0 1-3.3-2.8c-.2-.3 0-.4.1-.6l.6-.8c.1-.2.2-.4.1-.6L8 6.8Z"/></>}
      {name === 'telegram' && <path fill="currentColor" d="m21.4 3.4-3.2 17.1c-.2 1.2-.9 1.4-1.8.8l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L5.6 14l-4.9-1.6c-1.1-.4-1.1-1.1.2-1.6L20 3.4c.9-.3 1.6.2 1.4 0Z"/>}
      {name === 'facebook' && <path fill="currentColor" d="M22 12A10 10 0 1 0 10.4 22v-7.1H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.7-1.6 1.6V12h2.8l-.5 2.9h-2.3V22A10 10 0 0 0 22 12Z"/>}
      {name === 'x' && <path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22H17l-4.9-7.4L5.6 22H2.4l8.3-9.5L1 2h6.4l5 6.7L18.9 2ZM17.8 20h1.7L6.5 3.9H4.7L17.8 20Z"/>}
    </svg>
  );
}
