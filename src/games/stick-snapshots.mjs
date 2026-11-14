const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

/** Combat shows the newest action immediately. Between 20 Hz updates, project
 * motion for at most one tick; damage, attacks and collisions remain authoritative.
 */
export class StickSnapshots {
 newest=null;
 corrections=[];
 get latest(){return this.newest?.state;}
 push(state,now){
  const previous=this.latest;
  if(previous&&(state.tick<previous.tick||state.tick===previous.tick&&state.finished===previous.finished))return;
  const shown=this.sample(now);
  this.corrections=state.players.map((p,i)=>{
   const q=previous?.players[i],r=shown?.players[i];
   // Start recoil at the actual point of contact, then carry it into the
   // authoritative knockback over one frame interval. The burst and foot/fist
   // should meet the defender before the defender is pushed away.
   const contact=(state.impacts||[]).findLast(hit=>hit.owner>=0&&hit.owner!==i&&
    ['hit','heavy','ko'].includes(hit.kind)&&hit.age<.05&&hit.id>(previous?.nextImpact||0));
   if(contact){
    const x=contact.x+(state.players[contact.owner]?.facing||contact.dir)*10;
    if(Math.abs(x-p.x)<100)return {x:x-p.x,y:0};
   }
   // Smooth tiny prediction errors only during uninterrupted travel. A hit,
   // direction change, jump, new strike or round reset must be visible at once.
   const continuous=q&&r&&state.round===previous.round&&!state.breakTime&&state.tick-previous.tick<=2&&
    p.hp===q.hp&&p.attackSeq===q.attackSeq&&p.ground===q.ground&&
    Math.sign(p.vx)===Math.sign(q.vx)&&Math.abs(p.vx-q.vx)<100&&Math.abs(p.x-q.x)<60;
   return continuous?{x:clamp(r.x-p.x,-12,12),y:p.ground?0:clamp(r.y-p.y,-6,6)}:{x:0,y:0};
  });
  this.newest={state,at:now};
 }
 sample(now){
  if(!this.newest)return null;
  const {state,at}=this.newest;
  if(state.finished)return state;
  const dt=clamp((now-at)/1000,0,.05),settle=1-dt/.05;
  const players=state.players.map((p,i)=>{
   const correction=this.corrections[i]||{x:0,y:0};
   return {...p,x:clamp(p.x+p.vx*dt+correction.x*settle,55,905),
    y:p.ground?p.y:Math.min(410,p.y+p.vy*dt+575*dt*dt+correction.y*settle)};
  });
  const [left,right]=[...players].sort((a,b)=>a.x-b.x);
  if(right&&Math.abs(right.y-left.y)<70&&right.x-left.x<54){
   const overlap=(54-(right.x-left.x))/2;
   left.x=clamp(left.x-overlap,55,905);right.x=clamp(right.x+overlap,55,905);
  }
  return {...state,players,beams:(state.beams||[]).map(b=>({...b,x:b.x+b.vx*dt}))};
 }
}
