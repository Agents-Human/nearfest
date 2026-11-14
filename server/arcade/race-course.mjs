/** Shared road coordinates. Distance is metres here; simulation positions use 10 units/metre. */
export const RACE_SECONDS = [60, 120, 180, 300, 600];
export const DEFAULT_RACE_SECONDS = 120;
export const RACE_BIOME_METRES = 650;
export const RACE_BIOMES = [
  {id:'coast', name:'SUNBREAK COAST', subtitle:'Ocean air. Open throttle.', sky:'#48b9ee', haze:'#c9eef3', ground:'#88be68', shoulder:'#e8d6a0', road:'#374855', accent:'#ff7158'},
  {id:'canyon', name:'RED ROCK RUN', subtitle:'Carve through the canyon.', sky:'#f9a56c', haze:'#ffd3a2', ground:'#b96342', shoulder:'#e8a56d', road:'#544651', accent:'#ffd56d'},
  {id:'alpine', name:'ALPINE PASS', subtitle:'Find your line through the pines.', sky:'#7ba9d9', haze:'#d4e4ee', ground:'#648d78', shoulder:'#d9e3d9', road:'#354350', accent:'#a4e0c8'},
  {id:'city', name:'MIDNIGHT METRO', subtitle:'Own the neon boulevard.', sky:'#141b43', haze:'#544e7b', ground:'#303951', shoulder:'#475674', road:'#242e44', accent:'#56e5ee'},
];
export function raceBiome(distance){return RACE_BIOMES[Math.floor(Math.max(0,distance)/RACE_BIOME_METRES)%RACE_BIOMES.length];}
export function roadCenter(d){return 23*Math.sin(d/112)+11*Math.sin(d/53);}
export function roadSlope(d){return 23/112*Math.cos(d/112)+11/53*Math.cos(d/53);}
export function roadBend(d){return -23/(112*112)*Math.sin(d/112)-11/(53*53)*Math.sin(d/53);}
const bounded=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=t=>{t=bounded(t,0,1);return t*t*(3-2*t);};
const hillHeights=[12,22,34,14];
/** Continuous climbs and descents, with the biggest elevation change in the alpine pass. */
export function roadHeight(d){
 const local=((d%650)+650)%650,zone=Math.floor(Math.max(0,d)/650)%4,t=(local-50)/550;
 return 4+2*Math.sin(d/95)+(t>0&&t<1?hillHeights[zone]*Math.sin(Math.PI*t)**2:0);
}
export function roadGrade(d){
 const local=((d%650)+650)%650,zone=Math.floor(Math.max(0,d)/650)%4,t=(local-50)/550;
 return 2/95*Math.cos(d/95)+(t>0&&t<1?hillHeights[zone]*Math.PI/550*Math.sin(2*Math.PI*t):0);
}
export function raceBridgeSections(start,end){
 const result=[];
 for(let zone=Math.max(0,Math.floor((start-80)/650));zone<=Math.floor(end/650);zone++){
  const biome=zone%4,at=zone*650+[300,350,350,270][biome],length=[70,84,76,68][biome];
  const waterLevel=biome===0?-4.8:roadHeight(at+length/2)-[0,24,21,12][biome];
  if(at+length>=start&&at<=end)result.push({id:zone,biome,start:at,end:at+length,waterLevel,name:['COASTAL SKYBRIDGE','CANYON VIADUCT','ALPINE RIVER BRIDGE','METRO CANAL BRIDGE'][biome]});
 }
 return result;
}
export function raceRampSections(start,end){
 const result=[];
 for(let zone=Math.max(0,Math.floor((start-25)/650));zone<=Math.floor(end/650);zone++)for(let j=0;j<2;j++){
  const at=zone*650+(j?510:140),length=j?20:18;
  if(at+length>=start&&at<=end)result.push({id:zone*2+j,start:at,end:at+length,x:(zone+j)%2?9:-9,width:7.8,height:j?4.2:3.6});
 }
 return result;
}
export function raceRampHeight(d,x){const ramp=raceRampSections(d,d).find(r=>Math.abs(r.x-x)<=r.width/2);return ramp?bounded((d-ramp.start)/(ramp.end-ramp.start),0,1)*ramp.height:0;}
export function raceRampGrade(d,x){const ramp=raceRampSections(d,d).find(r=>Math.abs(r.x-x)<=r.width/2);return ramp?ramp.height/(ramp.end-ramp.start):0;}
/** Water is below the roadway. Terrain is cut into a channel; bridge approaches stay on solid banks. */
export function raceTerrainHeight(d,x){
 const road=roadHeight(d)-.13,bridge=raceBridgeSections(d-32,d+32)[0];let h=road;
 if(bridge){const channel=smooth((d-(bridge.start-28))/28)*smooth(((bridge.end+28)-d)/28);h=road+(bridge.waterLevel-2-road)*channel;}
 if(raceBiome(d).id==='coast'&&x>17)h+=(Math.min(h,-4.9)-h)*bounded((x-17)/25,0,1);
 return h;
}
export function raceSceneryAllowed(d,radius=12){return !raceBridgeSections(d-radius-30,d+radius+30).length;}
export function raceWaterSections(start,end){return raceBridgeSections(start,end).map(b=>({id:b.id,start:b.start+2,end:b.end-2,left:-220,right:220,level:b.waterLevel,kind:'river'}));}
export function raceWaterAt(distance,x=0,elevation=roadHeight(distance)){
 return raceWaterSections(distance,distance).find(w=>x>=w.left&&x<=w.right&&elevation<=w.level+.15)||null;
}
/** Civilian traffic takes a smooth line around stunt ramps, leaving their takeoff lanes open. */
export function raceTrafficX(vehicle,d){
 const ramp=raceRampSections(d-35,d+65).find(r=>Math.abs((vehicle.x-480)/10-r.x)<r.width/2+1);
 if(!ramp)return vehicle.x;
 const avoid=smooth((d-(ramp.start-60))/35)*smooth(((ramp.end+35)-d)/30);
 return vehicle.x+(480-vehicle.x)*avoid;
}
/** Rain rolls in and clears; the authoritative race seed keeps every client in sync. */
export function raceWeather(elapsed,seed=0){
 const phase=(Math.max(0,elapsed)+(seed%19))%86;
 const rain=Math.max(0,Math.min(1,(phase-22)/6,(54-phase)/8));
 return {rain,wet:Math.max(rain,Math.max(0,1-(phase-48)/18)*(phase>=48?1:0))};
}
export function raceTarget(players,seat){
 const me=players[seat];let target=-1,best=Infinity;
 players.forEach((p,i)=>{const gap=p.y-me.y;if(i!==seat&&gap>40&&gap<1100&&Math.abs(p.x-me.x)<85&&gap<best){target=i;best=gap;}});
 return target;
}
