import {DEFAULT_RACE_SECONDS, roadBend, raceWaterAt, raceWeather, raceTarget, roadHeight, roadGrade, raceRampSections, raceRampHeight, raceTrafficX} from './race-course.mjs';

export const KART_ROSTER = ['sedan-sports', 'hatchback-sports', 'race-future', 'race'];
export const TRAFFIC_MODELS = ['sedan', 'hatchback-sports', 'taxi', 'suv'];
const ROAD_MIN_X = 350, ROAD_MAX_X = 610, CHUNK = 1800;
const round = n => Math.round(n * 1000) / 1000;
const hash = n => {const x = Math.sin(n * 127.1 + 41.7) * 43758.5453;return x-Math.floor(x);};
const lanes = [390, 480, 570];

/** Stable segment IDs: the same road, traffic and rewards for every racer.
 * Only windows around the actual players are retained, even when the field spreads out. */
export function extendRaceCourse(s) {
  const wanted = new Set();
  for (const p of s.players) {
    const chunk = Math.floor(Math.max(0,p.y)/CHUNK);
    for(let i=Math.max(0,chunk-1);i<=chunk+2;i++)wanted.add(i);
  }
  const keep = item => wanted.has(item.chunk ?? Math.floor(item.distance/CHUNK));
  // Moving traffic outlives its spawn segment. Retire only beyond every driver's fog.
  s.traffic = (s.traffic || []).filter(v=>s.players.some(p=>{const gap=v.distance+v.speed*s.elapsed-p.y;return gap>-900&&gap<6200;}));
  const existingCars=new Set(s.traffic.map(v=>v.id));
  s.pickups = (s.pickups || []).filter(keep);
  s.boostPads = (s.boostPads || []).filter(keep);
  const previous = new Set(s.raceChunks || []);
  for (const chunk of [...wanted].sort((a,b)=>a-b)) {
    if(previous.has(chunk))continue;
    const offset = chunk*CHUNK;
    // A small number of real traffic cars, with at least one full lane always open.
    for(let j=0;j<3;j++) {
      const id=chunk*3+j, lane=Math.floor(hash(id+4)*3), speed=130+hash(id+10)*65;
      const at=offset+760+j*470;
      // Preserve cars already on the road; cap new spawns as racers spread out.
      if(!existingCars.has(id)&&s.traffic.length<48)s.traffic.push({id,chunk,x:lanes[lane],distance:at-speed*s.elapsed,speed,kind:'car',model:TRAFFIC_MODELS[id%TRAFFIC_MODELS.length],hitUntil:0,hitDir:0});
    }
    const lane = lanes[(chunk+1)%3];
    s.boostPads.push({id:chunk,chunk,x:lane,distance:offset+350,kind:'nitro',amount:35});
    // A readable line into each fuel can; a second line offers an alternate route.
    for(let j=0;j<8;j++)s.pickups.push({id:chunk*8+j,chunk,x:j<4?lane:lanes[(chunk+2)%3],distance:offset+(j<4?140+j*50:1000+(j-4)*65)});
  }
  s.raceChunks = [...wanted];
  const activeCoins=new Set(s.pickups.map(p=>p.id)),activeCars=new Set(s.traffic.map(p=>p.id)),activePads=new Set(s.boostPads.map(p=>p.id));
  for(const p of s.players) {
    p.collected=(p.collected||[]).filter(id=>activeCoins.has(id));
    p.passedTraffic=(p.passedTraffic||[]).filter(id=>activeCars.has(id));
    p.usedPads=(p.usedPads||[]).filter(id=>activePads.has(id));
  }
}

