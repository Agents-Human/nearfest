const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// The original vampire terrace is a single, readable fighting lane.
export const stickPlatforms=[];
const weaponKinds=['sword','hammer','staff'];
const terraceWeapons=(round=0)=>[235,480,725].map((x,id)=>({id,x,y:410,kind:weaponKinds[(id+round)%3],active:true,respawn:0}));

export function createStickFighter(i,round=0){
 const side=(i+round)%2;
 return {
  x:side?610:350,y:410,vx:0,vy:0,facing:side?-1:1,
  hp:100,energy:100,cooldown:0,attack:0,hit:false,blocking:false,ground:true,
  attackKind:'punch',attackSeq:0,stun:0,
  combo:0,comboTimer:0,lean:0,leanVel:0,
  dashTimer:0,dashCooldown:0,parryTimer:0,
  weapon:null,weaponTimer:0,airJumps:1,
  tumble:0,charging:false,heavyAlt:0,moveCallout:'',calloutTimer:0,
  jumpHeld:false,queued:null,bufferTime:0,hitCombo:0,hitComboTimer:0,
  hurtKind:'',hurtTimer:0,hitFlash:0,guardBroken:0,guardHit:0,parryPose:0,weaponUses:0
 };
}

export function initStickWorld(s,n){
 s.players=Array.from({length:n},(_,i)=>createStickFighter(i,0));
 s.scores=Array(n).fill(0);
 s.roundTime=0;s.breakTime=0;
 s.platforms=stickPlatforms.map(p=>({...p}));
 s.weapons=terraceWeapons(s.round||0);
 s.nextWeapon=1;
 s.beams=[];s.nextBeam=0;
 s.impacts=[];s.nextImpact=0;
}

function addImpact(s,x,y,kind,dir=1,power=1,label='',owner=-1){
 s.impacts=s.impacts||[];
 s.impacts.push({id:(s.nextImpact=(s.nextImpact||0)+1),x,y,kind,dir,power,label,owner,age:0});
 if(s.impacts.length>24)s.impacts.shift();
}

