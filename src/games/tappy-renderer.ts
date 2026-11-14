export type Pilot={x:number;y:number;vy:number;alive:boolean;score:number;gates:number;stars:number;lastStar:number;deathReason:string|null};
export type FlightState={game:string;tick:number;elapsed:number;finished:boolean;waiting:boolean;scroll:number;speed:number;players:Pilot[];gates:{id:number;x:number;width:number;center:number;gap:number}[]};
type Sprites=Record<string,HTMLImageElement>;
export const planeColors=['Red','Blue','Green','Yellow'];
const files=['background','groundGrass','rockGrass','rockGrassDown','starGold','puffSmall',...planeColors.flatMap(color=>[1,2,3].map(frame=>`plane${color}${frame}`))];
let prepared:Promise<Sprites>|undefined;
export function prepareTappyAssets(){
 return prepared??=(Promise.all(files.map(name=>new Promise<[string,HTMLImageElement]>((resolve,reject)=>{
  const img=new Image();img.onload=()=>resolve([name,img]);img.onerror=()=>reject(Error('The flight artwork could not load.'));img.src=`/games/tappy-plane/${name}.png`;
 }))).then(Object.fromEntries).catch(error=>{prepared=undefined;throw error;}));
}
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function drawTappyFlight(ctx:CanvasRenderingContext2D,assets:Sprites,s:FlightState,seat:number|null,width:number,height:number,now:number,ahead:number){
 if(s.waiting)ahead=0;
 const viewWidth=480*width/height,scale=height/480,focus=seat??0,scroll=s.scroll+(s.finished?0:s.speed*ahead),camera=170-viewWidth*.26;
 ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,viewWidth,480);
 ctx.fillStyle='#ccecf6';ctx.fillRect(0,0,viewWidth,480);
 const skyOffset=(scroll*.16)%800;
 for(let x=-skyOffset;x<viewWidth;x+=800)ctx.drawImage(assets.background,x,0,800,480);
 for(const gate of s.gates){
  const x=gate.x-scroll-camera,top=gate.center-gate.gap/2,bottom=gate.center+gate.gap/2;
  ctx.drawImage(assets.rockGrassDown,x-gate.width/2,0,gate.width,top);
  ctx.drawImage(assets.rockGrass,x-gate.width/2,bottom,gate.width,430-bottom);
  if((s.players[focus]?.lastStar??-1)<gate.id){
   const pulse=1+Math.sin(now/210+gate.id)*.07;
   ctx.save();ctx.translate(x,gate.center);ctx.scale(pulse,pulse);ctx.drawImage(assets.starGold,-16,-16,32,32);ctx.restore();
  }
 }
 const groundOffset=scroll%569;
 for(let x=-groundOffset;x<viewWidth;x+=569)ctx.drawImage(assets.groundGrass,x,430,569,50);
 const order=s.players.map((_,i)=>i).sort((a,b)=>Number(a===focus)-Number(b===focus));
 for(const index of order){
  const pilot=s.players[index],x=pilot.x-camera,y=clamp(pilot.y+(pilot.alive&&!s.finished?pilot.vy*ahead+390*ahead*ahead:0),15,415),primary=index===focus;
  ctx.save();ctx.globalAlpha=primary?1:pilot.alive?.48:.2;
  if(pilot.alive){
   for(let i=0;i<3;i++){const drift=((now/19+i*18)%55);ctx.globalAlpha=(primary?.4:.15)*(1-drift/55);ctx.drawImage(assets.puffSmall,x-36-drift,y+5+Math.sin(i+now/140)*3,14+drift*.13,14+drift*.13);}
   ctx.globalAlpha=primary?1:.48;
  }
  ctx.translate(x,y);ctx.rotate(pilot.alive?clamp(pilot.vy/670,-.38,.65):.7);
  if(primary){ctx.shadowColor='rgba(39,71,78,.25)';ctx.shadowBlur=6;ctx.shadowOffsetY=4;}
  const frame=pilot.alive&&!s.finished?Math.floor(now/80)%3+1:1;
  ctx.drawImage(assets[`plane${planeColors[index%4]}${frame}`],-33,-27,66,55);ctx.restore();
  if(primary){ctx.fillStyle='#264b57';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText(seat===null?'WATCHING':'YOU',x,y-40);}
 }
}
