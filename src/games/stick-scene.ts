import * as T from 'three';
import {Kit} from './world-kit';
import {stickEffects} from './stick-effects';
import {solveStickLeg} from './stick-kinematics';

let terrace:Promise<T.Texture>|undefined;
export function loadStickTerrace(){
 return terrace??=new T.TextureLoader().loadAsync('/models/fighters/vampire-terrace.webp').then(texture=>{texture.colorSpace=T.SRGBColorSpace;return texture;}).catch(error=>{terrace=undefined;throw error;});
}

const W=(x:number)=>(x-480)/10;
const FY=(y:number)=>(410-y)/10;
const clamp=T.MathUtils.clamp;

const STICK_PALETTE=[
 {main:'#3cf2ff',glow:'#00a6ff',core:'#0d1322',aura:'#73f7ff',name:'CYAN'},
 {main:'#ff473d',glow:'#ff1500',core:'#1f0b0e',aura:'#ff8566',name:'CRIMSON'},
 {main:'#ffe042',glow:'#ffaa00',core:'#211a08',aura:'#fff08a',name:'GOLD'},
 {main:'#5eff47',glow:'#1fd600',core:'#0b1f0d',aura:'#a2ff96',name:'JADE'},
];

type JointName='spine'|'chest'|'neck'|'wristL'|'wristR'|'ankleL'|'ankleR'|'head'|'shL'|'elL'|'shR'|'elR'|'hipL'|'knL'|'hipR'|'knR';
type JointState={angle:number;vel:number;target:number};

interface StickRig {
 root:T.Group;
 hip:T.Group;
 spine:T.Group;chest:T.Group;neck:T.Group;
 wristL:T.Group;wristR:T.Group;ankleL:T.Group;ankleR:T.Group;
 head:T.Group;
 shL:T.Group;elL:T.Group;fistL:T.Mesh;
 shR:T.Group;elR:T.Group;fistR:T.Mesh;
 hipL:T.Group;knL:T.Group;footL:T.Mesh;
 hipR:T.Group;knR:T.Group;footR:T.Mesh;
 headband:T.Mesh;
 headbandTail:T.Mesh;
 slashArc:T.Group;
 speedLines:T.Group;
 kiAura:T.Group;
 ghosts:T.Group[];
 ghostHistory:{x:number;y:number;facing:number;transforms:{rotation:number;x:number;y:number}[]}[];
 joints:Record<JointName,JointState>;
 lastSeq:number;
 poseKind:string;
 poseTimer:number;
 poseDuration:number;
 tumbleAngle:number;
 prevVx:number;
 prevVy:number;
 koAge:number;stride:number;flipTimer:number;wasFlipping:boolean;
}

/** Tapered limb segment pointing DOWN from (0,0,0) to (0,-len,0).
 * Supports flared martial-arts cuffs (wider bottom radius) inspired by Stick Fight & Xiao Xiao.
 */
function makeLimbSegment(rTop:number,rBot:number,len:number,mat:T.Material):T.Group{
 const g=new T.Group();
 const cyl=new T.CylinderGeometry(rTop,rBot,len,12);
 cyl.translate(0,-len/2,0);
 const m=new T.Mesh(cyl,mat);
 m.castShadow=m.receiveShadow=true;
 g.add(m);
 const jointBall=new T.Mesh(new T.SphereGeometry(rTop*1.04,10,8),mat);
 g.add(jointBall);
 return g;
}

