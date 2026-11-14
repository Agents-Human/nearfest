import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorld,advanceWorld,worldAction,worldBot} from '../server/arcade/world.mjs';
import {golfCourses,resetGolfHole,GOLF_BALL_RADIUS} from '../server/arcade/golf-courses.mjs';
const advance=(s,n,inputs=[])=>{for(let i=0;i<n&&!s.finished;i++)s=advanceWorld(s,inputs);return s;};
test('all six golf routes are connected, keep the tee and cup clear, and have matching boundary rails',()=>{
 assert.equal(golfCourses.length,6);assert.equal(new Set(golfCourses.map(c=>c.name)).size,6);
 for(const c of golfCourses){const found=new Set([`${c.tee.x},${c.tee.y}`]),queue=[c.tee];while(queue.length){const p=queue.shift();for(const q of c.cells)if(Math.abs(p.x-q.x)+Math.abs(p.y-q.y)===100&&!found.has(`${q.x},${q.y}`)){found.add(`${q.x},${q.y}`);queue.push(q);}}assert.equal(found.size,c.cells.length,c.name);assert(found.has(`${c.cup.x},${c.cup.y}`));for(const p of [c.tee,c.cup])assert(!c.walls.some(w=>p.x>w.x-GOLF_BALL_RADIUS&&p.x<w.x+w.w+GOLF_BALL_RADIUS&&p.y>w.y-GOLF_BALL_RADIUS&&p.y<w.y+w.h+GOLF_BALL_RADIUS));}
});
test('fast golf shots cannot tunnel through rails; low-speed putts sink and advance six holes',()=>{
 let g=newWorld('mini-golf',2);const start=golfCourses[0].tee;g.players[0].x=start.x;g.players[0].y=start.y+30;worldAction(g,0,{type:'shoot',angle:Math.PI/2,power:1});g=advance(g,10);assert(g.players[0].y>=start.y-140+GOLF_BALL_RADIUS-.01);assert(g.players[0].y<=start.y+40-GOLF_BALL_RADIUS+.01);
 g=newWorld('mini-golf',2);for(let hole=0;hole<6;hole++){for(let seat=0;seat<2;seat++){const at=g.turn,p=g.players[at];p.x=g.cup.x-8;p.y=g.cup.y;worldAction(g,at,{type:'shoot',angle:0,power:.05});g=advance(g,80);assert(g.players[at].sunk||g.hole>hole);}}assert(g.finished);assert.deepEqual(g.winners,[0,1]);assert(g.players.every(p=>p.total===6&&p.holes.length===6));
});
test('diamond bumpers reflect shots and castle passage remains playable',()=>{
 let g=newWorld('mini-golf',2);g.hole=2;resetGolfHole(g);const o=golfCourses[2].obstacles[0];Object.assign(g.players[0],{x:o.x-42,y:o.y});worldAction(g,0,{type:'shoot',angle:0,power:.7});g=advance(g,5);assert(g.players[0].vx<0);
 g=newWorld('mini-golf',2);g.hole=4;resetGolfHole(g);Object.assign(g.players[0],{x:425,y:280});worldAction(g,0,{type:'shoot',angle:0,power:.6});g=advance(g,20);assert(g.players[0].x>520,'a central shot passes through the real tunnel');
});
test('marble race auto-hops its gaps, collects once per player, and produces equal finishes for equal controls',()=>{
 let s=newWorld('marble-run',2);const before=structuredClone(s);for(let i=0;i<2400&&!s.finished;i++)s=advanceWorld(s,s.players.map((_,j)=>worldBot(s,j)));assert(s.finished);assert(s.players.every(p=>p.finish!==null&&p.lives===3&&p.coins>0));assert.deepEqual(s.winners,[0,1]);assert.equal(before.players[0].x,0);assert(s.players.every(p=>new Set(p.collected).size===p.coins));
});
test('marble falls consume a life and return to a checkpoint; exhausted lives stay eliminated',()=>{
 let s=newWorld('marble-run',2);Object.assign(s.players[0],{x:1610,height:-99,vz:-100,ground:false,checkpoint:1000});s=advance(s,1);assert.equal(s.players[0].lives,2);assert.equal(s.players[0].x,1000);assert(s.players[0].respawn>0);
 Object.assign(s.players[0],{x:1610,height:-99,vz:-100,ground:false,lives:1,respawn:0});s=advance(s,1);assert.equal(s.players[0].alive,false);assert.equal(s.players[0].lives,0);s=advance(s,20,[{attack:true},{}]);assert.equal(s.players[0].alive,false);
});
test('tanks respect walls, fire with server cooldowns, break crates and award one knockout',()=>{
 let s=newWorld('tank-arena',2);Object.assign(s.players[0],{x:260,y:170});s=advance(s,20,[{right:true,attack:true},{}]);assert(s.players[0].x<=262);assert(s.nextShot<=2);assert(s.shots.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)));
 s=newWorld('tank-arena',2);s.shots=[{id:0,owner:0,x:200,y:250,vx:0,vy:330,life:2,bounces:0}];s=advance(s,2);assert.equal(s.crates[0].hp,1);
 s=newWorld('tank-arena',2);Object.assign(s.players[1],{x:800,y:450,hp:1,invulnerable:0});s.shots=[{id:0,owner:0,x:775,y:450,vx:330,vy:0,life:2,bounces:0}];s=advance(s,2);assert.equal(s.players[0].score,1);assert.equal(s.players[1].hp,0);assert(s.players[1].respawn>0);s=advance(s,40);assert.equal(s.players[0].score,1);assert.equal(s.players[1].hp,3);assert(s.players[1].invulnerable>0);assert.throws(()=>worldAction(s,0,{type:'score',score:99}),/supported/);
});
test('fighter kicks spend more energy and reach farther than punches',()=>{
 const s=newWorld('stick-rivals',2);s.players[0].x=410;s.players[1].x=495;const punch=advance(s,7,[{attack:true},{}]),kick=advance(s,7,[{down:true},{}]);assert.equal(punch.players[1].hp,100);assert(kick.players[1].hp<100);assert(kick.players[0].energy<punch.players[0].energy);
});
test('marble bumpers reward steering or jumping, while coins provide sustained acceleration',()=>{
 let s=newWorld('marble-run',2);Object.assign(s.players[0],{x:1090,y:0,vx:205});s=advance(s,1);assert.equal(s.players[0].collisions,1);assert(s.players[0].vx<100);
 s=newWorld('marble-run',2);Object.assign(s.players[0],{x:1090,y:0,vx:205,height:35,ground:false,vz:100});s=advance(s,1);assert.equal(s.players[0].collisions,0);
 s=newWorld('marble-run',2);s.players[0].x=s.pickups[0].x-5;s.players[0].y=s.pickups[0].y;s.players[0].vx=205;s=advance(s,1);assert(s.players[0].boost>0);s=advance(s,8);assert(s.players[0].vx>220);
});


test('fighter practice leaves time to react and simple strikes can win',async()=>{
 const {worldBot}=await import('../server/arcade/world.mjs');
 let learning=newWorld('stick-rivals',2);
 for(let tick=0;tick<160;tick++)learning=advanceWorld(learning,[{},worldBot(learning,1)]);
 assert.equal(learning.round,0);assert(learning.players[0].hp>=50,'A new player gets at least eight seconds to learn the controls.');
 let playing=newWorld('stick-rivals',2);
 for(let tick=0;tick<900&&!playing.finished;tick++)playing=advanceWorld(playing,[{attack:true},worldBot(playing,1)]);
 assert(playing.finished);assert(playing.scores[0]>playing.scores[1],'Holding the basic strike must be a viable way to learn against the practice bot.');
});
