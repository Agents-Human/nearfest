import {useEffect,useLayoutEffect,useRef,useState,useId,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {gsap} from 'gsap';
import './room-setup.css';

export default function Modal({ title, children, close, wide = false, game = false, className = '', dismissible = true }: {dismissible?: boolean; title: string; children: ReactNode; close: () => void; wide?: boolean; game?: boolean; className?: string }) {
  const ref = useRef<HTMLElement>(null), label = useId(), closing=useRef(false), closeRef=useRef(close);
  closeRef.current=close;
  const dismissibleRef=useRef(dismissible);dismissibleRef.current=dismissible;
  const [target,setTarget]=useState<HTMLElement|null>(()=>document.getElementById('machine-overlays'));
  useLayoutEffect(()=>setTarget(document.getElementById('machine-overlays')),[]);
  useLayoutEffect(()=>{if(!target||!ref.current||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const ctx=gsap.context(()=>gsap.from(ref.current,{opacity:0,duration:.22,ease:'power3.out'}));return()=>ctx.revert();},[target]);
  function leave(){if(closing.current||!dismissibleRef.current)return;closing.current=true;if(matchMedia('(prefers-reduced-motion: reduce)').matches){closeRef.current();return;}gsap.to(ref.current,{opacity:0,duration:.16,onComplete:()=>closeRef.current()});}
  useEffect(() => {
    const d = ref.current; if(!d)return; const old = document.activeElement as HTMLElement | null; d.focus({preventScroll:true});
    const backgrounds = [...document.querySelectorAll<HTMLElement>('#machine-base-screen,.site-header,.site-footer')];
    const layers=[...document.querySelectorAll<HTMLElement>('#machine-overlays [role="dialog"]')];
    backgrounds.forEach(el=>{el.inert=true;}); layers.forEach(el=>{el.inert=el!==layers.at(-1);});
    function key(e: KeyboardEvent) {
      const layers = document.querySelectorAll('#machine-overlays [role="dialog"]');
      if (layers[layers.length - 1] !== d) return;
      if (e.key === 'Escape') { if(d.querySelector('[role="combobox"][aria-expanded="true"]'))return; e.preventDefault(); leave(); }
      if (e.key === 'Tab') { const items = [...d.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null); if (!items.length) { e.preventDefault(); return; } const first = items[0], last = items[items.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === d)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    }
    d.addEventListener('keydown', key); return () => { d.removeEventListener('keydown', key); const remaining=[...document.querySelectorAll<HTMLElement>('#machine-overlays [role="dialog"]')].filter(el=>el!==d); backgrounds.forEach(el=>{el.inert=remaining.length>0;}); remaining.forEach(el=>{el.inert=el!==remaining.at(-1);}); if (old?.isConnected&&(!remaining.length||remaining.at(-1)?.contains(old))) old.focus({preventScroll:true}); else remaining.at(-1)?.focus({preventScroll:true}); };
  }, [target]);
  return target ? createPortal(<section ref={ref} role="dialog" aria-modal="true" aria-labelledby={label} tabIndex={-1} className={`modal ${wide ? 'wide' : ''} ${game ? 'game-modal' : ''} ${className}`}><div className="modal-head"><h2 id={label}>{title}</h2><button className="icon-button" aria-label="Close dialog" disabled={!dismissible} onClick={leave}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div>{children}</section>, target) : null;
}

