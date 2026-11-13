import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {games} from '../server/game-catalog.mjs';
// Preserve artwork for parked titles as well as the published multiplayer catalogue.
const discoveryGames=games.filter(game=>!game.pack);
import {featuredScene} from './card-art/featured.mjs';
import {sceneFor} from './card-art/scenes.mjs';
const palettes=[
 ['#d8c9f1','#f7e663','#f18e79'],['#f8d891','#ef866a','#bad8be'],
 ['#bedbd3','#f6bd79','#a18ac8'],['#efbfc9','#b8c9f3','#ed825e'],
 ['#c5dcf1','#f7e663','#e79eae'],['#f4c8a3','#bdacd9','#df7257'],
];
const overrides={'chogan-sudoku':0,'aba-sum-ten':1,'chogan-dots':4,'chogan-mancala':2,'hundred-game-20-boomerang':0,'littlejs-astroblast':4,'aba-draft-line':3,'2048':1,memory:3};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
await mkdir(new URL('../public/art/game-covers/',import.meta.url),{recursive:true});
let original=0,framed=0;
for(const game of discoveryGames){
 const seed=[...game.id].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
 const [bg,primary,secondary]=palettes[overrides[game.id]??seed%palettes.length];
 const p={bg,primary,secondary,light:'#fff9e9',ink:'#242820'};
 let content=featuredScene(game,p,seed)||sceneFor(game,p,seed);
 if(!content){
  // Preserve actual game imagery where a title has no editorial illustration.
  const source=await readFile(new URL(`../public${game.thumbnail}`,import.meta.url));
  const mime=game.thumbnail.endsWith('.svg')?'image/svg+xml':game.thumbnail.endsWith('.png')?'image/png':'image/jpeg';
  content=`<g transform="rotate(-5 320 220)"><rect x="89" y="70" width="474" height="319" rx="25" fill="#242820"/><rect x="80" y="60" width="474" height="319" rx="25" fill="#fff9e9" stroke="#242820" stroke-width="3"/><rect x="101" y="81" width="432" height="276" rx="10" fill="${primary}"/><clipPath id="screen"><rect x="101" y="81" width="432" height="276" rx="10"/></clipPath><image x="101" y="81" width="432" height="276" preserveAspectRatio="xMidYMid meet" clip-path="url(#screen)" href="data:${mime};base64,${source.toString('base64')}"/></g>`;
  framed++;
 }else original++;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440"><title>${esc(game.title)} — slotVend cover</title><rect width="640" height="440" fill="${bg}"/><circle cx="550" cy="20" r="230" fill="#fff9e9" opacity=".13"/><path d="M0 373Q190 330 341 397T640 372V440H0Z" fill="#fff9e9" opacity=".13"/>${content}</svg>`;
 await writeFile(new URL(`../public/art/game-covers/${game.id}.svg`,import.meta.url),svg);
}
console.log(`Built ${original} illustrated covers and ${framed} covers featuring original game artwork (${discoveryGames.length} total).`);