/** Deterministic road-relative arcade handling. No per-tick physics engine or body allocation. */
export function stepRaceWorld(s, cs, dt, clamp, ranked) {
  const limit=s.timeLimit ?? DEFAULT_RACE_SECONDS;
  const beforeTime=round(s.elapsed-dt);
  dt=Math.max(0,Math.min(dt,limit-beforeTime));
  s.elapsed=Math.min(limit,round(beforeTime+dt));
  extendRaceCourse(s);
  const previousPositions=s.players.map(p=>({x:p.x,y:p.y,speed:p.speed,height:p.height||0,elevation:p.elevation??roadHeight(p.y/10)})),weather=raceWeather(s.elapsed,s.raceSeed);
  for(let i=0;i<s.players.length;i++) {
    const p=s.players[i],c=cs[i]||{},before=p.y,oldX=p.x;
    p.height??=0;p.elevation??=roadHeight(p.y/10);p.verticalSpeed??=0;p.airborne??=false;p.airTime??=0;
    p.landingTimer=Math.max(0,round((p.landingTimer||0)-dt));p.airBoost=Math.max(0,round((p.airBoost||0)-dt));
    p.fireCooldown=Math.max(0,round((p.fireCooldown||0)-dt));
    p.hitTimer=Math.max(0,round((p.hitTimer||0)-dt));
    p.takedownTimer=Math.max(0,round((p.takedownTimer||0)-dt));
    p.hitConfirm=Math.max(0,round((p.hitConfirm||0)-dt));
    p.shield=Math.max(0,round((p.shield||0)-dt));
    p.ammo??=3;p.reload=p.ammo<3?round((p.reload||0)+dt):0;
    if(p.reload>=3.2){p.ammo++;p.reload=0;}
    const wet=Boolean(raceWaterAt(p.y/10,(p.x-480)/10,p.elevation));
    if(wet&&!p.water)p.splashes=(p.splashes||0)+1;
    p.water=wet;
    p.crashTimer=Math.max(0,round((p.crashTimer||0)-dt));
    p.invulnerable=Math.max(0,round((p.invulnerable||0)-dt));
    p.nitroPickupTimer=Math.max(0,round((p.nitroPickupTimer||0)-dt));
    p.driftBoost=Math.max(0,round((p.driftBoost||0)-dt));
    p.nearMissTimer=Math.max(0,round((p.nearMissTimer||0)-dt));
    const throttle=Boolean(c.up&&!c.down);p.throttle=throttle;p.braking=Boolean(c.down);
    const dir=Number(Boolean(c.right))-Number(Boolean(c.left));
    // Ease into a steering angle. Countersteering has grip; release settles gently.
    p.steer=round((p.steer||0)+(dir-(p.steer||0))*(1-Math.exp(-dt*6)));
    const drifting=Boolean(c.block&&dir&&p.speed>340&&!c.down&&!p.airborne);
    if(p.drifting&&!drifting) {
      if(p.driftCharge>=.65){p.driftBoost=.65+p.driftCharge*.65;p.driftBursts=(p.driftBursts||0)+1;}
      p.driftCharge=0;
    }
    p.drifting=drifting;
    p.driftCharge=drifting?clamp(round((p.driftCharge||0)+dt*.65),0,1):0;
    p.drift=drifting?p.driftCharge:0;
    p.boostLocked=Boolean(p.boostLocked&&p.boost<20);
    const manual=Boolean(throttle&&c.attack&&p.boost>0&&!p.boostLocked);
    p.drafting=s.players.some((other,j)=>j!==i&&other.y-p.y>55&&other.y-p.y<320&&Math.abs(other.x-p.x)<27);
    p.boosting=manual;
    p.boost=clamp(round(p.boost-(manual?24:0)*dt),0,100);
    if(manual&&p.boost===0)p.boostLocked=true;
    const grade=roadGrade(p.y/10),hillDrag=Math.abs(grade)>.06?clamp(grade*.32,-.1,.11):0;
    const desired=throttle?Math.min(800,(p.boosting?800:p.driftBoost>0||p.airBoost>0?625:drifting?515:p.drafting?595:560)*(wet?.88:1)*(1-weather.wet*.025)*(p.airborne?1:1-hillDrag)):0;
    const acceleration=p.boosting?460:360,deceleration=c.down?1050:throttle?500:420;
    p.speed=round(p.speed<desired?Math.min(desired,p.speed+acceleration*dt):Math.max(desired,p.speed-deceleration*dt));
    const targetVx=p.steer*(p.airborne?78:drifting?170:132)*clamp(p.speed/260,0,1);
    const grip=(p.airborne?2.8:drifting?4.5:Math.sign(targetVx)!==Math.sign(p.vx)?9:7)*(wet?.7:1-weather.wet*.16);
    p.vx=p.speed>0?round((p.vx||0)+(targetVx-(p.vx||0))*(1-Math.exp(-dt*grip))):0;
    // Mild outward drift on bends makes choosing a line matter without snapping the car.
    const curve=-roadBend(p.y/10)*p.speed*(drifting?12:7);
    p.x=round(clamp(p.x+(p.vx+curve)*dt,ROAD_MIN_X,ROAD_MAX_X));
    if((p.x===ROAD_MIN_X&&p.vx<0)||(p.x===ROAD_MAX_X&&p.vx>0)){p.vx*=.7;p.speed=Math.max(0,p.speed-100*dt);p.driftCharge=0;}
    p.y=round(p.y+p.speed*dt);
    p.heading=round(Math.atan2(p.vx,Math.max(200,p.speed))*.65+(drifting?p.steer*.16:0));

    stepRaceAir(p,before,oldX,dt,clamp);

    for(const vehicle of s.traffic) {
      const z=vehicle.distance+vehicle.speed*s.elapsed,oldZ=z-vehicle.speed*dt,vehicleX=raceTrafficX(vehicle,z/10);
      // Swept relative motion: a fast car cannot tunnel through a traffic car.
      const r0=before-oldZ,r1=p.y-z,span=r1-r0;
      const t=span?clamp(-r0/span,0,1):0;
      const crossX=oldX+(p.x-oldX)*t;
      const clearanceHeight=previousPositions[i].height+(p.height-previousPositions[i].height)*t;
      const overlaps=Math.min(r0,r1)<35&&Math.max(r0,r1)>-35&&clearanceHeight<2.1;
      if(!p.invulnerable&&overlaps&&Math.abs(crossX-vehicleX)<25) {
        p.speed=round(p.speed*.58);p.crashes++;p.invulnerable=1.1;p.crashTimer=.7;p.spin=Math.sign(p.x-vehicleX)||1;
        const side=Math.sign(p.x-vehicleX)||(vehicleX>=480?-1:1);
        p.vx=side*65;p.driftCharge=0;p.drifting=false;
        vehicle.hitUntil=s.elapsed+.55;vehicle.hitDir=-side;
        if(!p.passedTraffic.includes(vehicle.id))p.passedTraffic.push(vehicle.id);
      }
      if(clearanceHeight<2.1&&r0<=38&&r1>38&&!p.passedTraffic.includes(vehicle.id)) {
        p.passedTraffic.push(vehicle.id);
        const clearance=Math.abs(p.x-vehicleX);
        if(clearance>=25&&clearance<=60&&!p.invulnerable){p.nearMisses=(p.nearMisses||0)+1;p.nearMissTimer=1.2;}
      }
    }
    for(const item of s.pickups)if(p.height<2&&!p.collected.includes(item.id)&&Math.abs(p.x-item.x)<30&&before<=item.distance+20&&p.y>=item.distance-20){
      p.collected.push(item.id);p.coins++;
    }
  }
  collectRaceNitro(s,previousPositions);
  // Swept car-to-car contact catches high-speed rear impacts as well as side swipes.
  for(let i=0;i<s.players.length;i++)for(let j=i+1;j<s.players.length;j++){
    const a=s.players[i],b=s.players[j],oldA=previousPositions[i],oldB=previousPositions[j];
    const ry0=oldB.y-oldA.y,ry1=b.y-a.y,delta=ry1-ry0,t=delta?clamp(-ry0/delta,0,1):0;
    const dx=(oldB.x+(b.x-oldB.x)*t)-(oldA.x+(a.x-oldA.x)*t);
    if(Math.abs((oldA.height+(a.height-oldA.height)*t)-(oldB.height+(b.height-oldB.height)*t))>2.1)continue;
    if(Math.min(ry0,ry1)>38||Math.max(ry0,ry1)<-38||Math.abs(dx)>=25)continue;
    const sign=Math.sign(dx)||1;
    if(Math.abs(oldA.speed-oldB.speed)>115&&!a.invulnerable&&!b.invulnerable){
      const attacker=oldA.speed>oldB.speed?a:b,victim=attacker===a?b:a;
      victim.speed=round(victim.speed*.58);victim.crashes++;victim.crashTimer=.85;victim.spin=attacker===a?sign:-sign;
      attacker.speed=round(attacker.speed*.86);attacker.takedowns=(attacker.takedowns||0)+1;attacker.takedownTimer=1.3;
      for(const p of [a,b]){p.invulnerable=1.5;p.drifting=false;p.driftCharge=0;}
      a.vx=-sign*85;b.vx=sign*85;
    }
    if(Math.abs(b.y-a.y)<38){const correction=Math.max(0,25-Math.abs(b.x-a.x))*.25;a.x=clamp(a.x-sign*correction,ROAD_MIN_X,ROAD_MAX_X);b.x=clamp(b.x+sign*correction,ROAD_MIN_X,ROAD_MAX_X);}
  }
  stepRaceCombat(s,cs,dt,previousPositions,clamp);
  if(s.elapsed>=limit)ranked(s,s.players.map(p=>p.y),'Time’s up — the driver furthest down the road wins.');
}

