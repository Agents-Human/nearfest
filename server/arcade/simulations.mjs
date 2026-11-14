// Shared, server-owned decision simulations. All commands refer to authored IDs;
// clients cannot supply positions, rewards, NPC trust, day clocks or results.
export const simulationIds = new Set(['town-council', 'castaway-crew']);
const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));
const town = s => s.game === 'town-council';
const locations = {
 'town-council': [
  ['council', 'Council green', 50, 37], ['market', 'Market street', 24, 24],
  ['square', 'Festival square', 51, 17], ['park', 'Riverside park', 78, 26],
  ['workshop', 'Repair yard', 24, 52], ['homes', 'The neighbourhood', 76, 53],
 ],
 'castaway-crew': [
  ['camp', 'Survivor camp', 50, 38], ['grove', 'Palm grove', 25, 24],
  ['wreck', 'Washed-up cargo', 77, 23], ['radio', 'Signal ridge', 53, 15],
  ['shelter', 'Storm shelter', 36, 50], ['shore', 'Fishing cove', 76, 53],
 ],
};
const residents = {
 'town-council': [
  ['Ama', 'Market trader', 'Practical', 'market', 'funds', 'A busy market keeps our town going.'],
  ['Kojo', 'Musician', 'Outgoing', 'square', 'festival', 'Give us a stage and we will bring people together.'],
  ['Efua', 'Gardener', 'Patient', 'park', 'safety', 'A celebration needs a town worth coming home to.'],
  ['Kofi', 'Builder', 'Straightforward', 'workshop', 'safety', 'Show me a plan, then help me get it done.'],
  ['Abena', 'Neighbourhood organiser', 'Protective', 'homes', 'safety', 'Please remember the people who live here.'],
  ['Yaw', 'Volunteer coordinator', 'Optimistic', 'council', 'festival', 'People will help when they know you listen.'],
 ],
 'castaway-crew': [
  ['Maya', 'Engineer', 'Methodical', 'radio', 'radio', 'A working radio is our way home.'],
  ['Theo', 'Builder', 'Cautious', 'shelter', 'shelter', 'We need somewhere safe before that storm hits.'],
  ['Nia', 'Medic', 'Compassionate', 'camp', 'food', 'Hungry people cannot look after each other.'],
  ['Sam', 'Scout', 'Adventurous', 'grove', 'wood', 'There are supplies out there if we work together.'],
  ['Iris', 'Cook', 'Resourceful', 'shore', 'food', 'Share what you find. Nobody gets left out.'],
  ['Leo', 'Navigator', 'Independent', 'wreck', 'parts', 'I can find useful cargo. I need you to trust me.'],
 ],
};
const taskSets = {
 'town-council': [
  {id:'trade', label:'Help at the market', location:'market', seconds:5, cost:{}, reward:{funds:5}, metric:{}, detail:'Earn 5 funds for the town.', npc:0},
  {id:'festival', label:'Prepare the festival', location:'square', seconds:7, cost:{funds:3}, reward:{}, metric:{festival:14}, detail:'Spend 3 funds. Festival +14.', npc:1},
  {id:'repair', label:'Repair the neighbourhood', location:'workshop', seconds:7, cost:{funds:3}, reward:{}, metric:{safety:14}, detail:'Spend 3 funds. Town care +14.', npc:3},
  {id:'garden', label:'Restore the park', location:'park', seconds:6, cost:{funds:1}, reward:{}, metric:{safety:7}, detail:'Spend 1 fund. Town care +7; everyone feels better.', npc:2},
 ],
 'castaway-crew': [
  {id:'wood', label:'Gather driftwood', location:'grove', seconds:6, cost:{}, reward:{wood:5}, metric:{}, detail:'Gather 5 wood.', npc:3},
  {id:'food', label:'Fish and forage', location:'shore', seconds:7, cost:{}, reward:{food:7}, metric:{}, detail:'Gather 7 food. Everyone eats at dusk.', npc:4},
  {id:'salvage', label:'Salvage spare parts', location:'wreck', seconds:7, cost:{}, reward:{parts:2}, metric:{}, detail:'Find 2 radio parts.', npc:5},
  {id:'radio', label:'Repair the rescue radio', location:'radio', seconds:8, cost:{wood:2,parts:1}, reward:{}, metric:{radio:16}, detail:'Spend 2 wood + 1 part. Radio +16.', npc:0},
  {id:'shelter', label:'Reinforce the shelter', location:'shelter', seconds:8, cost:{wood:3}, reward:{}, metric:{shelter:18}, detail:'Spend 3 wood. Shelter +18.', npc:1},
 ],
};
const option = (label, detail, resources = {}, metrics = {}, moods = {}) => ({label,detail,resources,metrics,moods});
const events = {
 'town-council': [
  {title:'A stage or safer streets?', text:'The festival committee and repair crew both need the first grant.', options:[option('Fund the stage','3 funds → festival +15. Kojo is delighted.',{funds:-3},{festival:15},{1:10,3:-4}),option('Repair the streets','3 funds → town care +15. Kofi feels heard.',{funds:-3},{safety:15},{3:10,1:-4}),option('Share the grant','2 funds → +6 to both projects.',{funds:-2},{festival:6,safety:6},{0:3,5:3})]},
  {title:'Music in the market', text:'Kojo wants a concert. Abena says neighbours need a quiet evening.', options:[option('Let the concert run','Earn 4 funds; festival +8. Neighbours lose sleep.',{funds:4},{festival:8,safety:-5},{0:7,1:12,4:-14}),option('Keep the market quiet','Town care +6. Kojo feels overlooked.',{},{safety:6},{4:12,1:-10}),option('Move it to the park','Spend 2 funds for a smaller, earlier show.',{funds:-2},{festival:6},{1:5,2:-3,4:5})]},
  {title:'The blocked footbridge', text:'Deliveries are late. Volunteers offer to help, but somebody must pay for materials.', options:[option('Buy repair materials','4 funds → town care +18.',{funds:-4},{safety:18},{0:8,3:10}),option('Divert the deliveries','Earn 2 funds, but damage the park.',{funds:2},{safety:-8},{0:6,2:-12}),option('Organise a volunteer day','Festival +4 and care +5; a modest fix.',{},{festival:4,safety:5},{3:3,5:8})]},
  {title:'A sponsor with conditions', text:'A sponsor will help, but wants local stalls moved away from the main square.', options:[option('Accept the sponsor','Earn 7 funds; local traders feel pushed out.',{funds:7},{festival:5},{0:-15,1:6}),option('Keep it local','Spend 2 funds; residents rally around the event.',{funds:-2},{festival:8},{0:12,5:10}),option('Offer a shared space','Earn 2 funds and keep some local stalls.',{funds:2},{festival:3},{0:2,1:2})]},
  {title:'Rain on the forecast', text:'The weather is changing. We can protect the stage, the streets, or a little of each.', options:[option('Cover the stage','3 funds → festival +14, care -4.',{funds:-3},{festival:14,safety:-4},{1:8,4:-5}),option('Clear the drains','3 funds → town care +16.',{funds:-3},{safety:16},{2:6,3:8}),option('Prepare both crews','2 funds → festival +5 and care +6.',{funds:-2},{festival:5,safety:6},{5:5})]},
  {title:'Who gets the spotlight?', text:'The final programme has room for one more feature.', options:[option('The headline performer','Festival +12. Volunteers feel forgotten.',{},{festival:12},{1:12,5:-10}),option('Community performances','Festival +8. Neighbours and volunteers join in.',{},{festival:8},{4:8,5:10}),option('The traders’ showcase','Earn 4 funds and festival +4.',{funds:4},{festival:4},{0:10})]},
  {title:'Opening day', text:'The gates are almost open. Set the tone for the celebration.', options:[option('Make entry free','Spend 3 funds. Festival +10, everyone welcomes it.',{funds:-3},{festival:10},{0:4,1:4,2:4,3:4,4:4,5:4}),option('Sell tickets','Earn 5 funds. Some neighbours stay home.',{funds:5},{festival:5},{0:5,4:-8}),option('Invite people to contribute','Festival +6. Volunteers feel valued.',{},{festival:6},{5:10})]},
 ],
 'castaway-crew': [
  {title:'Our first priority', text:'The clouds are moving closer. Maya and Theo disagree about where to begin.', options:[option('Start with the radio','Use 1 part. Radio +14.',{parts:-1},{radio:14},{0:10,1:-5}),option('Build a safe camp','Use 2 wood. Shelter +15.',{wood:-2},{shelter:15},{1:10,0:-5}),option('Gather before building','Gain 2 wood and 3 food.',{wood:2,food:3},{},{2:6,3:6})]},
  {title:'Cargo in the rising tide', text:'There is time to save one cargo load before the water rises.', options:[option('Recover the food','Gain 9 food. Maya worries about spare parts.',{food:9},{},{2:10,4:10,0:-5}),option('Recover the equipment','Gain 3 parts. Iris worries about meals.',{parts:3},{},{0:10,5:8,4:-6}),option('Split the crew','Gain 4 food and 1 part; the camp needs repairs.',{food:4,parts:1},{shelter:-5},{3:5,1:-5})]},
  {title:'An exhausted scout', text:'Sam has found another route through the grove, but has barely rested.', options:[option('Send Sam again','Gain 7 wood. Sam feels used.',{wood:7},{},{3:-22,2:-8}),option('Give Sam a rest','Sam and Nia appreciate the care.',{},{},{3:16,2:10}),option('Send a fresh team','Spend 2 food; gain 4 wood.',{food:-2,wood:4},{},{3:6,2:4})]},
  {title:'The first squall', text:'A short storm is about to hit. Choose what to protect.', options:[option('Protect the radio','Radio +8, shelter takes 12 damage.',{},{radio:8,shelter:-12},{0:10,1:-12}),option('Protect the shelter','Shelter +8, radio takes 10 damage.',{},{shelter:8,radio:-10},{1:10,0:-12}),option('Use supplies on both','Spend 4 wood. Both projects gain 4.',{wood:-4},{shelter:4,radio:4},{0:4,1:4})]},
  {title:'A meal before the storm', text:'Iris wants a proper meal. Leo wants to save food for the signal watch.', options:[option('Share a warm meal','Spend 4 food. Everyone’s spirits lift.',{food:-4},{},{0:8,1:8,2:8,3:8,4:12,5:4}),option('Save the supplies','Gain 2 food. Some survivors feel unheard.',{food:2},{},{2:-8,4:-12,5:8}),option('Eat modestly together','Spend 1 food. A small lift for the crew.',{food:-1},{},{0:3,1:3,2:3,3:3,4:5,5:3})]},
  {title:'One last push', text:'The radio catches a faint reply. The storm will arrive tonight.', options:[option('Boost the signal','Spend 1 part. Radio +15.',{parts:-1},{radio:15},{0:12}),option('Secure the shelter','Spend 3 wood. Shelter +18.',{wood:-3},{shelter:18},{1:12}),option('Prepare together','Radio +5 and shelter +5.',{},{radio:5,shelter:5},{2:6,3:6,4:6,5:6})]},
 ],
};
function log(s, text) { s.log.push({id:++s.logId,day:s.day,text}); s.log=s.log.slice(-30); }
function remember(s, n, seat, text, emotion='happy') {
 n.memories.push({seat,day:s.day,text}); n.memories=n.memories.slice(-24);
 n.reaction={text,emotion,seat,until:s.elapsed+9};
}
function changeTrust(n, seat, amount) { n.trust[seat]=clamp(n.trust[seat]+amount); }
function changeMood(n, delta) { n.mood=clamp(n.mood+delta,-50,50); }
function reward(s, resources={}, metrics={}) {
 for(const [k,v] of Object.entries(resources)) s.resources[k]=Math.max(0,(s.resources[k]||0)+v);
 for(const [k,v] of Object.entries(metrics)) s.metrics[k]=clamp((s.metrics[k]||0)+v);
}
function affordable(s, cost) { return Object.entries(cost).every(([k,v])=>(s.resources[k]||0)>=v); }
function spend(s, cost) { if(!affordable(s,cost))throw Error('The shared supplies have changed. Gather more before starting.');for(const [k,v] of Object.entries(cost))s.resources[k]-=v; }
function beginDay(s) {
 s.dayElapsed=0;s.event={...structuredClone(events[s.game][s.day-1]),votes:s.players.map(()=>null),resolved:false,result:null};
 for(const p of s.players){p.energy=s.players.length===1?6:4;p.ready=false;p.job=null;p.target=null;}
 for(const n of s.npcs){n.worked=false;n.job=null;n.target=null;n.spoken=s.players.map(()=>false);}
}
export function newSimulation(game,n) {
 if(!simulationIds.has(game)||!Number.isInteger(n)||n<1||n>4)throw Error('Use 1–4 players in a supported simulation.');
 const s={game,kind:'simulation',tick:0,elapsed:0,day:1,totalDays:game==='town-council'?7:6,daySeconds:game==='town-council'?120:150,dayElapsed:0,finished:false,winners:[],reason:'',log:[],logId:0,
  obstacles:game==='town-council'?[{x:49,z:3,w:17,d:18.22},{x:15,z:13,w:15,d:15.75},{x:30,z:10,w:12,d:12.77},{x:86,z:40,w:13,d:9.16},{x:87,z:59,w:13,d:9.29}]:[{x:40,z:45,w:9,d:9.01},{x:23,z:58,w:14,d:14.43}],
  locations:locations[game].map(([id,label,x,z])=>({id,label,x,z})),
  resources:game==='town-council'?{funds:18}:{food:10+n*2,wood:6,parts:2},
  metrics:game==='town-council'?{festival:10,safety:45}:{radio:0,shelter:20},
  players:Array.from({length:n},(_,i)=>({x:46+i*3,z:35,score:0,energy:4,ready:false,job:null,target:null})),
  npcs:[],promises:[],event:null,
 };
 s.npcs=residents[game].map(([name,role,trait,place,priority,intro],i)=>{const l=s.locations.find(l=>l.id===place);return {id:i,name,role,trait,place,priority,intro,x:l.x+4,z:l.z+3,mood:0,trust:Array(n).fill(50),memories:[],reaction:null,spoken:Array(n).fill(false),worked:false};});
 beginDay(s);log(s,town(s)?'Welcome, council. Prepare the festival, care for the town, and earn residents’ trust.':'Everyone made it ashore. Repair the radio, build shelter, and feed the crew before the storm.');return s;
}
function resolveVote(s) {
 if(s.event.resolved)return;
 const counts=s.event.options.map((_,i)=>s.event.votes.filter(v=>v===i).length),max=Math.max(...counts);
 const best=counts.map((v,i)=>v===max?i:-1).filter(i=>i>=0);
 const selected=best.length===1?best[0]:2, o=s.event.options[selected];
 const cost=Object.fromEntries(Object.entries(o.resources).filter(([,v])=>v<0).map(([k,v])=>[k,-v]));
 if(!affordable(s,cost)){s.event.result='The plan could not be funded. No supplies were spent.';log(s,s.event.result);s.event.resolved=true;return;}
 reward(s,o.resources,o.metrics);
 for(const [id,delta] of Object.entries(o.moods)){
  const npc=s.npcs[Number(id)];changeMood(npc,delta);
  s.event.votes.forEach((v,seat)=>{if(v===selected){changeTrust(npc,seat,Math.round(delta/2));remember(s,npc,seat,`${o.label}: ${delta>=0?'you supported something that mattered to me.':'I wish you had considered what I needed.'}`,delta>=0?'happy':'angry');}});
 }
 s.event.result=(best.length!==1?'Tie / no votes: ':'')+o.label;s.event.resolved=true;
 log(s,`${s.event.title} — ${s.event.result}.`);
}
function endDay(s) {
 resolveVote(s);
 // Paid work completes before the day closes; the server starts no new work
 // during the last seconds if it cannot finish before dusk.
 for(const p of s.players){p.job=null;p.target=null;}
 for(const n of s.npcs){
  if(Math.max(...n.trust)>=62&&n.mood>=0){
   if(n.priority in s.metrics)reward(s,{}, {[n.priority]:4});else reward(s,{[n.priority]:town(s)?2:n.priority==='food'?3:2});
   log(s,`${n.name} volunteered: ${n.priority} improved because someone earned their trust.`);
  }
 }
 if(town(s))s.metrics.safety=clamp(s.metrics.safety-5);
 else {
  const need=6+s.players.length, missing=Math.max(0,need-s.resources.food);s.resources.food=Math.max(0,s.resources.food-need);
  if(missing){for(const n of s.npcs)changeMood(n,-missing*3);log(s,`Supper was ${missing} food short. The crew is worried.`);}else{for(const n of s.npcs)changeMood(n,2);log(s,`Everyone ate. ${need} food shared at camp.`);}
  if(s.day>=3)s.metrics.shelter=clamp(s.metrics.shelter-4);
 }
 for(const promise of s.promises.filter(p=>p.due<=s.day&&!p.done)){
  const n=s.npcs[promise.npc],current=s.metrics[promise.metric]??s.resources[promise.metric]??0,kept=current>=promise.target;
  changeTrust(n,promise.seat,kept?15:-18);changeMood(n,kept?6:-8);promise.done=true;
  remember(s,n,promise.seat,kept?'You kept your promise. I can count on you.':'You promised progress, but it did not happen.',kept?'happy':'sad');
  log(s,`${n.name} ${kept?'thanks':'questions'} Player ${promise.seat+1}: a promise was ${kept?'kept':'broken'}.`);
 }
 if(s.day===s.totalDays){
  const content=s.npcs.filter(n=>n.mood>=-10).length;
  const win=town(s)?s.metrics.festival>=75&&s.metrics.safety>=50&&content>=4:s.metrics.radio>=80&&s.metrics.shelter>=60&&content>=4;
  s.finished=true;s.winners=win?s.players.map((_,i)=>i):[];
  s.reason=town(s)?win?'The festival opens to a thriving town. Your council brought people together!':`The festival needed 75 preparation, 50 town care and 4 content residents. You reached ${s.metrics.festival}, ${s.metrics.safety} and ${content}/6.`:win?'Your signal is answered. The shelter holds, and the crew makes it through together!':`Rescue needed 80 radio, 60 shelter and 4 content survivors. You reached ${s.metrics.radio}, ${s.metrics.shelter} and ${content}/6.`;
  log(s,s.reason);return;
 }
 s.day++;beginDay(s);log(s,`Day ${s.day}: ${s.event.title}.`);
}
export function simulationAction(s,seat,d) {
 if(s.finished)throw Error('This story has ended.');
 if(!Number.isInteger(seat)||!s.players[seat])throw Error('Join the crew before making decisions.');
 if(!d||d.day!==s.day)throw Error('The day has changed. Choose again.');
 const p=s.players[seat];
 const meeting=s.locations.find(l=>l.id===(town(s)?'council':'camp'));
 if(d.type==='vote'){
  if(Math.hypot(p.x-meeting.x,p.z-meeting.z)>8)throw Error('Walk to the meeting point to cast your vote.');
  if(s.event.resolved)throw Error('The group has already decided.');
  if(!Number.isInteger(d.option)||!s.event.options[d.option])throw Error('Choose one of the group proposals.');
  s.event.votes[seat]=d.option;if(s.event.votes.every(v=>v!==null))resolveVote(s);return;
 }
 if(d.type==='ready'){
  if(p.job)throw Error('Finish your current task before ending the day.');
  if(d.ready&&Math.hypot(p.x-meeting.x,p.z-meeting.z)>8)throw Error('Return to the meeting point before resting.');
  if(typeof d.ready!=='boolean')throw Error('Choose whether you are ready.');
  p.ready=d.ready;if(s.players.every(p=>p.ready)&&!s.players.some(p=>p.job))endDay(s);return;
 }
 if(p.ready)throw Error('Uncheck ready to keep exploring.');
 if(p.job)throw Error('Finish your current task first.');
 if(p.energy<1)throw Error('You have used today’s actions. Vote and finish the day with your crew.');
 if(d.type==='task'){
  const task=taskSets[s.game].find(t=>t.id===d.task);if(!task)throw Error('Choose a task from the list.');
  const l=s.locations.find(l=>l.id===task.location);
  if(Math.hypot(l.x-p.x,l.z-p.z)>6)throw Error('Walk to the work site before starting this task.');
  if(s.daySeconds-s.dayElapsed<task.seconds+1)throw Error('Dusk is too close to finish that task. Start it tomorrow.');
  spend(s,task.cost);p.energy--;p.target=null;p.job={id:task.id,remaining:task.seconds,total:task.seconds};return;
 }
 if(d.type==='talk'){
  const n=Number.isInteger(d.npc)?s.npcs[d.npc]:null;
  if(!n||!['listen','share','ask','promise'].includes(d.choice))throw Error('Choose a resident and a conversation.');
  if(Math.hypot(n.x-p.x,n.z-p.z)>6)throw Error('Walk over to this person before talking.');
  if(n.spoken[seat])throw Error('Give this person some space. You can talk again tomorrow.');
  if(d.choice==='share')spend(s,town(s)?{funds:2}:{food:2});
  if(d.choice==='promise'&&s.promises.some(q=>q.npc===n.id&&q.seat===seat&&!q.done))throw Error('Keep your existing promise first.');
  p.target=null;n.facing=seat;p.energy--;n.spoken[seat]=true;p.score++;
  if(d.choice==='listen'){changeTrust(n,seat,9);changeMood(n,4);remember(s,n,seat,`Thanks for listening. ${n.intro}`);}
  if(d.choice==='share'){changeTrust(n,seat,14);changeMood(n,10);remember(s,n,seat,town(s)?'You backed my work. That means a lot.':'You shared your food with me. I will remember that.','heart');}
  if(d.choice==='ask'){
   if(n.worked||n.trust[seat]<58||n.mood< -10){changeTrust(n,seat,-3);remember(s,n,seat,n.worked?'I already helped today. Please let me rest.':n.mood< -10?'I need you to take our problems seriously first.':'Get to know me before asking me to do your work.','angry');}
   else{n.worked=true;n.job={until:s.elapsed+8};n.target={x:s.locations.find(l=>l.id===n.place).x+1,z:s.locations.find(l=>l.id===n.place).z+2};changeMood(n,-3);changeTrust(n,seat,2);if(n.priority in s.metrics)reward(s,{}, {[n.priority]:10});else reward(s,{[n.priority]:n.priority==='food'?6:3});remember(s,n,seat,`I trust you. I will help with ${n.priority}.`);log(s,`${n.name} helped Player ${seat+1} with ${n.priority}.`);}
  }
  if(d.choice==='promise'){
   const current=s.metrics[n.priority]??s.resources[n.priority]??0,target=n.priority in s.metrics?Math.min(100,current+10):current+(n.priority==='food'?3:2);
   s.promises.push({npc:n.id,seat,metric:n.priority,target,due:Math.min(s.totalDays,s.day+1),done:false});changeTrust(n,seat,4);
   remember(s,n,seat,`I am counting on you: ${n.priority} at ${target} by dusk on day ${Math.min(s.totalDays,s.day+1)}.`,'idea');
  }return;
 }
 throw Error('Choose a supported simulation action.');
}
export function advanceSimulation(original,inputs=[]) {
 if(original.finished)return original;const s=structuredClone(original);s.tick++;s.elapsed=s.tick/20;s.dayElapsed+=.05;
 for(const [seat,p] of s.players.entries()){
  const input=inputs[seat]||{};
  if(!p.job&&!p.ready){
   const h=Number(input.right===true)-Number(input.left===true),v=Number(input.up===true)-Number(input.down===true),len=Math.hypot(h,v)||1;
   const speed=(input.block===true?15:10)*.05/len,dx=(h-v)*Math.SQRT1_2*speed,dz=(-h-v)*Math.SQRT1_2*speed;
   const valid=(x,z)=>x>=3&&x<=97&&z>=3&&z<=67&&(town(s)||((x-50)/54)**2+((z-35)/37)**2<.94)&&!s.obstacles.some(o=>Math.abs(x-o.x)<o.w/2+1&&Math.abs(z-o.z)<o.d/2+1);
   if(valid(p.x+dx,p.z))p.x+=dx;if(valid(p.x,p.z+dz))p.z+=dz;
   p.moving=Boolean(h||v);if(h||v)p.facing=Math.atan2(dx,dz);
  }else p.moving=false;
  if(p.job&&!p.target){p.job.remaining=Math.max(0,p.job.remaining-.05);if(p.job.remaining<=.0001){const task=taskSets[s.game].find(t=>t.id===p.job.id);reward(s,task.reward,task.metric);p.score+=3;const n=s.npcs[task.npc];changeTrust(n,seat,3);changeMood(n,2);if(task.id==='garden')for(const npc of s.npcs)changeMood(npc,2);log(s,`Player ${seat+1}: ${task.label.toLowerCase()}.`);p.job=null;}}
 }
 for(const n of s.npcs){
  if(n.target){const dx=n.target.x-n.x,dz=n.target.z-n.z,d=Math.hypot(dx,dz);if(d<.2)n.target=null;else{n.x+=dx/d*.2;n.z+=dz/d*.2;}}
  if(n.job&&s.elapsed>=n.job.until)n.job=null;
 }
 if(s.dayElapsed+.0001>=s.daySeconds)endDay(s);return s;
}
export function simulationView(s,seat) {
 const v=structuredClone(s);
 v.tasks=structuredClone(taskSets[s.game]);
 v.npcs=v.npcs.map(n=>{const {trust,memories,spoken,...publicNpc}=n;return {...publicNpc,trust:seat>=0?trust[seat]:null,spoken:seat>=0?spoken[seat]:false,memories:memories.filter(m=>m.seat===seat).slice(-3),reaction:n.reaction?.seat===seat||n.reaction?.seat===null?n.reaction:null};});
 v.promises=v.promises.filter(p=>p.seat===seat&&!p.done);
 // Keep only the viewer's ballot until everyone has voted. Other players can
 // see participation, but cannot use a reconnect to read private votes.
 v.event.voted=v.event.votes.map(n=>n!==null);
 if(!v.event.resolved)v.event.votes=v.event.votes.map((n,i)=>i===seat?n:null);
 v.contentResidents=v.npcs.filter(n=>n.mood>=-10).length;return v;
}