function createStickFighterRig(seat:number,k:Kit):StickRig{
 const pal=STICK_PALETTE[seat%STICK_PALETTE.length];
 const mat=new T.MeshStandardMaterial({color:pal.main,emissive:pal.glow,emissiveIntensity:.16,roughness:.75,metalness:0});
 const limbMat=new T.MeshStandardMaterial({color:pal.main,emissive:pal.glow,emissiveIntensity:.13,roughness:.75,metalness:0});
 const cuffMat=new T.MeshStandardMaterial({color:pal.main,emissive:pal.glow,emissiveIntensity:.18,roughness:.7,metalness:0});
 const fistMat=new T.MeshStandardMaterial({color:'#ffffff',emissive:pal.main,emissiveIntensity:.8,roughness:.18});

 const root=new T.Group();
 root.name=`stick-fighter-${seat}`;

 const hip=new T.Group();
 hip.position.set(0,3.35,0);
 root.add(hip);

 // Pelvis & Articulated Spine (pointing UP from 0 to +2.45)
 const spine=new T.Group();
 hip.add(spine);
 const torsoGeo=new T.CylinderGeometry(.27,.23,1.12,12);
 torsoGeo.translate(0,.56,0);
 const torsoMesh=new T.Mesh(torsoGeo,mat);
 torsoMesh.castShadow=true;
 spine.add(torsoMesh);
 const belt=new T.Mesh(new T.CylinderGeometry(.3,.3,.22,12),new T.MeshStandardMaterial({color:'#161323',roughness:.85}));belt.position.y=.35;spine.add(belt);
 const beltEnd=new T.Mesh(new T.BoxGeometry(.12,.65,.1),belt.material);beltEnd.position.set(.22,.06,.3);beltEnd.rotation.z=.2;spine.add(beltEnd);
 const chest=new T.Group();chest.position.y=1.1;spine.add(chest);
 const upperTorsoGeo=new T.CylinderGeometry(.32,.27,1.25,12);upperTorsoGeo.translate(0,.625,0);
 const upperTorso=new T.Mesh(upperTorsoGeo,mat);upperTorso.castShadow=true;chest.add(upperTorso);
 const chestBall=new T.Mesh(new T.SphereGeometry(.33,12,10),mat);
 chestBall.position.y=1.15;
 chest.add(chestBall);

 // Iconic Round Stickman Head + Expressive Eyes + Flowing Martial Headband
 const neck=new T.Group();neck.position.set(0,1.35,0);chest.add(neck);
 const neckBone=new T.Mesh(new T.CapsuleGeometry(.14,.25,4,8),mat);neckBone.position.y=.1;neck.add(neckBone);
 const head=new T.Group();head.position.set(0,.17,0);neck.add(head);
 const headBall=new T.Mesh(new T.SphereGeometry(.64,22,18),mat);
 headBall.castShadow=true;
 head.add(headBall);

 // Fierce angled martial arts eyes (facing +X in local rig space)
 const eyeMat=new T.MeshBasicMaterial({color:'#ffffff'});
 for(const ez of [-.27,.27]){
  const eye=new T.Mesh(new T.BoxGeometry(.18,.12,.22),eyeMat);
  eye.position.set(.56,.12,ez*.7);
  eye.rotation.x=ez>0?-.22:.22;
  head.add(eye);
 }

 // Flowing 2-segment ninja headband
 const bandGeo=new T.BoxGeometry(.65,.17,.15);
 bandGeo.translate(-.32,0,0);
 const headband=new T.Mesh(bandGeo,fistMat);
 headband.position.set(-.6,.26,0);
 head.add(headband);headband.visible=false;
 const tailGeo=new T.BoxGeometry(.4,.12,.1);
 tailGeo.translate(-.2,0,0);
 const headbandTail=new T.Mesh(tailGeo,fistMat);
 headbandTail.position.set(-.6,0,0);
 headband.add(headbandTail);

 // Rear Arm (shL -> elL -> fistL)
 const shL=new T.Group();shL.position.set(0,1.05,-.46);chest.add(shL);
 shL.add(makeLimbSegment(.21,.19,1.28,limbMat));
 const elL=new T.Group();elL.position.set(0,-1.28,0);shL.add(elL);
 elL.add(makeLimbSegment(.19,.26,1.25,cuffMat));
 const fistL=new T.Mesh(new T.SphereGeometry(.25,12,10),mat);
 const wristL=new T.Group();wristL.position.set(0,-1.28,0);elL.add(wristL);wristL.add(fistL);

 // Lead Arm (shR -> elR -> fistR)
 const shR=new T.Group();shR.position.set(0,1.05,.46);chest.add(shR);
 shR.add(makeLimbSegment(.21,.19,1.28,limbMat));
 const elR=new T.Group();elR.position.set(0,-1.28,0);shR.add(elR);
 elR.add(makeLimbSegment(.19,.26,1.25,cuffMat));
 const fistR=new T.Mesh(new T.SphereGeometry(.26,12,10),mat);
 const wristR=new T.Group();wristR.position.set(0,-1.28,0);elR.add(wristR);wristR.add(fistR);

 // Rear Leg (hipL -> knL -> footL) with flared martial arts shin cuff (like @draww.master)
 const hipL=new T.Group();hipL.position.set(0,0,-.3);hip.add(hipL);
 hipL.add(makeLimbSegment(.24,.21,1.58,limbMat));
 const knL=new T.Group();knL.position.set(0,-1.58,0);hipL.add(knL);
 knL.add(makeLimbSegment(.21,.36,1.62,cuffMat));
 const footL=new T.Mesh(new T.CapsuleGeometry(.15,.32,4,8),mat);
 const ankleL=new T.Group();ankleL.position.set(0,-1.65,0);knL.add(ankleL);footL.position.set(.18,0,0);ankleL.add(footL);footL.rotation.z=Math.PI/2;

 // Lead Leg (hipR -> knR -> footR) with flared martial arts shin cuff
 const hipR=new T.Group();hipR.position.set(0,0,.3);hip.add(hipR);
 hipR.add(makeLimbSegment(.24,.21,1.58,limbMat));
 const knR=new T.Group();knR.position.set(0,-1.58,0);hipR.add(knR);
 knR.add(makeLimbSegment(.21,.36,1.62,cuffMat));
 const footR=new T.Mesh(new T.CapsuleGeometry(.15,.32,4,8),mat);
 const ankleR=new T.Group();ankleR.position.set(0,-1.65,0);knR.add(ankleR);footR.position.set(.18,0,0);ankleR.add(footR);footR.rotation.z=Math.PI/2;

 // Calligraphic Martial Arts Smear Arc (Outer Neon + Inner White Crescent)
 const slashArc=new T.Group();
 const outerSlash=new T.Mesh(
  new T.RingGeometry(2.82,3.15,28,1,-Math.PI*.42,Math.PI*.84),
  new T.MeshBasicMaterial({color:pal.main,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false})
 );
 const innerSlash=new T.Mesh(
  new T.RingGeometry(3.02,3.18,28,1,-Math.PI*.34,Math.PI*.68),
  new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false})
 );
 innerSlash.position.z=.04;
 slashArc.add(outerSlash,innerSlash);
 slashArc.position.set(1.2,4.1,.55);
 root.add(slashArc);

 // Anime Horizontal Speed Lines (visible during Dash, Flying Knee & Dropkick)
 const speedLines=new T.Group();
 const lineMat=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.75,depthWrite:false});
 for(const [lx,ly,lw] of [[-2.4,4.8,2.8],[-3.1,3.6,3.5],[-2.2,2.4,2.5],[-2.9,1.3,3.1]]){
  const line=new T.Mesh(new T.PlaneGeometry(lw,.11),lineMat);
  line.position.set(lx,ly,-.2);
  speedLines.add(line);
 }
 speedLines.visible=false;
 root.add(speedLines);

 // Spiky Anime Ki Charge Aura (Image 2 Panels 26, 27, 43)
 const kiAura=new T.Group();
 const auraOuterMat=new T.MeshBasicMaterial({color:pal.main,transparent:true,opacity:.38,side:T.DoubleSide,depthWrite:false});
 const auraInnerMat=new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.55,side:T.DoubleSide,depthWrite:false});
 for(let a=0;a<7;a++){
  const spike=new T.Mesh(new T.ConeGeometry(.65+a*.12,4.8+(a%3)*1.4,5),a%2===0?auraOuterMat:auraInnerMat);
  spike.position.set((a-3)*.38,2.6,-.35);
  spike.rotation.z=(a-3)*-.12;
  kiAura.add(spike);
 }
 kiAura.visible=false;
 root.add(kiAura);

 // 3 Afterimage Silhouette Ghosts (Image 2 Panels 31, 40)
 const ghosts:T.Group[]=[];
 for(let gIdx=0;gIdx<3;gIdx++){
  const gRoot=new T.Group();
  const gMat=new T.MeshBasicMaterial({color:pal.main,transparent:true,opacity:.26-gIdx*.07,depthWrite:false});
  const silhouette=hip.clone(true);
  silhouette.traverse(node=>{if(node instanceof T.Mesh)node.material=gMat;});
  gRoot.add(silhouette);
  gRoot.visible=false;
  k.dynamic.add(gRoot);
  ghosts.push(gRoot);
 }

 const jointNames:JointName[]=['spine','chest','neck','wristL','wristR','ankleL','ankleR','head','shL','elL','shR','elR','hipL','knL','hipR','knR'];
 const joints={} as Record<JointName,JointState>;
 for(const name of jointNames)joints[name]={angle:0,vel:0,target:0};

 return {
  root,hip,spine,chest,neck,wristL,wristR,ankleL,ankleR,head,shL,elL,fistL,shR,elR,fistR,hipL,knL,footL,hipR,knR,footR,
  headband,headbandTail,slashArc,speedLines,kiAura,
  ghosts,ghostHistory:[],joints,
  lastSeq:0,poseKind:'punch',poseTimer:0,poseDuration:.36,tumbleAngle:0,
  prevVx:0,prevVy:0,koAge:0,stride:0,flipTimer:0,wasFlipping:false
 };
}