/** One shared can goes to the first racer crossing it, including AI competitors.
 * Sweep both axes so speed and player-array order cannot steal a pickup. Traffic is excluded. */
function collectRaceNitro(s,previousPositions){
  s.boostPads=s.boostPads.filter(can=>{
    let winner=null,first=Infinity;
    s.players.forEach((p,i)=>{
      const old=previousPositions[i],dy=p.y-old.y,dx=p.x-old.x;
      if(p.boost>=100||dy<=0||p.airborne)return;
      let enter=Math.max(0,(can.distance-28-old.y)/dy),leave=Math.min(1,(can.distance+28-old.y)/dy);
      if(dx){
        const a=(can.x-32-old.x)/dx,b=(can.x+32-old.x)/dx;
        enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));
      }else if(Math.abs(old.x-can.x)>=32)return;
      if(enter>leave||enter>=first)return;
      first=enter;winner=p;
    });
    if(!winner)return true;
    winner.usedPads.push(can.id);winner.nitroPickupAmount=Math.min(can.amount??35,100-winner.boost);
    winner.boost=round(winner.boost+winner.nitroPickupAmount);winner.boostLocked=false;
    winner.nitroPickups=(winner.nitroPickups||0)+1;winner.nitroPickupTimer=1.4;
    return false;
  });
}

