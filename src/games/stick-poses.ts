/** Authored side-view drawings. Coordinates are in fighting-lane pixels, feet at y=0.
 * Separate contact, recoil and recovery drawings keep silhouettes readable at speed.
 * The hands, elbows and knees are explicit points: no 3D cylinders or rigid rotation rig.
 */
export type Point=[number,number];
export type StickPose={hip:Point;waist:Point;shoulder:Point;head:Point;rearElbow:Point;rearHand:Point;leadElbow:Point;leadHand:Point;rearKnee:Point;rearFoot:Point;leadKnee:Point;leadFoot:Point};
type Drawing=Partial<StickPose>;
type Key={at:number;pose:StickPose};
export const poseKeys:(keyof StickPose)[]=['hip','waist','shoulder','head','rearElbow','rearHand','leadElbow','leadHand','rearKnee','rearFoot','leadKnee','leadFoot'];
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export const karateStance:StickPose={
 hip:[-6,-47],waist:[-1,-66],shoulder:[5,-83],head:[10,-100],
 rearElbow:[-22,-76],rearHand:[-7,-94],leadElbow:[22,-68],leadHand:[37,-84],
 rearKnee:[-27,-24],rearFoot:[-39,0],leadKnee:[23,-30],leadFoot:[33,0],
};
const pose=(change:Drawing={}):StickPose=>Object.fromEntries(poseKeys.map(k=>[k,[...(change[k]||karateStance[k])]])) as StickPose;
export function mixPose(a:StickPose,b:StickPose,t:number):StickPose{return Object.fromEntries(poseKeys.map(k=>[k,[mix(a[k][0],b[k][0],t),mix(a[k][1],b[k][1],t)]])) as StickPose;}
function keys(frames:[number,Drawing][]):Key[]{return frames.map(([at,p])=>({at,pose:pose(p)}));}
const tuck:Drawing={hip:[-11,-48],waist:[-10,-66],shoulder:[-7,-82],head:[-2,-99],leadElbow:[-3,-67],leadHand:[16,-87],rearElbow:[-22,-70],rearHand:[-6,-87]};
const jab:Drawing={hip:[2,-47],waist:[12,-65],shoulder:[22,-82],head:[24,-101],leadElbow:[48,-87],leadHand:[76,-89],rearElbow:[4,-68],rearHand:[22,-88],leadKnee:[29,-29]};
const cross:Drawing={hip:[5,-47],waist:[17,-65],shoulder:[28,-84],head:[24,-102],rearElbow:[50,-92],rearHand:[78,-96],leadElbow:[18,-65],leadHand:[28,-85],leadKnee:[30,-29]};
const chamber:Drawing={hip:[-9,-53],waist:[-13,-72],shoulder:[-14,-88],head:[-10,-105],leadKnee:[20,-66],leadFoot:[4,-38],rearKnee:[-27,-27],rearFoot:[-35,0],leadElbow:[7,-75],leadHand:[26,-91],rearElbow:[-28,-74],rearHand:[-13,-92]};
const frontKick:Drawing={hip:[-7,-54],waist:[-17,-72],shoulder:[-23,-87],head:[-19,-105],leadKnee:[27,-68],leadFoot:[73,-80],rearKnee:[-27,-27],rearFoot:[-35,0],leadElbow:[-3,-70],leadHand:[15,-87],rearElbow:[-36,-73],rearHand:[-25,-92]};
const roundhouse:Drawing={hip:[-3,-52],waist:[-13,-68],shoulder:[-24,-80],head:[-33,-95],leadKnee:[29,-74],leadFoot:[76,-99],rearKnee:[-28,-27],rearFoot:[-35,0],rearElbow:[-26,-62],rearHand:[-24,-46],leadElbow:[-5,-88],leadHand:[-12,-106]};
const clips:Record<string,Key[]>={
 punch:keys([[0,{}],[.17,tuck],[.34,jab],[.48,{...jab,leadHand:[79,-87],head:[27,-100]}],[.73,{leadElbow:[24,-68],leadHand:[42,-85],hip:[1,-47]}],[1,{}]]),
 cross:keys([[0,{}],[.16,{...tuck,rearHand:[-15,-82]}],[.34,cross],[.48,{...cross,rearHand:[81,-95]}],[.74,{rearElbow:[-2,-63],rearHand:[23,-88],shoulder:[12,-84]}],[1,{}]]),
 frontkick:keys([[0,{}],[.20,chamber],[.40,frontKick],[.53,frontKick],[.77,chamber],[1,{}]]),
 roundhouse:keys([[0,{}],[.22,chamber],[.38,roundhouse],[.52,{...roundhouse,leadFoot:[80,-97],head:[-37,-92]}],[.76,chamber],[1,{}]]),
 sweep:keys([[0,{}],[.23,{hip:[-10,-30],waist:[-16,-47],shoulder:[-17,-62],head:[-10,-79],leadKnee:[19,-15],leadFoot:[42,0],rearKnee:[-32,-13],rearFoot:[-35,0],rearElbow:[-31,-39],rearHand:[-39,-14]}],[.43,{hip:[-5,-24],waist:[-22,-36],shoulder:[-35,-49],head:[-34,-66],leadKnee:[32,-14],leadFoot:[77,-7],rearKnee:[-31,-10],rearFoot:[-37,0],rearElbow:[-43,-24],rearHand:[-48,0],leadElbow:[-10,-51],leadHand:[9,-61]}],[.64,{hip:[-6,-28],waist:[-22,-40],shoulder:[-32,-56],head:[-28,-73],leadKnee:[27,-14],leadFoot:[65,-4],rearKnee:[-31,-10],rearFoot:[-37,0],rearElbow:[-44,-27],rearHand:[-48,0]}],[1,{}]]),
 uppercut:keys([[0,{}],[.20,{hip:[-8,-33],waist:[0,-48],shoulder:[12,-65],head:[19,-81],leadElbow:[16,-44],leadHand:[24,-63],leadKnee:[26,-18]}],[.40,{hip:[5,-47],waist:[20,-64],shoulder:[31,-83],head:[23,-102],leadElbow:[52,-99],leadHand:[57,-126],rearElbow:[9,-71],rearHand:[28,-86],leadKnee:[29,-28],leadFoot:[16,-8],rearKnee:[-24,-25]}],[.65,{hip:[2,-48],waist:[13,-66],shoulder:[20,-87],head:[10,-106],leadElbow:[40,-104],leadHand:[42,-129],leadKnee:[28,-40],leadFoot:[12,-21]}],[1,{}]]),
 divekick:keys([[0,{...chamber,rearKnee:[-30,-40],rearFoot:[-47,-20]}],[.24,{hip:[-9,-48],waist:[-27,-59],shoulder:[-46,-65],head:[-61,-71],leadKnee:[24,-54],leadFoot:[58,-42],rearKnee:[15,-40],rearFoot:[46,-30],leadElbow:[-36,-43],leadHand:[-12,-49],rearElbow:[-47,-40],rearHand:[-25,-37]}],[.42,{hip:[-5,-41],waist:[-27,-52],shoulder:[-47,-58],head:[-63,-63],leadKnee:[33,-37],leadFoot:[72,-30],rearKnee:[27,-25],rearFoot:[64,-18],leadElbow:[-40,-36],leadHand:[-17,-37],rearElbow:[-50,-31],rearHand:[-30,-25]}],[.78,{hip:[-4,-40],waist:[-22,-53],shoulder:[-37,-64],head:[-49,-76],leadKnee:[25,-35],leadFoot:[55,-19],rearKnee:[12,-20],rearFoot:[45,-6]}],[1,{}]]),
 throw:keys([[0,{}],[.20,{hip:[1,-43],waist:[17,-61],shoulder:[29,-78],head:[31,-97],leadElbow:[50,-76],leadHand:[65,-87],rearElbow:[47,-67],rearHand:[61,-79]}],[.46,{hip:[-5,-38],waist:[-4,-58],shoulder:[-1,-78],head:[-6,-96],leadElbow:[24,-96],leadHand:[12,-118],rearElbow:[7,-96],rearHand:[-4,-115],leadKnee:[27,-23]}],[.68,{hip:[-2,-40],waist:[-21,-49],shoulder:[-38,-64],head:[-48,-79],leadElbow:[-53,-53],leadHand:[-68,-39],rearElbow:[-44,-43],rearHand:[-62,-29]}],[1,{}]]),
 blast:keys([[0,{}],[.20,{...tuck,leadElbow:[-14,-64],leadHand:[-1,-73],rearElbow:[-26,-67],rearHand:[-12,-75]}],[.38,{...jab,leadElbow:[45,-80],leadHand:[65,-79],rearElbow:[39,-75],rearHand:[61,-75]}],[.65,{...jab,leadElbow:[45,-80],leadHand:[65,-79],rearElbow:[39,-75],rearHand:[61,-75]}],[1,{}]]),
};
clips.kick=clips.roundhouse;clips.crescent=clips.roundhouse;clips.knee=clips.frontkick;
export const stickAttackKinds=Object.keys(clips);
export function sampleAttackPose(kind:string,progress:number):StickPose{
 const clip=clips[kind]||clips.punch,u=clamp(progress);
 const next=clip.findIndex(k=>k.at>=u);if(next<=0)return pose(clip[0].pose);
 const a=clip[next-1],b=clip[next],f=(u-a.at)/(b.at-a.at);
 // Fast extension reads as a snap; recovery eases back into the guard.
 return mixPose(a.pose,b.pose,f*f*(3-2*f));
}
/** At close range, flex the elbow/knee instead of drawing the fist/foot through a rival. */
export function fitAttackReach(drawing:StickPose,kind:string,distance:number):StickPose{
 const p=pose(drawing),kick=['frontkick','roundhouse','kick','sweep','crescent'].includes(kind);
 if(!kick&&!['punch','cross'].includes(kind))return p;
 const endKey=kick?'leadFoot':kind==='cross'?'rearHand':'leadHand',jointKey=kick?'leadKnee':kind==='cross'?'rearElbow':'leadElbow',start=kick?p.hip:p.shoulder;
 const end=p[endKey],joint=p[jointKey],reach=Math.max(32,distance-12);
 if(end[0]<=reach)return p;
 const l1=Math.hypot(joint[0]-start[0],joint[1]-start[1]),l2=Math.hypot(end[0]-joint[0],end[1]-joint[1]);
 end[0]=reach;const dx=end[0]-start[0],dy=end[1]-start[1],d=Math.max(.1,Math.hypot(dx,dy));
 const along=clamp((l1*l1-l2*l2+d*d)/(2*d),0,l1),height=Math.sqrt(Math.max(0,l1*l1-along*along)),bend=kick?-1:1;
 joint[0]=start[0]+dx/d*along-dy/d*height*bend;joint[1]=start[1]+dy/d*along+dx/d*height*bend;
 return p;
}
export function idlePose(time:number):StickPose{
 const p=pose(),b=Math.sin(time*3.4),shift=Math.sin(time*1.7)*1.2;
 for(const k of ['hip','waist','shoulder','head','rearElbow','rearHand','leadElbow','leadHand'] as const){p[k][0]+=shift;p[k][1]+=b*(k==='hip'?.65:1.2);}
 p.rearKnee[0]+=shift*.5;p.leadKnee[0]+=shift*.5;return p;
}
/** Shuffling steps have a planted phase and a bent-knee swing phase, never a skating foot. */
export function travelPose(distance:number,direction=1,dash=false):StickPose{
 const p=pose(),phase=((distance/110)%1+1)%1;
 for(const [offset,kneeKey,footKey] of [[0,'leadKnee','leadFoot'],[.5,'rearKnee','rearFoot']] as const){
  const u=(phase+offset)%1,swing=clamp((u-.62)/.38),x=u<.62?35-u/.62*70:-35+70*swing;
  p[footKey]=[x*direction,-Math.sin(swing*Math.PI)*13];
  p[kneeKey]=[x*.55*direction+9,-27-Math.sin(swing*Math.PI)*12];
 }
 const bob=Math.cos(phase*Math.PI*4)*1.5;
 for(const k of ['hip','waist','shoulder','head','rearElbow','rearHand','leadElbow','leadHand'] as const)p[k][1]+=bob;
 if(dash){p.hip=[-12,-38];p.waist=[2,-53];p.shoulder=[22,-69];p.head=[32,-85];p.leadElbow=[33,-55];p.leadHand=[47,-72];p.rearElbow=[0,-54];p.rearHand=[13,-74];}
 return p;
}
export function guardPose(time:number,brace=0,parry=0):StickPose{
 const p=pose({hip:[-12,-42],waist:[-9,-60],shoulder:[-4,-77],head:[-1,-95],leadElbow:[17,-71],leadHand:[22,-99],rearElbow:[2,-64],rearHand:[10,-92],rearKnee:[-32,-23],leadKnee:[21,-25]});
 for(const k of ['waist','shoulder','head','rearElbow','rearHand','leadElbow','leadHand'] as const){p[k][0]-=brace*8;p[k][1]+=Math.sin(time*3.4)*.6+brace*3;}
 if(parry){p.leadElbow=[13,-83];p.leadHand=[36,-110];p.rearHand=[7,-91];p.shoulder[0]-=5;}
 return p;
}
export function recoilPose(kind:string,amount:number):StickPose{
 const headHit=['cross','kick','roundhouse','uppercut','crescent'].includes(kind);
 const target=headHit?pose({hip:[-4,-44],waist:[-20,-63],shoulder:[-32,-83],head:[-43,-100],leadElbow:[-2,-71],leadHand:[15,-84],rearElbow:[-36,-62],rearHand:[-20,-76],rearKnee:[-31,-25],leadKnee:[15,-28]}):pose({hip:[-9,-43],waist:[-4,-63],shoulder:[16,-77],head:[30,-87],leadElbow:[24,-55],leadHand:[2,-58],rearElbow:[-13,-51],rearHand:[2,-61],rearKnee:[-29,-24],leadKnee:[22,-23]});
 return mixPose(pose(),target,clamp(amount));
}
export function airbornePose(vy:number):StickPose{return pose({hip:[-2,-48],waist:[3,-67],shoulder:[7,-85],head:[12,-102],leadKnee:[27,-49],leadFoot:[10,-24],rearKnee:[-26,-33],rearFoot:[-39,-5],leadElbow:[28,-79],leadHand:[36,-103],rearElbow:[-15,-72],rearHand:[-1,-90],...(vy>0?{leadKnee:[20,-31],leadFoot:[30,-5]}:{})});}
export function fallenPose():StickPose{return pose({hip:[-4,-13],waist:[-23,-10],shoulder:[-42,-12],head:[-61,-14],rearElbow:[-38,-6],rearHand:[-13,-6],leadElbow:[-27,-21],leadHand:[-44,-28],rearKnee:[20,-7],rearFoot:[48,-5],leadKnee:[19,-19],leadFoot:[45,-7]});}
/** Rotation belongs exclusively to the player's deliberate second-jump flip. */
export function jumpFlipAngle(p:{airFlip?:number;hurtTimer?:number;stun?:number;tumble?:number;hp:number},remaining:number):number{
 if(!((p.airFlip||0)>0)||(p.hurtTimer||0)>0||(p.stun||0)>0||(p.tumble||0)>0||p.hp<=0||remaining<=0)return 0;
 return -Math.PI*2*(1-clamp(remaining/.32));
}
