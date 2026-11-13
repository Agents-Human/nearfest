import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export default function ArcadeScene() {
  const host = useRef<HTMLDivElement>(null);
  const [supported,setSupported]=useState(true);
  useEffect(() => {
    const element=host.current; if(!element)return;
    let renderer:THREE.WebGLRenderer;
    try{ renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'}); }catch{setSupported(false);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
    element.appendChild(renderer.domElement);
    const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(32,1,.1,50);
    camera.position.set(0,0,6.7);
    const pmrem=new THREE.PMREMGenerator(renderer), environment=new RoomEnvironment();
    const env=pmrem.fromScene(environment,.04);scene.environment=env.texture;environment.dispose();pmrem.dispose();
    scene.add(new THREE.AmbientLight(0xffffff,2));
    const light=new THREE.PointLight(0xff9d46,35);light.position.set(-3,3,3);scene.add(light);
    const cyan=new THREE.PointLight(0x65eaff,25);cyan.position.set(3,-1,2);scene.add(cyan);
    const group=new THREE.Group();scene.add(group);
    const gold=new THREE.MeshPhysicalMaterial({color:0xffb630,metalness:.86,roughness:.22,clearcoat:1});
    const blue=new THREE.MeshPhysicalMaterial({color:0x7774ff,metalness:.7,roughness:.2,clearcoat:1});
    const rimMaterial=new THREE.MeshStandardMaterial({color:0xd8ff74,metalness:.7,roughness:.25,emissive:0x344908,emissiveIntensity:.4});
    const coinGeometry=new THREE.CylinderGeometry(.85,.85,.14,64);
    const coin=new THREE.Mesh(coinGeometry,gold);coin.rotation.x=Math.PI/2;group.add(coin);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#ffbd42';ctx.fillRect(0,0,256,256);ctx.strokeStyle='#7e4428';ctx.lineWidth=6;ctx.beginPath();ctx.arc(128,128,111,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#57244c';ctx.font='bold italic 90px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('SV',123,134);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const faceMaterial=new THREE.MeshStandardMaterial({map:texture,metalness:.45,roughness:.3});
    const faceGeometry=new THREE.CircleGeometry(.79,64), face=new THREE.Mesh(faceGeometry,faceMaterial);face.position.z=.076;group.add(face);
    const ringGeometry=new THREE.TorusGeometry(1.17,.04,12,80), ring=new THREE.Mesh(ringGeometry,rimMaterial);ring.rotation.x=.65;ring.rotation.y=.45;group.add(ring);
    const second=new THREE.Mesh(coinGeometry,blue);second.scale.setScalar(.65);second.rotation.set(1.1,.2,.5);second.position.set(1.05,.25,-.6);scene.add(second);
    const starGeometry=new THREE.OctahedronGeometry(.21),starMaterial=new THREE.MeshStandardMaterial({color:0xff654e,metalness:.5,roughness:.25});
    const star=new THREE.Mesh(starGeometry,starMaterial);star.position.set(-1.4,.6,.1);scene.add(star);
    let targetX=0,targetY=0,frame=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const pointer=(event:PointerEvent)=>{const rect=element.getBoundingClientRect();targetY=(event.clientX-rect.left-rect.width/2)/rect.width*.3;targetX=(event.clientY-rect.top-rect.height/2)/rect.height*.2;};
    const size=()=>{const {width,height}=element.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();renderer.render(scene,camera);};
    const observer=new ResizeObserver(size);observer.observe(element);element.addEventListener('pointermove',pointer);size();
    let last=0;const draw=(time:number)=>{frame=requestAnimationFrame(draw);if(document.hidden||time-last<33)return;last=time;if(!reduced.matches){const t=time*.001;group.rotation.y+=(Math.sin(t*.5)*.18+targetY-group.rotation.y)*.05;group.rotation.x+=(Math.sin(t*.7)*.1-targetX-group.rotation.x)*.05;group.position.y=Math.sin(t*1.1)*.08;ring.rotation.z=t*.14;second.rotation.z=t*.13;second.position.y=.25+Math.cos(t)*.1;star.rotation.y=t*.45;star.rotation.z=t*.3;}renderer.render(scene,camera);};frame=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();element.removeEventListener('pointermove',pointer);for(const item of [coinGeometry,ringGeometry,faceGeometry,starGeometry,gold,blue,rimMaterial,faceMaterial,starMaterial,texture,env])item.dispose();renderer.dispose();renderer.domElement.remove();};
  },[]);
  return <div ref={host} className="three-arcade" aria-hidden="true">{!supported&&<span className="scene-fallback">SV</span>}</div>;
}