function stepRigPhysics(rig:StickRig,p:any,dt:number,t:number){
 const facing=p.facing>=0?1:-1;
 rig.root.scale.set(facing*1.22,1.22,1.22);

 const vx=(p.vx||0)*facing;
 const vy=p.vy||0;
 const ax=clamp((vx-rig.prevVx)/Math.max(dt,.01),-900,900);
 const ay=clamp((vy-rig.prevVy)/Math.max(dt,.01),-1200,1200);
 rig.prevVx=vx;rig.prevVy=vy;

 // Trigger crisp client-side martial arts pose timer whenever attackSeq increments
 if((p.attackSeq||0)!==rig.lastSeq){
  rig.lastSeq=p.attackSeq||0;
  rig.poseKind=p.attackKind||'punch';
  rig.poseDuration=p.attackDuration||(['kick','sweep','divekick','crescent','throw','blast'].includes(rig.poseKind)?.30:.22);
  rig.poseTimer=rig.poseDuration;
 }
 rig.poseTimer=Math.max(0,rig.poseTimer-dt);

 const J=rig.joints;
 const speed=Math.abs(p.vx||0);
 rig.stride+=speed*dt*.065;
 const runCycle=rig.stride;
 const inPose=rig.poseTimer>0||(p.attack||0)>0;
 const kind=inPose?rig.poseKind:(p.attackKind||'punch');

 // Reset hip rotation unless tumbling or dropkicking
 const flipping=(p.airFlip||0)>0;
 if(flipping&&!rig.wasFlipping)rig.flipTimer=.32;rig.wasFlipping=flipping;
 if(rig.flipTimer>0){
  rig.flipTimer=Math.max(0,rig.flipTimer-dt);rig.hip.rotation.z=-Math.PI*2*(1-rig.flipTimer/.32);
 }else if((p.tumble||0)>0&&!p.ground){
  rig.tumbleAngle+=dt*15;
  rig.hip.rotation.z=-rig.tumbleAngle;
 }else{
  rig.tumbleAngle=0;
  rig.hip.rotation.z=T.MathUtils.lerp(rig.hip.rotation.z,0,Math.min(1,dt*14));
 }

 let targetHipY=3.28;
 let targetHipX=0;

 if(p.hp<=0){
  rig.koAge+=dt;rig.hip.rotation.z=1.5;
  // KO Collapse flat on the ground (Image 1 & 2 Panel 53)
  J.spine.target=.08;J.head.target=.15;
  J.shL.target=.9;J.elL.target=1.2;
  J.shR.target=1.2;J.elR.target=.5;
  J.hipL.target=.1;J.knL.target=-.1;
  J.hipR.target=-.13;J.knR.target=.2;
  targetHipY=1.1;
 }else if((p.hurtTimer||p.stun||0)>0){
  rig.koAge=0;
  // Expressive Head-Snap / Gut-Doubled Recoil (Image 1 #1, #2, #3 victim postures!)
  const recoil=Math.sin(Math.min(1,(p.hurtTimer||0)/.24)*Math.PI*.85);
  J.spine.target=(['punch','knee','divekick'].includes(p.hurtKind)?.85:-.82)*(.4+recoil*.6);
  J.head.target=-.58;
  J.shL.target=-.95;J.elL.target=1.1;
  J.shR.target=.85;J.elR.target=1.25;
  J.hipR.target=.48;J.knR.target=-.85;
  J.hipL.target=-.35;J.knL.target=-.45;
  targetHipY=2.95;
  targetHipX=-.35;
 }else if(inPose){
  rig.koAge=0;
  // Normalized progress u in [0..1], with a strong hold plateau so the silhouette reads clearly!
  const rawU=1-clamp(rig.poseTimer/Math.max(.01,rig.poseDuration),0,1);
  // A tiny wind-up, fast extension, then an elastic follow-through and return.
  const snap=rawU<.10?-.16*Math.sin(rawU/.10*Math.PI):rawU<.30?Math.sin((rawU-.10)/.20*Math.PI/2):Math.pow(1-(rawU-.30)/.70,.65);

  if(kind==='punch'){
   // 1. Lunging Straight Body/Face Jab (Image 1 #1 & Image 3 #1-2)
   J.spine.target=.42*snap;
   J.head.target=-.18*snap;
   J.shR.target=1.58*snap+.2;J.elR.target=.04*(1-snap);
   J.shL.target=-.95*snap;J.elL.target=1.25;
   J.hipR.target=.86*snap+.25;J.knR.target=-.68*snap-.15;
   J.hipL.target=-.78*snap-.25;J.knL.target=-.08;
   targetHipY=3.28-.45*snap;
   targetHipX=.55*snap;
  }else if(kind==='cross'){
   // 2. High Chin Hook / Overhand Cross (Image 1 #2 & Image 3 #4-5)
   J.spine.target=.52*snap;
   J.head.target=-.24*snap;
   J.shL.target=1.78*snap+.2;J.elL.target=.06*(1-snap);
   J.shR.target=-.88*snap;J.elR.target=1.35;
   J.hipR.target=.78*snap+.25;J.knR.target=-.58*snap-.15;
   J.hipL.target=-.72*snap-.25;J.knL.target=-.12;
   targetHipY=3.28-.38*snap;
   targetHipX=.62*snap;
  }else if(kind==='frontkick'||kind==='knee'){
   // Chamber the knee, snap the lower leg out, then pull it back before landing.
   const extension=Math.sin(clamp((rawU-.12)/.68,0,1)*Math.PI);
   J.spine.target=-.2*extension;J.head.target=.16;
   J.shR.target=.95;J.elR.target=1.45;J.shL.target=-.35;J.elL.target=1.8;
   J.hipR.target=2.15-extension*.55;J.knR.target=-2.35*(1-extension);
   J.hipL.target=-.05;J.knL.target=-.1;targetHipY=3.25;targetHipX=.2*extension;
  }else if(kind==='crescent'){
   // 8. Vertical 180° Crescent Split KO Kick (Image 1 bottom-right "KO" & Image 3 Kick #4)
   J.spine.target=-.46*snap;
   J.head.target=.28*snap;
   J.shR.target=-.55*snap;J.elR.target=1.25;
   J.shL.target=.85*snap;J.elL.target=.95;
   J.hipR.target=2.68*snap;J.knR.target=0;
   J.hipL.target=-.08;J.knL.target=-.05;
   targetHipY=3.35;
  }else if(kind==='uppercut'){
   // Rising Dragon Uppercut
   J.spine.target=-.28*snap;
   J.head.target=.32*snap;
   J.shR.target=2.55*snap+.25;J.elR.target=.22;
   J.shL.target=-.92;J.elL.target=1.2;
   J.hipR.target=.72*snap;J.knR.target=-.52;
   J.hipL.target=-.48;J.knL.target=-.35;
   targetHipY=3.55;
  }else if(kind==='sweep'){
   // 4. Low Hand-Planted Leg Sweep (Image 1 #4 & Image 3 Kick #5)
   J.spine.target=-.38*snap;
   J.head.target=.25*snap;
   J.shL.target=-.25*snap;J.elL.target=0;
   J.shR.target=-.95*snap;J.elR.target=.45;
   J.hipR.target=1.52*snap;J.knR.target=0;
   J.hipL.target=-1.15*snap;J.knL.target=-1.75*snap;
   targetHipY=3.28-1.68*snap;
   targetHipX=.45*snap;
  }else if(kind==='divekick'){
   // 6. Horizontal Mid-Air Two-Foot Dropkick (Image 1 middle-right & bottom-center)
   J.spine.target=-1.35*snap;
   J.head.target=.45*snap;
   J.shR.target=-.75;J.elR.target=.55;
   J.shL.target=-1.05;J.elL.target=.45;
   J.hipR.target=1.64*snap;J.knR.target=0;
   J.hipL.target=1.48*snap;J.knL.target=0;
   targetHipY=3.15;
   targetHipX=.65*snap;
  }else if(kind==='throw'){
   // 7. Judo Overhead Throw Whip (Image 1 bottom-left)
   const whip=rawU<.45?rawU/.45:1-(rawU-.45)*2.2;
   J.spine.target=.78*snap;
   J.head.target=-.35*snap;
   J.shR.target=1.85*whip;J.elR.target=.35;
   J.shL.target=1.65*whip;J.elL.target=.45;
   J.hipR.target=.85*snap;J.knR.target=-.65*snap;
   J.hipL.target=-.75*snap;J.knL.target=-.15;
   targetHipY=2.75;
  }else if(kind==='blast'){
   // Ki Energy Beam Two-Hand Thrust (Image 2 Panels 14, 34, 44)
   J.spine.target=.32*snap;
   J.head.target=-.15*snap;
   J.shR.target=1.52*snap;J.elR.target=.18;
   J.shL.target=1.46*snap;J.elL.target=.22;
   J.hipR.target=.78*snap;J.knR.target=-.65*snap;
   J.hipL.target=-.72*snap;J.knL.target=-.25;
   targetHipY=2.72;
  }else{
   // 3. High Roundhouse Face Kick (Image 1 #3 & Image 3 Kick #1,3)
   J.spine.target=-.52*snap;
   J.head.target=.28*snap;
   J.shR.target=.65*snap;J.elR.target=1.25;
   J.shL.target=-.82*snap;J.elL.target=.35;
   J.hipR.target=2.04*snap;J.knR.target=0;
   J.hipL.target=-.14*snap;J.knL.target=-.06;
   targetHipY=3.32;
   targetHipX=.35*snap;
  }
 }else if((p.parryPose||0)>0){
  J.spine.target=-.2;J.head.target=.15;J.shR.target=1.9;J.elR.target=.6;J.shL.target=1.1;J.elL.target=1.4;
  J.hipR.target=.7;J.knR.target=-.65;J.hipL.target=-.6;J.knL.target=-.25;targetHipY=2.95;
 }else if(p.blocking&&(p.dashTimer||0)<=0){
  // Tight Martial Guard / Ki Charge Stance (Image 1 VS & Image 2 Panels 26-27)
  const pulse=p.charging?Math.sin(t*24)*.08:0;
  const brace=(p.guardHit||0)/.22;
  J.spine.target=.14+pulse-brace*.4;
  J.head.target=-.08;
  J.shR.target=p.charging?.65:1.15;J.elR.target=1.55;
  J.shL.target=p.charging?.55:.98;J.elL.target=1.65;
  J.hipR.target=.58;J.knR.target=-.52;
  J.hipL.target=-.55;J.knL.target=-.35;
  targetHipY=2.92-brace*.3;
  targetHipX=-brace*.22;
 }else if(!p.ground){
  // Dynamic Martial Air Leap Pose (Image 2 Panels 9, 10, 36)
  const rising=vy<0;
  J.spine.target=rising?.32:-.15;
  J.head.target=rising?-.12:.18;
  J.shR.target=rising?1.85:.75;J.elR.target=.85;
  J.shL.target=rising?-.65:.45;J.elL.target=.95;
  J.hipR.target=rising?1.15:.55;J.knR.target=rising?-1.35:-.55;
  J.hipL.target=rising?-.65:-.35;J.knL.target=rising?-.75:-.45;
  targetHipY=3.35;
 }else if(speed>12){
  // Guarded shuffle: foot placement drives the knees, while the hands stay ready.
  const isDash=(p.dashTimer||0)>0;
  const s1=Math.sin(runCycle),c1=Math.cos(runCycle);
  J.spine.target=(isDash?.38:.15)+Math.abs(s1)*.04;
  J.head.target=isDash?-.32:-.18;
  J.shR.target=1.0+s1*.14;J.elR.target=1.38+c1*.12;
  J.shL.target=-.38-s1*.12;J.elL.target=1.75-c1*.1;
  J.hipR.target=s1*.78;J.knR.target=s1<0?s1*1.25:-.22;
  J.hipL.target=-s1*.78;J.knL.target=-s1<0?-s1*1.25:-.22;
  targetHipY=3.12+Math.abs(c1)*.28;
 }else{
  // Iconic Wide-Stance Martial Arts Guard Idle (Image 1 top-left "VS")
  const b=Math.sin(t*3.8);
  targetHipX=Math.sin(t*1.9)*.12;
  J.spine.target=.16+b*.05;
  J.head.target=-.08-b*.04;
  J.shR.target=.92+b*.12;J.elR.target=1.38;
  J.shL.target=-.42-b*.08;J.elL.target=1.9;
  J.hipR.target=.56+Math.sin(t*1.9)*.06;J.knR.target=-.4-b*.08;
  J.hipL.target=-.52+Math.sin(t*1.9)*.05;J.knL.target=-.22+b*.06;
  targetHipY=3.15+b*.12;
 }

 const hurtNow=(p.hurtTimer||0)>0;
 if(p.ground&&p.hp>0){
  targetHipY=p.blocking?2.25-(p.guardHit||0)*.5:hurtNow?2.25:inPose?Math.min(targetHipY,2.55):2.48+Math.sin(t*3.8)*.045;
  if(speed>12&&!inPose&&!p.blocking)targetHipY=2.48+Math.abs(Math.sin(runCycle))*.12;
 }
 // Secondary joints distribute a strike through the whole body instead of one rigid torso.
 const hurt=(p.hurtTimer||0)>0,breath=Math.sin(t*3.8)*.035;
 J.chest.target=J.spine.target*(hurt?-.45:inPose?.28:-.18)+breath;
 J.neck.target=-J.chest.target*.5+clamp(-ax*.00018,-.12,.12);
 J.wristL.target=-(J.shL.target+J.elL.target)*.10+Math.sin(t*4)*.06;
 J.wristR.target=-(J.shR.target+J.elR.target)*.10+(inPose?Math.sin((1-rig.poseTimer/rig.poseDuration)*Math.PI*2)*.22:Math.sin(t*4+.7)*.06);
 J.ankleL.target=-(J.hipL.target+J.knL.target)*.85;
 J.ankleR.target=inPose&&['kick','crescent','roundhouse','frontkick','divekick'].includes(kind)?.28:-(J.hipR.target+J.knR.target)*.85;
 if(p.hp<=0){J.chest.target=-.08;J.neck.target=.2;J.wristL.target=.45;J.wristR.target=-.35;J.ankleL.target=.18;J.ankleR.target=-.2;}
 rig.hip.position.y=T.MathUtils.lerp(rig.hip.position.y,targetHipY,Math.min(1,dt*18));
 rig.hip.position.x=T.MathUtils.lerp(rig.hip.position.x,targetHipX,Math.min(1,dt*18));

 // Inject secondary physics inertia
 J.spine.vel+=(-ax*.008-(p.leanVel||0)*1.8)*dt;
 J.head.vel+=(-ax*.012+ay*.006)*dt;

 // High-responsiveness spring-damper solver so martial poses snap like Stick Fight / Xiao Xiao!
 const stiffness=p.hp<=0?55:inPose?680:240;
 const damping=p.hp<=0?7:inPose?28:18;
 for(const key of Object.keys(J) as JointName[]){
  const j=J[key];
  const secondary=['chest','neck','head','wristL','wristR','ankleL','ankleR'].includes(key);
  if((inPose||hurt)&&!secondary){j.angle+=(j.target-j.angle)*(1-Math.exp(-45*dt));j.vel=0;}
  else{j.vel+=(j.target-j.angle)*(secondary?330:stiffness)*dt;j.vel*=Math.exp(-(secondary?14:damping)*dt);j.angle+=j.vel*dt;}
 }

 // Plant each support foot, then solve its thigh, knee and ankle around the moving pelvis.
 // During a step the rear foot lifts and folds; during a kick only the support leg is planted.
 if(p.ground&&p.hp>0){
  const moving=speed>12&&!inPose&&!hurtNow&&(!p.blocking||(p.dashTimer||0)>0);
  const foot=(offset:number)=>{
   if(!moving)return {x:offset===0?1.65:-1.85,y:.16};
   const phase=((rig.stride/(Math.PI*2)+offset)%1+1)%1;
   if(phase<.62)return {x:2.15-phase/.62*4.3,y:.16};
   const u=(phase-.62)/.38,e=u*u*(3-2*u);
   return {x:-2.15+e*4.3,y:.16+Math.sin(u*Math.PI)*1.05};
  };
  const plant=(side:'L'|'R',offset:number)=>{
   const f=foot(offset),leg=solveStickLeg(f.x-rig.hip.position.x,f.y-rig.hip.position.y,1.58,1.65,side==='L'&&!moving?-1:1);
   J[side==='L'?'hipL':'hipR'].angle=leg.hip;
   J[side==='L'?'knL':'knR'].angle=leg.knee;
   J[side==='L'?'ankleL':'ankleR'].angle=leg.ankle;
  };
  plant('L',.5);
  if(!inPose||!['kick','roundhouse','frontkick','sweep','crescent'].includes(kind))plant('R',0);
 }
 // Apply rotations (note: positive J.spine.angle = forward lean -> negative rotation.z in local space)
 rig.spine.rotation.z=-J.spine.angle-(p.lean||0)*.35;
 rig.chest.rotation.z=-J.chest.angle;rig.neck.rotation.z=-J.neck.angle;
 rig.wristL.rotation.z=J.wristL.angle;rig.wristR.rotation.z=J.wristR.angle;
 rig.ankleL.rotation.z=J.ankleL.angle;rig.ankleR.rotation.z=J.ankleR.angle;
 rig.head.rotation.z=-J.head.angle;
 rig.shL.rotation.z=J.shL.angle;rig.elL.rotation.z=J.elL.angle;
 rig.shR.rotation.z=J.shR.angle;rig.elR.rotation.z=J.elR.angle;
 rig.hipL.rotation.z=J.hipL.angle;rig.knL.rotation.z=J.knL.angle;
 rig.hipR.rotation.z=J.hipR.angle;rig.knR.rotation.z=J.knR.angle;

 // Cartoon Impact Scaling on Striking Limb (Fist or Foot)
 const punchStrike=inPose&&(kind==='punch'||kind==='cross'||kind==='uppercut');
 const kickStrike=inPose&&['kick','sweep','divekick','crescent','frontkick','roundhouse'].includes(kind);
 rig.fistR.scale.setScalar(punchStrike&&kind!=='cross'?1.65:1);
 rig.fistL.scale.setScalar(punchStrike&&kind==='cross'?1.65:1);
 rig.footR.scale.setScalar(kickStrike?1.55:1);
 rig.footL.scale.setScalar(inPose&&kind==='divekick'?1.45:1);

 // Flowing 2-stage ninja headband physics
 rig.headband.rotation.z=Math.sin(t*15)*.24+clamp(vy*.002,-.5,.5);
 rig.headbandTail.rotation.z=Math.cos(t*15-.8)*.32;

 // Calligraphic Smear Arc (Image 1, 3, 4)
 const outerMat=(rig.slashArc.children[0] as T.Mesh).material as T.MeshBasicMaterial;
 const innerMat=(rig.slashArc.children[1] as T.Mesh).material as T.MeshBasicMaterial;
 if(inPose&&kind!=='blast'&&rig.poseTimer<rig.poseDuration*.82&&rig.poseTimer>rig.poseDuration*.12){
  const alpha=clamp((rig.poseTimer/rig.poseDuration)*1.45,0,.92);
  outerMat.opacity=alpha;
  innerMat.opacity=alpha*.85;
  if(kind==='sweep'){
   rig.slashArc.position.set(1.65,.75,.55);
   rig.slashArc.rotation.set(1.15,0,-.2);
   rig.slashArc.scale.set(1.35,1.1,1);
  }else if(kind==='crescent'||kind==='uppercut'){
   rig.slashArc.position.set(1.45,4.4,.55);
   rig.slashArc.rotation.set(0,0,.45);
   rig.slashArc.scale.set(1.45,1.55,1);
  }else if(kind==='kick'||kind==='divekick'||kind==='frontkick'||kind==='roundhouse'){
   rig.slashArc.position.set(1.65,4.1,.55);
   rig.slashArc.rotation.set(0,0,-.25);
   rig.slashArc.scale.set(1.3,1.25,1);
  }else{
   rig.slashArc.position.set(1.85,4.4,.55);
   rig.slashArc.rotation.set(0,0,0);
   rig.slashArc.scale.set(1,.38,1);
  }
 }else{
  outerMat.opacity=0;
  innerMat.opacity=0;
 }

 // Speed lines & Ki Aura visibility
 rig.speedLines.visible=Boolean((p.dashTimer||0)>0||(inPose&&(kind==='divekick'||kind==='knee')));
 rig.kiAura.visible=Boolean(p.hp>0&&inPose&&kind==='blast');
 if(rig.kiAura.visible){
  rig.kiAura.scale.set(1+Math.sin(t*28)*.12,1+Math.cos(t*24)*.15,1);
 }

 // Afterimage Silhouette Trail (Image 2 Panels 31, 40)
 const wx=rig.root.position.x,wy=rig.root.position.y;
 const transforms:{rotation:number;x:number;y:number}[]=[];rig.hip.traverse(node=>transforms.push({rotation:node.rotation.z,x:node.position.x,y:node.position.y}));
 rig.ghostHistory.unshift({x:wx,y:wy,facing,transforms});
 if(rig.ghostHistory.length>12)rig.ghostHistory.pop();
 const showGhosts=Boolean(p.hp>0&&((p.dashTimer||0)>0||inPose&&['divekick','frontkick','roundhouse','throw'].includes(kind)));
 rig.ghosts.forEach((g,idx)=>{
  const sample=rig.ghostHistory[(idx+1)*3];
  g.visible=Boolean(showGhosts&&sample);
  if(sample){
   g.position.set(sample.x,sample.y,-.3-idx*.1);
   g.scale.set(sample.facing*1.22,1.22,1.22);let n=0;g.children[0].traverse(node=>{const tr=sample.transforms[n++];if(tr){node.rotation.z=tr.rotation;node.position.x=tr.x;node.position.y=tr.y;}});
  }
 });
}

