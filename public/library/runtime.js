/* slotVend isolation adapter. Games never receive the app's cookies or storage. */
(()=>{
 const storage=()=>{const data=Object.create(null);const api={getItem:k=>Object.hasOwn(data,k)?data[k]:null,setItem:(k,v)=>{data[k]=String(v);},removeItem:k=>{delete data[k];},clear:()=>{for(const k of Object.keys(data))delete data[k];},key:i=>Object.keys(data)[i]??null,get length(){return Object.keys(data).length;}};return new Proxy(api,{get:(o,k)=>k in o?o[k]:data[k],set:(_,k,v)=>{data[k]=String(v);return true;}});};
 for(const key of ['localStorage','sessionStorage'])try{Object.defineProperty(window,key,{value:storage(),configurable:false});}catch{}
 const send=type=>{if(parent!==window)parent.postMessage({type},'*');};
 addEventListener('load',()=>send('slotvend:loaded'));
 addEventListener('error',e=>{if(e.message)send('slotvend:error');});
 addEventListener('unhandledrejection',()=>send('slotvend:error'));
 addEventListener('keydown',e=>{if(e.key==='Escape')send('slotvend:escape');});
})();
