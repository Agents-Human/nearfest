/** Copy the authored Kenney assets used by the two simulations, without altering source bytes.
 * Usage: node scripts/import-simulation-assets.mjs [assets] [public/models/simulation]
 */
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Box3,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const sourceRoot=path.resolve(process.argv[2]||'assets');
const outputRoot=path.resolve(process.argv[3]||'public/models/simulation');
const urlRoot='/models/simulation/';
const packs={
 characters:'characters', commercial:'buildings/commercial',
 suburban:'buildings/suburban', survival:'survival', nature:'nature', emotes:'emotes',
};
const selections=[];
const model=(id,pack,name)=>selections.push({id,pack,file:`${name}.glb`,kind:'model'});
for(const [i,c] of [...'cfkq'].entries())model(`player-${i}`,'characters',`character-${c}`);
for(const [i,c] of [...'adejmp'].entries())model(`npc-${i}`,'characters',`character-${c}`);
for(const [id,name] of [['town-hall','building-d'],['shop','building-i'],['shop-alt','building-a'],['parasol','detail-parasol-a']])model(id,'commercial',name);
for(const [id,name] of [['house','building-type-h'],['house-alt','building-type-q']])model(id,'suburban',name);
for(const [id,name] of [['palm','tree_palm'],['palm-small','tree_palmDetailedShort'],['tree','tree_oak'],['tree-alt','tree_small'],['rock','rock_largeA'],['canoe','canoe'],['logs','log_stack'],['campfire','campfire_logs'],['flowers','flower_yellowC'],['bush','plant_bush'],['bridge','bridge_wood']])model(id,'nature',name);
for(const [id,name] of [['tent','tent'],['tent-canvas','tent-canvas'],['shelter','structure'],['shelter-roof','structure-roof'],['shelter-canvas','structure-canvas'],['workbench','workbench'],['wood','resource-wood'],['planks','resource-planks'],['stone','resource-stone'],['campfire-pit','campfire-pit'],['axe','tool-axe'],['hammer','tool-hammer'],['fish','fish'],['barrel','barrel'],['crate','box'],['bedroll','bedroll'],['bottle','bottle-large']])model(id,'survival',name);
for(const id of ['happy','angry','sad','question','heart','alert','sleep','idea'])selections.push({id:`emote-${id}`,pack:'emotes',file:`${id}.png`,kind:'image'});