export function raceBotControls(s,i,c){
  c.up=true;
  const p=s.players[i];
  const threats=s.traffic.filter(v=>{const gap=v.distance+v.speed*s.elapsed-p.y;return gap>-55&&gap<650;});
  let best=480,score=-Infinity;
  for(const lane of lanes){
    let value=-Math.abs(lane-p.x)*.12;
    for(const v of threats)if(Math.abs(lane-raceTrafficX(v,(v.distance+v.speed*s.elapsed)/10))<58)value-=10000/Math.max(30,v.distance+v.speed*s.elapsed-p.y);
    for(const pad of s.boostPads)if(p.boost<100&&!p.airborne&&pad.distance>p.y&&pad.distance<p.y+700&&Math.abs(lane-pad.x)<35)value+=32;
    for(const ramp of raceRampSections(p.y/10,p.y/10+80))if(ramp.start*10>p.y&&(ramp.id+i)%3!==0&&Math.abs(lane-(480+ramp.x*10))<35)value+=48;
    if(value>score){score=value;best=lane;}
  }
  const predicted=p.x+p.vx*.32;
  c.left=predicted>best+12;c.right=predicted<best-12;
  c.fire=raceTarget(s.players,i)>=0;
  c.attack=p.boost>0&&(p.boosting||p.boost>=20)&&threats.every(v=>Math.abs(v.x-p.x)>55||v.distance+v.speed*s.elapsed-p.y>500);
}