/** Original Yokai terrace, with articulated fighters in a single side-on lane. */
export function stickScene(k:Kit,s:any,terraceTexture:T.Texture):((state:any,dt:number,t:number)=>void){
 k.scene.background=new T.Color('#170f25');
 const map=terraceTexture.clone();map.needsUpdate=true;k.textures.push(map);
 const backdrop=new T.Mesh(new T.PlaneGeometry(112,63),new T.MeshBasicMaterial({map,toneMapped:false,depthWrite:false}));
 backdrop.name='craftpix-vampire-terrace';backdrop.position.set(0,63*(777.5/1080-.5),-20);backdrop.renderOrder=-10;k.dynamic.add(backdrop);k.scene.userData.stickBackdrop=backdrop;
 k.scene.userData.stickBlood=true;
 k.scene.userData.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const effects=stickEffects(k);
 const beamMeshes=new Map<number,T.Group>();

 const rigs=s.players.map((_:any,i:number)=>{
  const r=createStickFighterRig(i,k);
  r.root.position.set(W(s.players[i].x),FY(s.players[i].y),0);
  for(let frame=0;frame<18;frame++)stepRigPhysics(r,s.players[i],1/60,0);
  k.dynamic.add(r.root);
  return r;
 });

 // Contact shadows sit on the painted floor and diffuse with jump height.
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
 const ctx=shadowCanvas.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,3,32,32,31);
 gradient.addColorStop(0,'rgba(14,5,22,.8)');gradient.addColorStop(.45,'rgba(14,5,22,.5)');gradient.addColorStop(1,'rgba(14,5,22,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 const shadowMap=new T.CanvasTexture(shadowCanvas);k.textures.push(shadowMap);
 const footBounds=new T.Box3(),otherFootBounds=new T.Box3();
 const shadows=s.players.map(()=>{
  const material=new T.MeshBasicMaterial({map:shadowMap,transparent:true,opacity:.65,depthWrite:false,toneMapped:false});
  const shadow=new T.Mesh(new T.PlaneGeometry(1,1),material);shadow.position.z=-.1;k.dynamic.add(shadow);return shadow;
 });
 const guards=s.players.map((_:any,i:number)=>{
  const pal=STICK_PALETTE[i%STICK_PALETTE.length];
  const g=new T.Group();
  const ring=new T.Mesh(
   new T.RingGeometry(3.75,3.95,40,1,-Math.PI*.45,Math.PI*.9),
   new T.MeshBasicMaterial({color:pal.main,transparent:true,opacity:.82,side:T.DoubleSide,depthWrite:false})
  );
  const dome=new T.Mesh(
   new T.CircleGeometry(3.75,32,-Math.PI*.45,Math.PI*.9),
   new T.MeshBasicMaterial({color:pal.main,transparent:true,opacity:.07,side:T.DoubleSide,depthWrite:false})
  );
  g.add(ring,dome);
  k.dynamic.add(g);
  return g;
 });

 let seenImpact=0,round=s.round,freeze=0,heldState=s;

 return(input,dt,t)=>{
  if(input.round!==round){round=input.round;effects.clear();freeze=0;}
  for(const imp of input.impacts||[]){
   if(imp.id<=seenImpact)continue;
   seenImpact=imp.id;
   if(imp.age>.3)continue;
   effects.hit(imp,k.scene.userData.stickBlood!==false);
   if(['hit','heavy','ko','parry'].includes(imp.kind)){
    freeze=imp.kind==='hit'?.035:imp.kind==='ko'?.085:.055;heldState=input;
    if(!k.scene.userData.reducedMotion)k.scene.userData.stickShake=imp.kind==='hit'?.1:.2;
   }
  }
  const state=freeze>0?heldState:input,poseDt=freeze>0?0:dt;
  freeze=Math.max(0,freeze-dt);
  k.scene.userData.stickShake=Math.max(0,(k.scene.userData.stickShake||0)-dt);
  // Update Ki Energy Beams (s.beams — Image 2 Panels 14-15, 34-35, 44-45)
  beamMeshes.forEach((m,id)=>{if(!(state.beams||[]).some((b:any)=>b.id===id)){m.removeFromParent();m.traverse(n=>{if(n instanceof T.Mesh){n.geometry.dispose();(Array.isArray(n.material)?n.material:[n.material]).forEach(mat=>mat.dispose());}});beamMeshes.delete(id);}else m.visible=false;});
  for(const b of state.beams||[]){
   const pal=STICK_PALETTE[(b.owner||0)%STICK_PALETTE.length];
   let bm=beamMeshes.get(b.id);
   if(!bm){
    bm=new T.Group();
    const core=new T.Mesh(
     new T.SphereGeometry(1.15,16,12),
     new T.MeshBasicMaterial({color:'#ffffff'})
    );
    const auraSphere=new T.Mesh(
     new T.SphereGeometry(1.75,16,12),
     new T.MeshBasicMaterial({color:pal.main,transparent:true,opacity:.65,depthWrite:false})
    );
    const tail=new T.Mesh(
     new T.CylinderGeometry(.55,1.35,8.5,12),
     new T.MeshBasicMaterial({color:pal.main,transparent:true,opacity:.72,depthWrite:false})
    );
    tail.rotation.z=Math.PI/2;
    tail.position.x=-4.2;
    const tailInner=new T.Mesh(
     new T.CylinderGeometry(.25,.75,8.2,12),
     new T.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.9,depthWrite:false})
    );
    tailInner.rotation.z=Math.PI/2;
    tailInner.position.x=-4.0;
    const waveRing=new T.Mesh(
     new T.RingGeometry(1.3,2.2,24),
     new T.MeshBasicMaterial({color:'#ffffff',side:T.DoubleSide,transparent:true,opacity:.8})
    );
    waveRing.rotation.y=Math.PI/2;
    bm.add(core,auraSphere,tail,tailInner,waveRing);
    k.dynamic.add(bm);
    beamMeshes.set(b.id,bm);
   }
   bm.visible=true;
   bm.position.set(W(b.x),FY(b.y),.6);
   bm.scale.x=b.facing>=0?1:-1;
   bm.scale.y=1+Math.sin(t*35)*.15;
  }

  // Update Stick Fighters
  state.players.forEach((p:any,i:number)=>{
   const rig=rigs[i],wx=W(p.x),wy=FY(p.y);
   // Settle the final KO even after the server has finished the match.
   rig.root.position.set(wx,p.hp<=0?Math.max(0,wy-rig.koAge*rig.koAge*30):wy,0);
   stepRigPhysics(rig,p,poseDt,t);
   for(const fist of [rig.fistR,rig.fistL]){const mat=fist.material as T.MeshStandardMaterial;mat.emissiveIntensity=(p.hitFlash||0)>0?2:.8;}

   if(p.ground&&p.hp>0){
    rig.root.updateMatrixWorld(true);footBounds.setFromObject(rig.footL);otherFootBounds.setFromObject(rig.footR);
    rig.root.position.y+=wy-Math.min(footBounds.min.y,otherFootBounds.min.y);
   }
   const altitude=Math.max(0,wy),spread=1+altitude*.025;
   shadows[i].position.set(wx+altitude*.06,-.10,-.1);
   shadows[i].scale.set((p.hp<=0?8:6)*spread,.8*spread,1);
   shadows[i].material.opacity=.68/(1+altitude*.17);

   guards[i].visible=Boolean(((p.guardHit||0)>0||(p.parryPose||0)>0)&&p.hp>0);
   guards[i].position.set(wx+p.facing*.25,wy+4.35,.5);
   const guardScale=1+Math.sin(t*18)*.015+(p.guardHit||0)*.4;
   guards[i].scale.set(p.facing*guardScale,guardScale,1);

  });
  effects.update(dt,k.scene.userData.stickBlood!==false);
 };
}
