import { Children, isValidElement, useEffect, useLayoutEffect, useRef, useState, useId, type SelectHTMLAttributes, type ReactNode, type ReactElement, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

type Props = SelectHTMLAttributes<HTMLSelectElement>;
type Option = { value: string; label: string; disabled: boolean };
function optionsFrom(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement(child)) return [];
    const item=child as ReactElement<{value?:string|number;children?:ReactNode;disabled?:boolean}>;
    if(item.type!=='option') return optionsFrom(item.props.children);
    const label=Children.toArray(item.props.children).join('');
    return [{value:String(item.props.value??label),label,disabled:!!item.props.disabled}];
  });
}

/** A keyboard-accessible listbox with a native form value and validation. */
export default function Select({children,className='',value,defaultValue,onChange,required,disabled,...props}:Props){
  const options=optionsFrom(children),id=useId(),host=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),native=useRef<HTMLSelectElement>(null),list=useRef<HTMLDivElement>(null);
  const [internal,setInternal]=useState(String(defaultValue??options[0]?.value??'')),[open,setOpen]=useState(false),[active,setActive]=useState(0),[invalid,setInvalid]=useState(false),[label,setLabel]=useState(props['aria-label']||''),[position,setPosition]=useState({top:0,left:0,width:180,maxHeight:280});
  const search=useRef({text:'',time:0}),selected=String(value??internal),chosen=options.find(o=>o.value===selected);
  useEffect(()=>{if(!props['aria-label']){const parent=host.current?.closest('label');if(parent)setLabel([...parent.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ').trim());}},[props['aria-label']]);
  useEffect(()=>{if(value!==undefined)setInvalid(false);},[value]);
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  function reveal(){if(disabled||native.current?.matches(':disabled'))return;setActive(Math.max(0,options.findIndex(o=>o.value===selected)));setOpen(true);}
  function pick(index:number){const option=options[index];if(disabled||native.current?.matches(':disabled')||!option||option.disabled)return;setInternal(option.value);setInvalid(false);setOpen(false);if(native.current){native.current.value=option.value;native.current.dispatchEvent(new Event('change',{bubbles:true}));}trigger.current?.focus();}
  function move(direction:number){let index=active;for(let i=0;i<options.length;i++){index=(index+direction+options.length)%options.length;if(!options[index].disabled){setActive(index);break;}}}
  function key(event:KeyboardEvent<HTMLButtonElement>){
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!open)reveal();else move(event.key==='ArrowDown'?1:-1);}
    else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(open)pick(active);else reveal();}
    else if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);}
    else if(event.key==='Tab'){setOpen(false);}
    else if(event.key==='Home'||event.key==='End'){if(open){event.preventDefault();const order=options.map((_,i)=>i);if(event.key==='End')order.reverse();setActive(order.find(i=>!options[i].disabled)??0);}}
    else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();const now=Date.now();search.current={text:now-search.current.time<700?search.current.text+event.key:event.key,time:now};const match=options.findIndex(o=>!o.disabled&&o.label.toLowerCase().startsWith(search.current.text.toLowerCase()));if(match>=0){if(!open)setOpen(true);setActive(match);}}
  }
  useLayoutEffect(()=>{if(!open)return;function place(){const rect=trigger.current!.getBoundingClientRect(),width=Math.min(Math.max(rect.width,205),innerWidth-24),below=innerHeight-rect.bottom-14,above=rect.top-14,height=Math.min(280,Math.max(130,Math.max(below,above)));const up=below<Math.min(240,options.length*44+16)&&above>below;setPosition({width,left:Math.max(12,Math.min(rect.left,innerWidth-width-12)),top:up?Math.max(12,rect.top-Math.min(height,options.length*44+16)-7):rect.bottom+7,maxHeight:up?Math.min(height,above):Math.max(100,Math.min(280,below))});}place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);function outside(e:PointerEvent){if(!host.current?.contains(e.target as Node)&&!list.current?.contains(e.target as Node))setOpen(false);}document.addEventListener('pointerdown',outside);return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',outside);};},[open,options.length]);
  useEffect(()=>{if(open)list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'});},[active,open]);
  return <div ref={host} className={`select-field ${className} ${open?'is-open':''} ${invalid?'is-invalid':''}`}>
    <select {...props} value={selected} required={required} disabled={disabled} ref={native} className="select-native" aria-hidden="true" tabIndex={-1} onChange={e=>{setInternal(e.target.value);onChange?.(e);}} onInvalid={e=>{e.preventDefault();setInvalid(true);reveal();trigger.current?.focus();}}>{children}</select>
    <button type="button" ref={trigger} className="select-trigger" role="combobox" aria-label={label||props.name||'Choose an option'} aria-labelledby={props['aria-labelledby']} aria-describedby={props['aria-describedby']} aria-expanded={open} aria-controls={open?id:undefined} aria-haspopup="listbox" aria-activedescendant={open?`${id}-${active}`:undefined} aria-invalid={invalid||undefined} aria-required={required} disabled={disabled} onKeyDown={key} onClick={()=>open?setOpen(false):reveal()}><span>{chosen?.label||'Choose an option'}</span><svg viewBox="0 0 20 20" width="17" height="17" fill="none" aria-hidden="true"><path d="m5 7 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
    {invalid&&<small className="select-error" role="alert">Choose an option.</small>}
    {open&&createPortal(<div ref={list} id={id} className="select-options" role="listbox" aria-label={label} style={position}>{options.map((option,index)=><div key={`${option.value}-${index}`} id={`${id}-${index}`} role="option" aria-selected={selected===option.value} aria-disabled={option.disabled||undefined} data-index={index} className={`select-option ${active===index?'is-highlighted':''}`} onPointerMove={()=>!option.disabled&&setActive(index)} onPointerDown={e=>e.preventDefault()} onClick={()=>pick(index)}><span>{option.label}</span>{selected===option.value&&<svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div>)}</div>,document.body)}
  </div>;
}
