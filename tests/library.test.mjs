import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import library from '../server/library-catalog.json' with {type:'json'};
import {discoveryGames} from '../server/game-catalog.mjs';
import {libraryHeaders,serveLibrary} from '../server/library.mjs';
import {openStore} from '../server/store.mjs';
import {createCommunity} from '../server/community.mjs';
import {createMultiplayer} from '../server/multiplayer.mjs';
import {createPlay} from '../server/play.mjs';

test('featured collection follows the selected order without duplicates',()=>{
 assert.deepEqual(discoveryGames.slice(0,5).map(g=>g.id),['platform-relay','pocket-racers','stick-rivals','tappy-plane','bridge-builders']);
 assert.equal(new Set(discoveryGames.map(g=>g.id)).size,discoveryGames.length);
});

test('1000+ separately sourced titles have unique identities, real entry files, covers and licence notices',()=>{
 assert(library.length>=1000);assert.equal(discoveryGames.length,58);assert(discoveryGames.every(g=>g.multiplayer&&g.solo&&!g.pack&&g.engine!=='imported'));assert(!discoveryGames.some(g=>g.id==='kalah'||g.id==='ludo'));assert.equal(discoveryGames.find(g=>g.id==='oware').title,'Mancala');
 assert.equal(new Set(library.map(g=>g.id)).size,library.length);
 const normalized=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 assert.equal(new Set(library.map(g=>normalized(g.title))).size,library.length);
 for(const g of library){
  assert(g.standalone&&!g.multiplayer,g.id);assert.equal(g.engine,'imported');assert(g.source.startsWith('https://github.com/'));
  for(const path of [g.launch.split('?')[0],g.thumbnail,g.license_url]){assert(path.startsWith('/library/'));assert(existsSync(resolve('public',path.slice(1))),`${g.id}: ${path}`);}
  const bytes=readFileSync(resolve('public',g.launch.split('?')[0].slice(1)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),g.entry_sha256,g.id);
  assert(bytes.toString().includes('/library/runtime.js'),g.id);
  assert(readFileSync(resolve('public',g.license_url.slice(1))).length>150,g.id);
 }
});

test('game CSP permits only local game assets and isolates the document from account storage and network',()=>{
 const h=libraryHeaders('https://slotvend.example',true),csp=h['content-security-policy'];
 assert(csp.includes('sandbox allow-scripts allow-pointer-lock;'));assert(!csp.includes('allow-same-origin'));
 assert(csp.includes('connect-src https://slotvend.example/library/;'));assert(csp.includes("form-action 'none'"));assert(csp.includes("frame-src 'none'"));
 assert.equal(h['access-control-allow-origin'],'*');assert.equal(h['cache-control'],'no-store');
});

test('local preview assets use the requested loopback alias without broadening the game sandbox',async()=>{
 let headers;
 await serveLibrary({method:'HEAD',headers:{host:'localhost:5188'},socket:{}},{writeHead:(status,h)=>{assert.equal(status,200);headers=h;},end:()=>{}},'/library/hundred/game-20-boomerang/index.html','http://127.0.0.1:5188');
 assert(headers['content-security-policy'].includes('http://localhost:5188/library/'));
 assert(!headers['content-security-policy'].includes('allow-same-origin'));
 const proxied=libraryHeaders('http://127.0.0.1:5188',true)['content-security-policy'];
 assert(proxied.includes('http://localhost:5188/library/'));
 assert(!proxied.includes('http://localhost:5189/'));
});

test('parked imports cannot create games or local money pots',async()=>{const s=openStore(':memory:');try{const a=s.ensureUser('a','Alice','practice'),p=createPlay(s),m=createMultiplayer(s),c=createCommunity(s);await assert.rejects(()=>p.start(library[0].id,a),/timed challenge/);assert.throws(()=>m.create({game_id:library[0].id,entry:'0'},a));assert.throws(()=>c.create({kind:'pot',game_id:library[0].id},a),/NEAR/);assert.equal(s.user(a.id).balance,'0');}finally{s.db.close();}});