export function stepStickWorld(s,cs,DT,ranked){
 s.platforms=s.platforms||stickPlatforms.map(p=>({...p}));
 s.weapons=s.weapons||[];
 s.beams=s.beams||[];
 s.impacts=s.impacts||[];
 for(const imp of s.impacts)imp.age+=DT;
 s.impacts=s.impacts.filter(imp=>imp.age<.6);

 if(s.breakTime>0){
  s.breakTime=Math.max(0,s.breakTime-DT);
  for(const p of s.players){p.attack=0;p.blocking=false;p.vx*=Math.exp(-8*DT);p.x=clamp(p.x+p.vx*DT,55,905);p.vy+=1150*DT;p.y=Math.min(410,p.y+p.vy*DT);if(p.y===410){p.vy=0;p.ground=true;}p.hurtTimer=Math.max(0,(p.hurtTimer||0)-DT);}
  if(s.breakTime<=0){
   s.round++;s.roundTime=0;
   s.players=s.players.map((_,i)=>createStickFighter(i,s.round));
   s.weapons=terraceWeapons(s.round||0);s.impacts=[];
   s.beams=[];
  }
  return s;
 }

 s.roundTime+=DT;
 for(const w of s.weapons){
  if(!w.active&&(w.respawn||0)>0){
   w.respawn-=DT;
   if(w.respawn<=0){
    const pad=s.platforms[(w.id+Math.floor(s.roundTime))%s.platforms.length];
    w.x=pad?pad.x+pad.w/2:[235,480,725][w.id%3];w.y=pad?.y??410;w.kind=weaponKinds[(w.id+Math.floor(s.roundTime))%weaponKinds.length];
    w.active=true;
   }
  }
 }

 const hits=[];
 s.players.forEach((p,i)=>{
  const c={...(cs[i]||{})};
  p.calloutTimer=Math.max(0,(p.calloutTimer||0)-DT);if(!p.calloutTimer)p.moveCallout='';
  p.hurtTimer=Math.max(0,(p.hurtTimer||0)-DT);p.hitFlash=Math.max(0,(p.hitFlash||0)-DT);
  p.hitComboTimer=Math.max(0,(p.hitComboTimer||0)-DT);if(!p.hitComboTimer)p.hitCombo=0;
  p.guardBroken=Math.max(0,(p.guardBroken||0)-DT);p.guardHit=Math.max(0,(p.guardHit||0)-DT);p.parryPose=Math.max(0,(p.parryPose||0)-DT);
  // Remember quick taps during recovery; holding attack also continues the chain.
  if(c.fire||c.down||c.attack){p.queued=c.fire?'fire':c.down?'down':c.up?'uppercut':'attack';p.bufferTime=.18;}
  else p.bufferTime=Math.max(0,(p.bufferTime||0)-DT);
  const jumpPressed=Boolean(c.up&&!p.jumpHeld);p.jumpHeld=Boolean(c.up);
  if(p.bufferTime>0&&p.cooldown<=DT){if(p.queued==='uppercut'){c.attack=true;c.up=true;}else c[p.queued]=true;}
  p.cooldown=Math.max(0,p.cooldown-DT);
  p.comboTimer=Math.max(0,(p.comboTimer||0)-DT);
  if(p.comboTimer===0)p.combo=0;
  p.dashTimer=Math.max(0,(p.dashTimer||0)-DT);
  p.dashCooldown=Math.max(0,(p.dashCooldown||0)-DT);
  p.tumble=Math.max(0,(p.tumble||0)-DT);p.airFlip=Math.max(0,(p.airFlip||0)-DT);
  if((p.weaponTimer||0)>0){p.weaponTimer=Math.max(0,p.weaponTimer-DT);if(p.weaponTimer===0)p.weapon=null;}

  if(p.weapon&&(p.weaponUses??6)<=0&&p.attack<=0)p.weapon=null;
  const dx=Number(Boolean(c.right))-Number(Boolean(c.left)),rival=s.players[1-i]||p;
  if(dx&&p.stun<=0)p.facing=dx;
  else if(p.attack<=0)p.facing=rival.x>=p.x?1:-1;

  const wasBlocking=p.blocking;
  const stationaryCharge=Boolean(c.block&&!dx&&p.ground&&p.attack<=0&&p.stun<=0);
  p.charging=stationaryCharge&&p.energy<100;
  p.energy=clamp(p.energy+(stationaryCharge?26:c.block?7:15)*DT,0,100);
  p.blocking=Boolean(c.block&&p.energy>1&&p.attack<=0&&p.stun<=0&&p.guardBroken<=0);
  if(p.blocking&&!wasBlocking)p.parryTimer=.20;
  p.parryTimer=Math.max(0,(p.parryTimer||0)-DT);
  if(p.blocking&&!stationaryCharge)p.energy=Math.max(0,p.energy-5*DT);
  p.stun=Math.max(0,(p.stun||0)-DT);

  // Ninja Dash when pressing block + direction
  if(c.block&&dx&&p.dashCooldown<=0&&p.stun<=0&&p.attack<=0&&p.guardBroken<=0&&p.energy>=14){
   p.dashTimer=.16;p.dashCooldown=.65;p.energy-=14;
   p.vx=dx*480;
   p.leanVel=(p.leanVel||0)+dx*10;
   p.moveCallout='DASH';p.calloutTimer=.55;
   addImpact(s,p.x,p.y-35,'dash',dx,.8,'NINJA DASH');
  }

  const prevY=p.y;
  if(p.stun>0||p.tumble>0){
   p.vx*=Math.exp(-4.5*DT);
  }else if(p.dashTimer>0){
   p.vx=p.facing*460;
  }else if(p.attack>0){
   // Preserve the lunge/dropkick impulse through the active attack.
   p.vx*=Math.exp(-(p.attackKind==='divekick'?1:8)*DT);
  }else{
   const targetVx=dx*(p.blocking?105:310);
   p.vx=dx?targetVx:p.vx*Math.exp(-14*DT);
  }

  // Jump & Double Air-Flip Somersault
  if(jumpPressed&&!c.attack&&p.stun<=0&&p.tumble<=0&&p.attack<=0){
   if(p.ground){
    p.vy=-480;p.ground=false;p.airJumps=1;
    p.leanVel=(p.leanVel||0)+p.facing*5;
   }else if((p.airJumps||0)>0){
    p.vy=-420;p.airJumps=0;p.airFlip=.32;
    p.leanVel=(p.leanVel||0)+p.facing*15;
    p.moveCallout='AIR FLIP';p.calloutTimer=.6;
    addImpact(s,p.x,p.y-20,'jump',p.facing,.7,'FLIP');
   }
  }

  p.vy+=1150*DT;
  p.x=clamp(p.x+p.vx*DT,55,905);
  p.y+=p.vy*DT;

  // Check elevated platform landings when falling onto them (unless holding down to drop through)
  let landed=false;
  if(p.vy>=0&&!c.down){
   for(const plat of s.platforms){
    if(p.x>=plat.x+8&&p.x<=plat.x+plat.w-8&&prevY<=plat.y+4&&p.y>=plat.y){
     p.y=plat.y;p.vy=0;p.ground=true;p.airJumps=1;landed=true;
     break;
    }
   }
  }
  if(!landed){
   if(p.y>=410){
    if((p.attackKind==='divekick'&&p.attack>0)||(prevY<395&&p.vy>360&&(p.tumble>0||p.stun>0||p.hp<=0))){
     addImpact(s,p.x,410,'slam',p.facing,1.4,'CRATER SLAM');
    }
    p.y=410;p.vy=0;p.ground=true;p.airJumps=1;
   }else{
    p.ground=false;
   }
  }

  // Spring-damper procedural stickman torso lean physics
  const targetLean=p.hp<=0?p.facing*1.45:p.stun>0?-p.facing*.52:p.blocking?-p.facing*.18:dx*.26;
  p.leanVel=((p.leanVel||0)+(targetLean-(p.lean||0))*38*DT)*Math.exp(-9*DT);
  p.lean=clamp((p.lean||0)+p.leanVel*DT,-1.6,1.6);

  // Collect arena weapon orbs
  for(const w of s.weapons){
   if(w.active&&Math.hypot(p.x-w.x,(p.y-25)-w.y)<46){
    w.active=false;w.respawn=13;
    p.weapon=w.kind;p.weaponTimer=12;p.weaponUses=6;
    p.moveCallout=`${w.kind.toUpperCase()} EQUIPPED!`;p.calloutTimer=.8;
    addImpact(s,w.x,w.y,'pickup',p.facing,.9,w.kind.toUpperCase());
   }
  }

  // Special Move (F / c.fire): Close-Range Judo Overhead Throw OR Ranged Ki Energy Blast!
  if(c.fire&&!p.blocking&&p.cooldown===0&&p.stun===0){
   const dist=Math.abs(rival.x-p.x),vDist=Math.abs(rival.y-p.y);
   if(dist<86&&vDist<75&&p.energy>=18){
    p.attackKind='throw';
    p.attack=.32;p.cooldown=.62;p.energy-=18;
    p.attackSeq=(p.attackSeq||0)+1;p.attackDuration=p.attack;p.hit=true;
    p.moveCallout='OVERHEAD THROW';p.calloutTimer=.8;p.bufferTime=0;
    hits.push({from:i,to:1-i,kind:'throw',weapon:p.weapon});
   }else if(p.energy>=26){
    p.attackKind='blast';
    p.attack=.32;p.cooldown=.65;p.energy-=26;
    p.attackSeq=(p.attackSeq||0)+1;p.attackDuration=p.attack;p.hit=true;
    p.moveCallout='SPIRIT BLAST';p.calloutTimer=.8;p.bufferTime=0;
    s.beams.push({
     id:(s.nextBeam=(s.nextBeam||0)+1),
     owner:i,
     x:p.x+p.facing*36,
     y:p.y-55,
     vx:p.facing*680,
     facing:p.facing,
     life:.55,
     hit:false
    });
    addImpact(s,p.x+p.facing*34,p.y-55,'blast',p.facing,1.2,'KI BLAST!');
   }
  }

  // Standard Martial Arts Combat Moves:
  // - Space (c.attack): 4-Hit Martial Chain (Jab -> Chin Cross -> Flying Knee -> Crescent KO Kick)
  // - W + Space (c.up + c.attack): Rising Dragon Uppercut
  // - S (c.down) in Air: Horizontal Two-Foot Dropkick
  // - S (c.down) on Ground: High Roundhouse Kick / Low Leg Sweep
  if((c.attack||c.down)&&!p.blocking&&p.cooldown===0&&p.stun===0){
   const isHeavy=Boolean(c.down);
   const cost=isHeavy?18:7;
   if(p.energy>=cost){
    if(isHeavy&&!p.ground&&p.y<375){
     p.attackKind='divekick';
     p.attack=.30;p.cooldown=.52;
     p.vx=p.facing*440;p.vy=Math.max(p.vy,380);
     p.leanVel=p.facing*12;
     p.moveCallout='FLYING DROPKICK!';
    }else if(isHeavy){
     p.heavyAlt=((p.heavyAlt||0)+1)%2;
     p.attackKind=p.weapon==='hammer'?'smash':p.weapon==='sword'?'slash':p.weapon==='staff'?'staff':p.heavyAlt===0?'sweep':'kick';
     p.attack=.30;p.cooldown=.46;
     if(dx)p.vx+=p.facing*115;
     p.leanVel=-p.facing*6;
     p.moveCallout=p.attackKind==='smash'?'HAMMER SLAM':p.attackKind==='slash'?'KATANA SLASH':p.attackKind==='staff'?'STAFF THRUST':p.attackKind==='sweep'?'LOW SWEEP':'ROUNDHOUSE';
    }else if(c.up){
     p.attackKind='uppercut';
     p.attack=.26;p.cooldown=.36;
     if(p.ground){p.vy=-330;p.ground=false;}
     p.leanVel=-p.facing*9;
     p.moveCallout='DRAGON UPPERCUT!';
    }else{
     const nextCombo=((p.combo||0)%4)+1;
     p.combo=nextCombo;p.comboTimer=1.25;
     p.attackKind=nextCombo===4?'crescent':nextCombo===3?'knee':nextCombo===2?'cross':'punch';
     p.attack=nextCombo===4?.30:.22;
     p.cooldown=nextCombo===4?.40:.26;
     if(dx||Math.abs(rival.x-p.x)<112)p.vx+=p.facing*(nextCombo>=3?175:95);
     if(nextCombo===3&&p.ground){p.vy=-90;p.ground=false;}
     p.leanVel=p.facing*(nextCombo===4?-8:5);
     p.moveCallout=nextCombo===4?'CRESCENT KO KICK!':nextCombo===3?'FLYING KNEE!':nextCombo===2?'CHIN CROSS!':'STRAIGHT JAB';
    }
    p.energy-=cost;p.bufferTime=0;p.calloutTimer=.7;
    p.attackSeq=(p.attackSeq||0)+1;p.attackDuration=p.attack;
    p.hit=false;
   }
  }

  p.attack=Math.max(0,p.attack-DT);
  const isLongMove=['kick','sweep','divekick','crescent','slash','smash','staff'].includes(p.attackKind);
  const strikeWindow=isLongMove?.23:.18;
  if(p.attack>0&&p.attack<strikeWindow&&!p.hit&&!['blast','throw'].includes(p.attackKind)){
   const armed=!['kick','sweep','divekick','crescent','knee'].includes(p.attackKind)?p.weapon:null;
   const wepBonus=armed==='staff'?28:armed==='sword'?22:armed==='hammer'?18:0;
   const reach=(['kick','sweep','divekick','slash','smash','staff'].includes(p.attackKind)?95:p.attackKind==='crescent'?84:p.attackKind==='uppercut'||p.attackKind==='knee'?78:72)+wepBonus;
   s.players.forEach((other,j)=>{
    if(i!==j&&Math.abs(other.y-p.y)<88&&(other.x-p.x)*p.facing>=-15&&Math.abs(other.x-p.x)<reach){
     p.hit=true;
     hits.push({from:i,to:j,kind:p.attackKind,weapon:armed});
    }
   });
  }
 });

 // Step Ki Energy Beams
 for(const b of s.beams){
  b.life-=DT;
  b.x+=b.vx*DT;
  if(!b.hit){
   s.players.forEach((target,j)=>{
    if(j!==b.owner&&Math.abs(target.x-b.x)<42&&Math.abs((target.y-51)-b.y)<52){
     b.hit=true;b.life=Math.min(b.life,.08);
     hits.push({from:b.owner,to:j,kind:'blast',weapon:null});
    }
   });
  }
 }
 s.beams=s.beams.filter(b=>b.life>0&&b.x>30&&b.x<930);


 for(const hit of hits){
  const p=s.players[hit.to],attacker=s.players[hit.from];
  const isThrow=hit.kind==='throw';
  const contactX=p.x-attacker.facing*10,contactY=p.y-(hit.kind==='sweep'?18:['kick','crescent','uppercut','cross','smash'].includes(hit.kind)?69:55);
  if((p.dashTimer||0)>.06){addImpact(s,contactX,contactY,'dodge',p.facing,.8,'DODGE!',hit.to);continue;}
  if(hit.weapon){attacker.weaponUses=Math.max(0,(attacker.weaponUses??6)-1);}
  const blocked=!isThrow&&p.blocking&&(attacker.x-p.x)*p.facing>0;
  const parried=blocked&&(p.parryTimer||0)>0;
  const isHeavy=['kick','sweep','divekick','uppercut','crescent','throw','blast','slash','smash','staff'].includes(hit.kind);
  const wepDmg=hit.weapon==='hammer'?5:hit.weapon==='sword'?3:hit.weapon==='staff'?2:0;
  const baseDmg=hit.kind==='throw'?13:['smash','slash','staff','kick','sweep','divekick'].includes(hit.kind)?11:hit.kind==='blast'||hit.kind==='crescent'?10:hit.kind==='uppercut'||hit.kind==='knee'?8:hit.kind==='cross'?6:5;
  const dmg=parried?0:blocked?2:baseDmg+wepDmg;
  p.hp=Math.max(0,p.hp-dmg);
  if(!blocked){attacker.hitCombo=(attacker.hitComboTimer>0?attacker.hitCombo:0)+1;attacker.hitComboTimer=1.1;p.hitCombo=0;p.hitComboTimer=0;p.hurtKind=hit.kind;p.hurtTimer=.24;p.hitFlash=.09;}

  const knockX=blocked?(parried?2:4):isThrow?72:hit.weapon==='hammer'?68:hit.kind==='kick'||hit.kind==='divekick'||hit.kind==='crescent'?42:hit.kind==='blast'?36:hit.kind==='uppercut'||hit.kind==='sweep'?26:4;
  const dir=isThrow?-attacker.facing:attacker.facing;
  p.x=clamp(p.x+dir*knockX,55,905);
  p.vx=dir*(blocked?60:isThrow?340:hit.weapon==='hammer'?380:isHeavy?275:65);

  if(!blocked&&(isThrow||hit.kind==='uppercut'||hit.kind==='crescent'||hit.kind==='sweep'||hit.weapon==='hammer'||p.hp<=0)){
   p.vy=isThrow?-410:p.hp<=0?-350:hit.weapon==='hammer'?-310:hit.kind==='sweep'?-225:-275;
   p.ground=false;
   p.tumble=isThrow?.68:hit.kind==='sweep'?.48:.52;
  }
  p.leanVel=-dir*(blocked?3:isHeavy?15:9);
  p.stun=blocked?0:isThrow?.34:isHeavy?.23:.12;
  if(!blocked){p.attack=0;p.hit=true;p.combo=0;p.comboTimer=0;}
  if(parried){
   p.energy=Math.min(100,p.energy+18);
   attacker.stun=.25;attacker.vx=-attacker.facing*220;
   p.parryPose=.3;p.moveCallout='PERFECT PARRY';p.calloutTimer=.8;attacker.attack=0;attacker.hit=true;attacker.combo=0;
   addImpact(s,(p.x+attacker.x)/2,p.y-55,'parry',p.facing,1.4,'PARRY!',hit.to);
  }else if(blocked){
   p.guardHit=.22;p.energy=Math.max(0,p.energy-(hit.kind==='smash'?30:18));
   if(p.energy<=1){p.blocking=false;p.guardBroken=.65;p.stun=.5;p.moveCallout='GUARD BREAK';p.calloutTimer=.8;addImpact(s,contactX,contactY,'break',attacker.facing,1.2,'BREAK!',hit.from);}
   addImpact(s,(p.x+attacker.x)/2,p.y-55,'block',attacker.facing,.8,'GUARD',hit.from);
  }else{
   const label=p.hp<=0?'K.O.!':isThrow?'SLAM!':hit.kind==='crescent'?'CRESCENT!':hit.kind==='sweep'?'SWEPT!':hit.kind==='divekick'?'DROPKICK!':hit.kind==='uppercut'?'UPPERCUT!':hit.kind==='blast'?'BLAST!':'POW!';
   addImpact(s,contactX,contactY,p.hp<=0?'ko':isHeavy?'heavy':'hit',dir,p.hp<=0?1.8:isHeavy?1.35:1,label,hit.from);
  }
 }

 const [left,right]=[...s.players].sort((a,b)=>a.x-b.x);
 if(right&&left&&right.x-left.x<54&&Math.abs(right.y-left.y)<70){
  const overlap=(54-(right.x-left.x))/2;
  left.x=clamp(left.x-overlap,55,905);
  right.x=clamp(right.x+overlap,55,905);
 }

 if(s.players.some(p=>p.hp<=0)||s.roundTime>=60){
  const max=Math.max(...s.players.map(p=>p.hp));
  s.players.forEach((p,i)=>{if(p.hp===max)s.scores[i]+=s.players.filter(q=>q.hp===max).length===1?1:.5;});
  s.reason='Round complete';
  if(s.round>=2||s.scores.some(n=>n>=2))ranked(s,s.scores,'Best score across three rounds.');
  else s.breakTime=2;
 }
 return s;
}

