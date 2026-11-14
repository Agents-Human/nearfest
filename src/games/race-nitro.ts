import * as T from 'three';

/** Exhaust-bound fire: crossed flame ribbons keep their volume through turns and jumps. */
export function raceNitro(vehicle:T.Group,seed:number){
 const root=new T.Group();root.name='nitro-exhaust-fire';root.visible=false;vehicle.add(root);
 const material=new T.ShaderMaterial({
  uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),time:{value:0},seed:{value:seed*3.17}},
  transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.NormalBlending,toneMapped:false,fog:true,
  vertexShader:`
   varying vec2 flameUv;
   #include <fog_pars_vertex>
   void main(){
    flameUv=uv;
    vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
    gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
   }`,
  fragmentShader:`
   uniform float time;
   uniform float seed;
   varying vec2 flameUv;
   #include <fog_pars_fragment>
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
   void main(){
    float t=1.0-flameUv.x;
    float clock=time*11.0+seed;
    float flow=noise(vec2(t*8.0-clock,flameUv.y*5.0+seed));
    float flutter=sin(t*16.0-clock*1.8)*.045*t+sin(t*29.0-clock*2.3)*.025*t;
    float radius=(.16+.19*sin(t*3.14159))*pow(1.0-t,.6);
    radius*=.78+flow*.52;
    float edge=abs(flameUv.y-.5-flutter)/max(.001,radius);
    float body=1.0-smoothstep(.56,1.08,edge);
    float tongues=1.0-smoothstep(.7+flow*.25,1.0,t);
    float alpha=body*tongues*smoothstep(0.0,.035,t);
    if(alpha<.015)discard;
    float heat=clamp((1.0-edge)*.8+(1.0-t)*.42-flow*.1,0.0,1.0);
    vec3 color=mix(vec3(1.0,.055,.004),vec3(1.0,.17,.008),smoothstep(.15,.64,heat));
    color=mix(color,vec3(1.0,.94,.6),smoothstep(.78,.99,heat));
    gl_FragColor=vec4(color,alpha*.9);
    #include <colorspace_fragment>
    #include <fog_fragment>
   }`,
 });
 const geometry=new T.PlaneGeometry(3.8,1.3);geometry.translate(-1.9,0,0);
 const jets=[-.67,.67].map((z,index)=>{
  const jet=new T.Group();jet.position.set(-2.25,.48,z);root.add(jet);
  for(const angle of [0,Math.PI/2]){const flame=new T.Mesh(geometry,material);flame.rotation.x=angle;flame.renderOrder=2;jet.add(flame);}
  jet.userData.phase=index*1.8+seed;return jet;
 });
 return (boosting:boolean,time:number,speed:number)=>{
  root.visible=boosting;
  if(!boosting)return;
  material.uniforms.time.value=time;
  for(const jet of jets){const pulse=Math.sin(time*38+jet.userData.phase)*.09+Math.sin(time*61+seed)*.045;jet.scale.set(.7+Math.min(1,speed/800)*.25+pulse,1+pulse*.4,1+pulse*.4);}
 };
}