const sha=b=>createHash('sha256').update(b).digest('hex');
const url=p=>urlRoot+p.split(path.sep).map(encodeURIComponent).join('/');
const copied=new Map();
async function copy(source,relative){
 const bytes=await readFile(source),dest=path.join(outputRoot,relative);
 await mkdir(path.dirname(dest),{recursive:true});await copyFile(source,dest);
 copied.set(relative,{path:relative,url:url(relative),bytes:bytes.length,sha256:sha(bytes)});
 return bytes;
}
function glbContents(buffer){
 if(buffer.toString('utf8',0,4)!=='glTF'||buffer.readUInt32LE(4)!==2)throw Error('Expected glTF 2 binary');
 let json,binary;
 for(let offset=12;offset<buffer.length;){const length=buffer.readUInt32LE(offset),type=buffer.readUInt32LE(offset+4);if(type===0x4e4f534a)json=JSON.parse(buffer.toString('utf8',offset+8,offset+8+length));if(type===0x004e4942)binary=buffer.subarray(offset+8,offset+8+length);offset+=8+length;}
 if(!json)throw Error('GLB has no JSON chunk');return {json,binary};
}
// Geometry-only loader inspection; copied production assets keep every material and texture.
if(!globalThis.ProgressEvent)globalThis.ProgressEvent=class ProgressEvent{constructor(type,info){this.type=type;Object.assign(this,info);}};
async function dimensions(json,binary,sourceDir){
 const doc=structuredClone(json);
 for(const b of doc.buffers||[]){if(!b.uri)b.uri='data:application/octet-stream;base64,'+binary.toString('base64');else if(!b.uri.startsWith('data:'))b.uri='data:application/octet-stream;base64,'+(await readFile(path.resolve(sourceDir,b.uri))).toString('base64');}
 delete doc.images;delete doc.textures;delete doc.samplers;doc.materials=[];
 for(const m of doc.meshes||[])for(const p of m.primitives||[])delete p.material;
 const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');
 gltf.scene.updateMatrixWorld(true);
 const box=new Box3().setFromObject(gltf.scene,true),size=box.getSize(new Vector3());
 if(box.isEmpty()||[...box.min.toArray(),...box.max.toArray()].some(n=>!Number.isFinite(n)))throw Error('Model has invalid bounds');
 gltf.scene.traverse(o=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m?.dispose();});
 const rounded=a=>a.map(v=>Math.round(v*1e6)/1e6);
 return {bounds:{min:rounded(box.min.toArray()),max:rounded(box.max.toArray())},dimensions:{x:+size.x.toFixed(6),y:+size.y.toFixed(6),z:+size.z.toFixed(6)}};
}
const assets={},licenses={};
for(const item of selections){
 const sourceDirectory=path.join(sourceRoot,packs[item.pack]),sourceRelative=path.join(packs[item.pack],item.file);
 const relative=path.join(item.pack,item.file),source=path.join(sourceDirectory,item.file),data=await copy(source,relative);
 const row={url:url(relative),kind:item.kind,source:'assets/'+sourceRelative.split(path.sep).join('/'),pack:item.pack,license:'CC0-1.0',sha256:sha(data),bytes:data.length,animations:[],dependencies:[]};
 if(item.kind==='model'){
  const {json,binary}=glbContents(data);
  Object.assign(row,await dimensions(json,binary,path.dirname(source)));
  row.animations=(json.animations||[]).map(a=>a.name||'');
  for(const external of [...(json.images||[]),...(json.buffers||[])]){
   if(!external.uri||external.uri.startsWith('data:'))continue;
   const depSource=path.resolve(path.dirname(source),decodeURIComponent(external.uri)),depLocal=path.relative(sourceDirectory,depSource);
   if(depLocal.startsWith('..')||path.isAbsolute(depLocal))throw Error('Dependency leaves its asset directory');
   const depRel=path.join(item.pack,depLocal);
   await copy(depSource,depRel);row.dependencies.push(url(depRel));
  }
  if(item.pack==='characters'){row.forward='+Z';row.up='+Y';row.characterAnimationMap={idle:'idle',walk:'walk',happy:'emote-yes',angry:'emote-no',work:'interact-right',gather:'pick-up',rest:'sit'};}
 }else if(data.toString('ascii',1,4)==='PNG')row.dimensions={width:data.readUInt32BE(16),height:data.readUInt32BE(20)};
 assets[item.id]=row;
 if(!licenses[item.pack]){
  const licensePath=path.join('licenses',item.pack+'.txt');await copy(path.join(sourceDirectory,'license.txt'),licensePath);licenses[item.pack]={url:url(licensePath),license:'CC0-1.0'};
 }
}
const manifest={version:1,creator:'Kenney',license:'CC0-1.0',assets,licenses,files:[...copied.values()],totalBytes:[...copied.values()].reduce((n,f)=>n+f.bytes,0)};
await writeFile(path.join(outputRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(outputRoot,'README.md'),`# Simulation assets\n\nSelected Kenney source assets are organized under assets/characters, assets/buildings, assets/survival, assets/nature and assets/emotes. Published URLs use short category names under /models/simulation/. Source GLB, PNG and license bytes are unchanged. The manifest records every selected file, original path, byte size and SHA-256, including referenced textures. All six source packs are CC0 1.0.\n\n## Loading\n\nFetch /models/simulation/manifest.json and select entries by ID from assets. Each entry has a browser-ready url; resolve GLB external textures relative to that URL. Buildings and props retain their native dimensions and pivots. For each clone, place a normalization parent at negative bounds.min.y, recenter X/Z using the bounds midpoint and apply uniform scale. The measured dimensions include all node transforms in the static rest pose.\n\nCharacters face local +Z and use +Y up. The face is mapped to the positive-Z head surface; their native standing height is 2.7 units. They are articulated object hierarchies (not skinned meshes), and scene.clone(true) preserves the nodes targeted by animation tracks. Give each animated instance its own AnimationMixer. Idle and walk can loop; emote-yes and emote-no should play once, then return to idle. Do not move the game actor's root using animation tracks; animate a child hierarchy. Clone materials before tinting.\n\nAll selected characters supply 27 clips, including static, idle, walk, sprint, sit, pick-up, emote-yes, emote-no, interact-right, interact-left and holding variants. Their characterAnimationMap is included in each character manifest entry.\n\nPlayers use human skins c, f, k and q. NPCs use a, d, e, j, m and p. The character, nature, survival, commercial and emote pack preview images were inspected. No robot or orc skins are selected. Emote PNGs use Vector / Style 1 (white bubbles with clear faces and symbols).\n\n## Selected models\n\nTown: town-hall, shop, shop-alt, house, house-alt, parasol, tree, tree-alt, flowers, bush, bridge.\n\nIsland: palm, palm-small, rock, canoe, logs, campfire, tent, tent-canvas, shelter, shelter-roof, shelter-canvas, workbench, wood, planks, stone, campfire-pit, axe, hammer, fish, barrel, crate, bedroll, bottle. Shelter/tent frames and roof/canvas are separate authored models; compose them together at the same native origin before scaling the complete structure.\n\nEmotes: emote-happy, emote-angry, emote-sad, emote-question, emote-heart, emote-alert, emote-sleep, emote-idea.\n\n## Regeneration\n\nFrom the application root, run node scripts/import-simulation-assets.mjs. Optional positional arguments select an asset source directory and output directory. The script measures every model through Three.js GLTFLoader with textures omitted only during inspection; production bytes stay original.\n\n${Object.keys(assets).length} selected assets; ${manifest.totalBytes.toLocaleString('en-US')} bytes including dependencies and licenses (excluding this README and manifest).\n`);
console.log(JSON.stringify({assets:Object.keys(assets).length,files:copied.size,totalBytes:manifest.totalBytes,output:outputRoot}));
