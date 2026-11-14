import {useId, useRef, useState, type KeyboardEvent, type ReactNode} from 'react';
import './game-info-tabs.css';

const tabs = [
  {id: 'description', label: 'Description'},
  {id: 'gameplay', label: 'Hint / Gameplay'},
] as const;
type TabId = typeof tabs[number]['id'];

export default function GameInfoTabs({title, description, children}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const id = useId();
  const [active, setActive] = useState<TabId>('description');
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    setActive(tabs[next].id);
    buttons.current[next]?.focus();
  }

  return <section className="game-info-tabs" aria-label={`${title} information`}>
    <div className="game-info-tablist" role="tablist" aria-label={`${title} information`}>
      {tabs.map((tab, index) => <button
        key={tab.id}
        ref={element => { buttons.current[index] = element; }}
        type="button"
        role="tab"
        id={`${id}-${tab.id}-tab`}
        aria-selected={active === tab.id}
        aria-controls={`${id}-${tab.id}-panel`}
        tabIndex={active === tab.id ? 0 : -1}
        onClick={() => setActive(tab.id)}
        onKeyDown={event => navigate(event, index)}
      >{tab.label}</button>)}
    </div>
    {tabs.map(tab => <div
      key={tab.id}
      className="game-info-panel"
      role="tabpanel"
      id={`${id}-${tab.id}-panel`}
      aria-labelledby={`${id}-${tab.id}-tab`}
      hidden={active !== tab.id}
      tabIndex={0}
    >{tab.id === 'description' ? <p>{description}</p> : children}</div>)}
  </section>;
}
