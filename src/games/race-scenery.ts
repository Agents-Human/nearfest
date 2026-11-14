import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

type Spec={url:string;height?:number;width?:number;tint?:string;building?:boolean};
const nature='/models/racing/scenery/',architecture='/models/racing/architecture/';
const specs:Record<string,Spec>={
 palm:{url:nature+'tree_palmDetailedShort.glb',height:9},palmTall:{url:nature+'tree_palmTall.glb',height:13},
 pine:{url:nature+'tree_pineTallA.glb',height:12},pineTall:{url:nature+'tree_pineTallC_detailed.glb',height:16},oak:{url:nature+'tree_oak.glb',height:10},bush:{url:nature+'plant_bushLarge.glb',height:2.5},
 rock:{url:nature+'rock_largeA.glb',height:5.5,tint:'#df9972'},spire:{url:nature+'rock_tallA.glb',height:25,tint:'#e2a077'},cactus:{url:nature+'cactus_tall.glb',height:6},cactusSmall:{url:nature+'cactus_short.glb',height:3},
 mountain:{url:nature+'rock_largeA.glb',height:48,tint:'#87aea7'},mesa:{url:nature+'rock_tallA.glb',height:58,tint:'#cc9b80'},
 snowTree:{url:'/models/platform/tree-snow.glb',height:11},
 houseA:{url:'/models/scenery/city/house-a.glb',width:13,building:true},houseB:{url:'/models/scenery/city/house-b.glb',width:14,building:true},houseH:{url:'/models/scenery/city/house-h.glb',width:13,building:true},
 towerA:{url:'/models/scenery/commercial/building-skyscraper-a.glb',height:38,building:true},towerB:{url:'/models/scenery/commercial/building-skyscraper-b.glb',height:48,building:true},towerC:{url:'/models/scenery/commercial/building-skyscraper-c.glb',height:36,building:true},
 shopA:{url:'/models/scenery/commercial/building-a.glb',width:16,building:true},shopC:{url:'/models/scenery/commercial/building-c.glb',width:18,building:true},shopF:{url:'/models/scenery/commercial/building-f.glb',width:15,building:true},
 houseC:{url:architecture+'suburban/building-type-c.glb',width:14,building:true},
 houseE:{url:architecture+'suburban/building-type-e.glb',width:14,building:true},
 houseJ:{url:architecture+'suburban/building-type-j.glb',width:14,building:true},
 houseL:{url:architecture+'suburban/building-type-l.glb',width:14,building:true},
 houseN:{url:architecture+'suburban/building-type-n.glb',width:14,building:true},
 houseT:{url:architecture+'suburban/building-type-t.glb',width:14,building:true},
 houseD:{url:'/models/scenery/city/house-d.glb',width:14,building:true},
 houseQ:{url:'/models/scenery/city/house-q.glb',width:14,building:true},
 shopB:{url:architecture+'commercial/building-b.glb',width:17,building:true},
 shopD:{url:architecture+'commercial/building-d.glb',width:15,building:true},
 shopE:{url:architecture+'commercial/building-e.glb',width:16,building:true},
 shopG:{url:architecture+'commercial/building-g.glb',width:18,building:true},
 shopH:{url:architecture+'commercial/building-h.glb',width:15,building:true},
 shopI:{url:architecture+'commercial/building-i.glb',width:16,building:true},
 shopK:{url:architecture+'commercial/building-k.glb',width:18,building:true},
 shopM:{url:architecture+'commercial/building-m.glb',width:16,building:true},
 shopN:{url:architecture+'commercial/building-n.glb',width:17,building:true},
 towerD:{url:architecture+'commercial/building-skyscraper-d.glb',height:48,building:true},
 towerE:{url:architecture+'commercial/building-skyscraper-e.glb',height:60,building:true},
 parasol:{url:'/models/scenery/commercial/detail-parasol-a.glb',height:4},lamp:{url:'/models/scenery/roads/light-curved-double.glb',height:10},
};
// Applied only to facade/roof vertices: glass, doors, vegetation and details retain their atlas colours.
const palettes=[['#fff0d4','#c3684a'],['#d0e7e8','#426a8e'],['#f5d9bb','#73526b'],['#dbe8c4','#456954'],['#e2d8ed','#525b79']];
function colourVariant(source:T.Group,index:number,height:number):T.Group{
 const root=new T.Group();root.userData={...source.userData};
 source.children.forEach(o=>{
  const original=o as T.Mesh,material=(original.material as T.MeshStandardMaterial).clone(),geometry=original.geometry.clone(),map=material.map;
  if(map?.image){
   const bitmap=map.image as HTMLImageElement;const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
   const ctx=canvas.getContext('2d')!;ctx.drawImage(bitmap,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   const pos=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),norm=geometry.getAttribute('normal'),colors=new Float32Array(pos.count*3);
   const facade=new T.Color(palettes[index][0]),roof=new T.Color(palettes[index][1]),base=new T.Color();
   for(let i=0;i<pos.count;i++){
    const x=Math.min(canvas.width-1,Math.max(0,Math.floor(uv.getX(i)*canvas.width))),v=map.flipY?1-uv.getY(i):uv.getY(i),y=Math.min(canvas.height-1,Math.max(0,Math.floor(v*canvas.height))),at=(y*canvas.width+x)*4;
    const r=pixels[at],g=pixels[at+1],b=pixels[at+2],high=pos.getY(i)>height*.35;
    const isRoof=high&&((g>r*1.13&&g>b*1.08)||(pos.getY(i)>height*.72&&norm.getY(i)>.7&&r<135&&g<150&&b<175));
    const isWall=!isRoof&&r>190&&g>190&&b>190&&Math.max(r,g,b)-Math.min(r,g,b)<24;
    const tint=isRoof?roof:isWall?facade:null;
    if(tint){base.setRGB(r/255,g/255,b/255,T.SRGBColorSpace);const shade=.82+.18*(r+g+b)/765;colors.set([tint.r*shade/Math.max(.01,base.r),tint.g*shade/Math.max(.01,base.g),tint.b*shade/Math.max(.01,base.b)],i*3);}else colors.set([1,1,1],i*3);
   }
   geometry.setAttribute('color',new T.BufferAttribute(colors,3));material.vertexColors=true;
  }
  const mesh=new T.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
 });return root;
}
export type RaceSceneryAssets={templates:()=>Record<string,T.Group>};
let cached:Promise<RaceSceneryAssets>|undefined;
/** Download once; each race owns a batched copy and five architecture colourways. */
export function loadRaceScenery():Promise<RaceSceneryAssets>{
 if(cached)return cached;
 const loader=new GLTFLoader();
 cached=Promise.all(Object.entries(specs).map(async([id,spec])=>[id,(await loader.loadAsync(spec.url)).scene] as const)).then(entries=>({templates(){
  return Object.fromEntries(entries.flatMap(([id,source])=>{
   source.updateMatrixWorld(true);const spec=specs[id],bounds=new T.Box3().setFromObject(source),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
   const scale=spec.height?spec.height/size.y:spec.width!/size.x;
   const transform=new T.Matrix4().makeTranslation(-center.x*scale,-bounds.min.y*scale,-center.z*scale).multiply(new T.Matrix4().makeScale(scale,scale,scale));
   const buckets=new Map<T.Material,T.BufferGeometry[]>(),textures=new Map<T.Texture,T.Texture>();
   source.traverse(o=>{if(!(o instanceof T.Mesh))return;const materials=Array.isArray(o.material)?o.material:[o.material];
    for(let part=0;part<materials.length;part++){
     let geometry=o.geometry.clone();if(geometry.index){const g=geometry.toNonIndexed();geometry.dispose();geometry=g;}
     if(materials.length>1){const group=o.geometry.groups.find((g:{materialIndex?:number})=>g.materialIndex===part);if(!group){geometry.dispose();continue;}for(const [key,attribute] of Object.entries(geometry.attributes)){const attr=attribute as T.BufferAttribute;geometry.setAttribute(key,new T.BufferAttribute(attr.array.slice(group.start*attr.itemSize,(group.start+group.count)*attr.itemSize),attr.itemSize));}geometry.clearGroups();}
     geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(transform,o.matrixWorld));const material=materials[part];if(!buckets.has(material))buckets.set(material,[]);buckets.get(material)!.push(geometry);
    }
   });
   const root=new T.Group();root.name='race-scenery-'+id;root.userData.width=Math.max(size.x,size.z)*scale;root.userData.height=size.y*scale;
   for(const [original,parts] of buckets){const material=original.clone();for(const [key,value] of Object.entries(original))if(value instanceof T.Texture){if(!textures.has(value)){const copy=value.clone();copy.anisotropy=4;textures.set(value,copy);}(material as unknown as Record<string,unknown>)[key]=textures.get(value);}
    if(material instanceof T.MeshStandardMaterial){material.roughness=.85;if(spec.tint)material.color.set(spec.tint);}
    const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(geometry){const mesh=new T.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
   }
   const result:[string,T.Group][]=[[id,root]];
   if(spec.building)palettes.forEach((_,index)=>result.push([id+'-v'+index,colourVariant(root,index,size.y*scale)]));
   return result;
  }));
 }})).catch(error=>{cached=undefined;throw error;});
 return cached;
}
