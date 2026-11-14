import * as T from 'three';

/** An atmospheric front rather than solid obstacles. Cloud and rain motion is
 * evaluated on the GPU; the server still owns the advancing danger boundary. */
export function createPlatformStorm(){
 const root=new T.Group();root.name='platform-storm';
 const random=(n:number)=>{const v=Math.sin(n*127.1+31.7)*43758.5453;return v-Math.floor(v);};
 const noiseData=new Uint8Array(64*64*4);
 for(let i=0;i<64*64;i++){const value=Math.round(random(i)*255);noiseData.set([value,value,value,255],i*4);}
 const noiseMap=new T.DataTexture(noiseData,64,64);noiseMap.wrapS=noiseMap.wrapT=T.RepeatWrapping;noiseMap.minFilter=noiseMap.magFilter=T.LinearFilter;noiseMap.needsUpdate=true;
 const uniforms={time:{value:0},noiseMap:{value:noiseMap}};
 const cloudMaterial=new T.ShaderMaterial({
  uniforms,transparent:true,depthWrite:false,side:T.DoubleSide,
  vertexShader:`varying vec2 vUv;
   void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`
   uniform float time;uniform sampler2D noiseMap;varying vec2 vUv;
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return texture2D(noiseMap,(i+f+.5)/64.).r;}
   float cloud(vec2 p){return noise(p)*.57+noise(p*2.07+8.3)*.28+noise(p*4.13)*.15;}
   void main(){
    vec2 p=vUv*vec2(5.,4.);
    float billow=cloud(p+vec2(-time*.025,time*.006));
    float edge=.92+.022*sin(vUv.y*9.+time*.12)+.025*(billow-.5);
    float front=1.-smoothstep(edge-.09,edge,vUv.x);
    float cloudBase=.42+.07*cloud(vec2(vUv.x*8.-time*.035,1.));
    float canopy=smoothstep(cloudBase,cloudBase+.13,vUv.y);
    float mist=.24+.2*cloud(p*1.4-vec2(time*.04,time*.01));
    float density=mix(mist,.76+billow*.24,canopy);
    float alpha=front*density*smoothstep(0.,.1,vUv.y)*(1.-smoothstep(.94,1.,vUv.y));
    vec3 low=vec3(.20,.29,.36),high=vec3(.055,.075,.115);
    vec3 color=mix(low,high,canopy*.88);
    color+=vec3(.045,.055,.065)*billow;
    // A slow, dim glow within the clouds, without lightning strobes.
    color+=vec3(.11,.13,.16)*pow(max(0.,sin(time*.42)),16.)*canopy;
    gl_FragColor=vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
 });
 const clouds=new T.Mesh(new T.PlaneGeometry(120,80),cloudMaterial);
 clouds.name='rolling-storm-clouds';clouds.position.set(-50,8,-14);root.add(clouds);

 // Soft, shaded cloud lobes give the front an overhanging thunderhead. One
 // shared texture and a handful of planes replace the old stack of solid balls.
 const cloudPixels=new Uint8Array(256*128*4);
 const lobes=[[.3,.4,.27],[.5,.56,.34],[.8,.65,.4],[1.1,.62,.38],[1.4,.55,.35],[1.68,.38,.27],[1.4,.3,.3],[1.05,.26,.35],[.7,.26,.33],[.42,.26,.28]];
 for(let y=0;y<128;y++)for(let x=0;x<256;x++){
  const u=x/128,v=y/128;let alpha=0,light=0,weight=0;
  for(const [cx,cy,r] of lobes){
   const d=Math.hypot(u-cx,v-cy)/r,coverage=T.MathUtils.smoothstep(1.08-d,0,.2);
   const shadeWeight=coverage*Math.max(0,1-d);
   alpha=1-(1-alpha)*(1-coverage);
   light+=shadeWeight*T.MathUtils.clamp(.48+(v-cy)/r*.35-(u-cx)/r*.12,0,1);weight+=shadeWeight;
  }
  light/=Math.max(.001,weight);
  alpha*=T.MathUtils.smoothstep(v,0,.09)*T.MathUtils.smoothstep(1-v,0,.07)*T.MathUtils.smoothstep(u,0,.08)*T.MathUtils.smoothstep(2-u,0,.08);
  const offset=(y*256+x)*4;cloudPixels.set([32+light*62,43+light*66,59+light*70,alpha*248],offset);
 }
 const cloudTexture=new T.DataTexture(cloudPixels,256,128);cloudTexture.colorSpace=T.SRGBColorSpace;cloudTexture.minFilter=cloudTexture.magFilter=T.LinearFilter;cloudTexture.needsUpdate=true;
 const banks=[[-49,21,38],[-29,24,35],[-12,22,30],[-4,18,25]].map(([x,y,width],i)=>{
  const material=new T.MeshBasicMaterial({map:cloudTexture,transparent:true,depthWrite:false,toneMapped:false,opacity:.91});
  const bank=new T.Mesh(new T.PlaneGeometry(width,width*.5),material);bank.name='thunderhead';bank.position.set(x,y,-10+i*.3);bank.renderOrder=i;
  root.add(bank);return {bank,y};
 });

 // Independent rain streaks wrap smoothly through the front. They don't create
 // meshes, textures or garbage as the course runs for longer.
 const count=560,positions=new Float32Array(count*6),tails=new Float32Array(count*2);
 for(let i=0;i<count;i++){
  const x=-88+random(i+1)*76,y=random(i+7)*55,z=random(i+13)*8;
  positions.set([x,y,z,x,y,z],i*6);tails[i*2+1]=1;
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('tail',new T.BufferAttribute(tails,1));
 const rainMaterial=new T.ShaderMaterial({
  uniforms,transparent:true,depthWrite:false,
  vertexShader:`uniform float time;attribute float tail;varying float fade;
   void main(){
    float travel=mod(time*(30.+position.z*1.6)+position.y,55.);
    vec3 p=vec3(position.x+travel*.26+tail*.3,46.-travel-tail*1.2,position.z);
    fade=(1.-smoothstep(-4.,3.,p.x))*smoothstep(-88.,-65.,p.x)*smoothstep(-8.,-3.,p.y);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
   }`,
  fragmentShader:`varying float fade;
   void main(){gl_FragColor=vec4(.72,.82,.91,fade*.65);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
 });
 const rain=new T.LineSegments(geometry,rainMaterial);rain.name='wind-driven-rain';rain.frustumCulled=false;root.add(rain);
 return {root,dispose(){noiseMap.dispose();cloudTexture.dispose();},update(time:number,stormX:number,viewerX:number){
  uniforms.time.value=time;root.position.x=stormX/10;root.visible=stormX>viewerX-900;
  for(let i=0;i<banks.length;i++){const {bank,y}=banks[i];bank.position.y=y+Math.sin(time*.35+i)*.35;bank.scale.x=1+Math.sin(time*.22+i)*.025;}
 }};
}
