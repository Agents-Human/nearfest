import './platform-icons.css';

export type PlatformIconName = 'youtube' | 'twitch' | 'broadcast' | 'external-link' | 'play';

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
    </svg>
  );
}