/** React to visible attacks, vary approach and punish repeated, unguarded swings. */
export function stickBotControls(s,i,c){
 const p=s.players[i],q=s.players[1-i];
 if(!p||!q||p.hp<=0||s.breakTime>0)return c;
 const d=q.x-p.x,dist=Math.abs(d),phase=(Math.floor(s.tick/16)+i*3)%9;
 const toward=()=>{c.right=d>0;c.left=d<0;};
 const away=()=>{c.right=d<0;c.left=d>0;};
 if(s.roundTime<1.1){if(dist>125)toward();return c;}
 const threat=q.attack>0&&dist<140&&Math.abs(q.y-p.y)<90;
 if(p.stun<=0&&p.cooldown<.14&&threat&&(q.attackSeq+i*3)%5!==0&&p.energy>12){
  c.block=true;
  if(phase===3||q.attackKind==='smash'){away();} // A short defensive dash, never a teleport.
  return c;
 }
 if(p.energy<24&&dist<155&&phase<6){c.block=true;if(dist<68&&p.dashCooldown<=0)away();return c;}
 if(p.guardBroken>0||p.stun>0)return c;
 const reach=p.weapon==='staff'?95:p.weapon?83:64;
 if(dist>reach)toward();
 if(dist<48&&phase===2){away();c.block=true;return c;}
 if(dist>185&&p.energy>42&&s.tick%75<3){c.fire=true;return c;}
 if(dist>140&&phase===7&&s.tick%50===0)c.up=true;
 if(dist<130&&Math.abs(q.y-p.y)<90){
  // Alternate pressure, guard reads, a throw, and the longer heavy strike.
  if(phase===0&&q.cooldown<.12&&p.energy>20){c.left=false;c.right=false;c.block=true;}
  else if(q.blocking&&dist<82&&p.energy>=18)c.fire=true;
  else if((!p.ground||phase===4||phase===6)&&dist<110)c.down=true;
  else if(dist<85&&s.tick%7<5){c.attack=true;if(phase===8)c.up=true;}
 }
 // Grab a nearby weapon when it does not require abandoning the fight.
 if(!p.weapon&&dist>130&&!threat){
  const pickup=s.weapons.filter(w=>w.active&&Math.abs(w.x-p.x)<110).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
  if(pickup){c.right=pickup.x>p.x;c.left=pickup.x<p.x;}
 }
 return c;
}