/** Three pulse charges, one recharged every 3.2s. Hits cost speed, never a player's car. */
function stepRaceCombat(s,cs,dt,previousPositions,clamp){
  s.shots||=[];s.nextShot||=0;
  // Existing bolts move first: a newly fired bolt begins at the current muzzle, not a tick ahead.
  s.shots=s.shots.filter(shot=>{
    const oldX=shot.x,oldY=shot.y,oldHeight=shot.height||0;shot.height=Math.max(0,oldHeight+(shot.verticalSpeed||0)*dt);shot.x=round(shot.x+shot.vx*dt);shot.y=round(shot.y+shot.speed*dt);shot.life=round(shot.life-dt);
    if(shot.life<=0||shot.x<320||shot.x>640)return false;
    let first=null;
    s.players.forEach((p,i)=>{
      if(i===shot.owner)return;const old=previousPositions[i];
      const rx=oldX-old.x,ry=oldY-old.y,dx=(shot.x-p.x)-rx,dy=(shot.y-p.y)-ry;
      // Closest approach in a scaled car capsule; catches a bolt crossing a car in one tick.
      const t=clamp(-(rx*dx/625+ry*dy/1600)/(dx*dx/625+dy*dy/1600||1),0,1);
      if(Math.abs(oldHeight+(shot.height-oldHeight)*t-(old.height+(p.height-old.height)*t))>1.8)return;
      if((rx+dx*t)**2/625+(ry+dy*t)**2/1600<=1&&(!first||t<first.t))first={i,t};
    });
    if(!first)return true;
    const victim=s.players[first.i],owner=s.players[shot.owner];
    if(!victim.shield){
      victim.speed=round(victim.speed*.62);victim.hitTimer=.65;victim.shield=2;victim.invulnerable=Math.max(victim.invulnerable, .8);victim.vx=(Math.sign(victim.x-shot.x)||1)*65;victim.driftCharge=0;victim.drifting=false;
      owner.hits=(owner.hits||0)+1;owner.hitConfirm=1.25;
    }
    return false;
  });
  s.players.forEach((p,i)=>{
    if(!cs[i]?.fire||p.fireCooldown>0||p.ammo<=0)return;
    const target=raceTarget(s.players,i),other=s.players[target],speed=p.speed+1100;
    const flight=other?Math.max(.15,(other.y-p.y-32)/Math.max(200,speed-other.speed)):1;
    s.shots.push({id:s.nextShot++,owner:i,x:p.x,y:p.y+32,vx:other?clamp((other.x-p.x)/flight,-175,175):0,speed,life:1.45,height:p.height||0,verticalSpeed:other?((other.height||0)-(p.height||0))/flight:0});
    p.ammo--;p.fireCooldown=.55;p.shotsFired=(p.shotsFired||0)+1;
  });
}

/** Authoritative ballistic jumps. Distance never resets; a clean landing carries a short burst of momentum. */
function stepRaceAir(p,before,oldX,dt,clamp){
 const d=p.y/10,ground=roadHeight(d),rampSurface=raceRampHeight(d,(p.x-480)/10);let flyingTime=dt;
 if(!p.airborne){
  const ramp=raceRampSections(before/10,d).find(r=>{
   const fraction=clamp((r.end*10-before)/(p.y-before||1),0,1),x=(oldX+(p.x-oldX)*fraction-480)/10;
   return before<r.end*10&&p.y>=r.end*10&&Math.abs(x-r.x)<r.width/2;
  });
  if(ramp){
   flyingTime=dt*clamp((p.y-ramp.end*10)/(p.y-before||1),0,1);
   p.airborne=true;p.elevation=roadHeight(ramp.end)+ramp.height;p.verticalSpeed=9+p.speed*.005+Math.max(0,roadGrade(ramp.end))*p.speed/10*.65;p.airTime=0;p.jumps=(p.jumps||0)+1;p.drifting=false;p.driftCharge=0;
  }else if(raceRampHeight(before/10,(oldX-480)/10)>.6&&p.elevation>ground+rampSurface+.5){
   // Driving off a ramp edge keeps momentum instead of snapping the car to the road.
   p.airborne=true;p.verticalSpeed=Math.max(2,p.speed*.005);p.airTime=0;p.jumps=(p.jumps||0)+1;p.drifting=false;p.driftCharge=0;
  }else{p.elevation=ground+rampSurface;p.height=rampSurface;p.verticalSpeed=0;return;}
 }
 const gravity=21;p.elevation+=p.verticalSpeed*flyingTime-.5*gravity*flyingTime*flyingTime;p.verticalSpeed-=gravity*flyingTime;p.airTime=round(p.airTime+flyingTime);
 if(p.elevation<=ground+rampSurface&&p.verticalSpeed<0){
  p.lastAirTime=p.airTime;p.bestAirTime=Math.max(p.bestAirTime||0,p.airTime);p.airborne=false;p.elevation=ground+rampSurface;p.verticalSpeed=0;p.height=rampSurface;p.landings=(p.landings||0)+1;p.landingTimer=1.1;
  p.landingReward=0;p.airBoost=.85;p.airTime=0;
 }else p.height=Math.max(0,p.elevation-ground);
 p.elevation=round(p.elevation);p.height=round(p.height);p.verticalSpeed=round(p.verticalSpeed);
}
