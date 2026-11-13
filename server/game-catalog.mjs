import library from './library-catalog.json' with {type:'json'};
import {packs} from './pack-recipes.mjs';
const quiz=(id,title,category,label,description,seconds=75)=>({id,title,category,label,description,rounds:5,seconds,kind:'quiz'});
const casual=(id,title,label,description)=>({id,title,category:'Gaming',label,description,rounds:0,seconds:0,kind:'game',engine:'local'});
const originals = [
 casual('2048','Just one more tile','2048','Slide, merge, repeat. Can you make the 2048 tile?'),
 quiz('trivia','Know-it-all?','Facts','Trivia','A little bit of everything. Five questions. No spoilers.'),
 {id:'chess',title:'One move. Checkmate.',category:'Gaming',label:'Chess',description:'Find the winning move before the clock runs out.',rounds:1,seconds:90,kind:'puzzle'},
 casual('memory','A perfect match','Memory','Six pairs, one sharp memory. Match the whole board in as few turns as possible.'),
 quiz('maths','Number rush','Maths','Quick maths','Fresh numbers. Sixty seconds. Think fast.',60),
 quiz('space','Space cadet','Science','Space','Take a quick trip through our solar system.'),
 casual('lights','Lights out!','Logic puzzle','Tap a light to flip it and its neighbours. Turn the whole board off.'),
 quiz('music','On the record','Facts','Music','Keys, notes, rhythm. How well do you know the music?'),
 quiz('sports','Sports brain','Sports','Sports','Five sporting questions. Bring your game face.'),
 casual('slide','Get in line','Sliding puzzle','Slide the tiles into order, from 1 to 8. Every board can be solved.'),
 quiz('geography','Where on Earth?','Facts','Geography','A tiny world tour. No passport required.'),
 quiz('science','Lab partners','Science','Science','A quick science showdown. Bring your curiosity.'),
 quiz('animals','Wild guesses','Science','Animals','From ocean giants to tiny insects. Know your neighbours.'),
 casual('codebreaker','Crack the code','Codebreaker','Four hidden colours. Six guesses. Read the clues and crack it.'),
 quiz('life','Think sideways','Life','Riddles','Five little riddles. Look at things a different way.',90),
 quiz('crypto','Chain reaction','Crypto','Crypto','Keys, blocks and wallets. Test the basics.'),
 quiz('history','Back in the day','Facts','History','Five stops in the past. How much do you remember?'),
 quiz('food','Good taste','Life','Food','A bite-sized quiz for people who love food.'),
 quiz('times','Multiply the fun','Maths','Times tables','A multiplication sprint. Fresh numbers every time.',45),
 quiz('cinema','Roll credits','Facts','Film','Behind the camera, on the screen. Five film questions.'),
 quiz('tech','Hello, world','Facts','Technology','A quick check of your digital instincts.'),
 {...quiz('sequence','What comes next?','Maths','Number patterns','Spot the pattern. Fill in the missing number.',90),kind:'puzzle'},
 quiz('fractions','Piece of cake','Maths','Fractions','Halves, quarters, percentages. Five little slices of maths.',60),
 {...quiz('words','Word shuffle','Facts','Word puzzle','Untangle the letters. Beat the clock.',90),kind:'puzzle'},
];

export const games=[...library,...originals.map(g=>({...g,kind:['lights','slide','codebreaker'].includes(g.id)?'puzzle':g.kind,art:g.id,multiplayer:g.engine!=='local'})),...Array.from({length:50},(_,i)=>Array.from({length:20},(_,j)=>packs[j*50+i])).flat()];

// Archive configurations remain resolvable for existing saved runs, but are not standalone titles.
const firstPicks=['chogan-sudoku','aba-sum-ten','chogan-dots','chogan-mancala','js13k-xx142-b2exe','littlejs-astroblast','aba-draft-line'];
const imported=library.slice().sort((a,b)=>{const ai=firstPicks.indexOf(a.id),bi=firstPicks.indexOf(b.id);return (ai<0?100:ai)-(bi<0?100:bi);});
const classic=games.filter(game=>!game.pack&&game.engine!=='imported');
const fullDiscoveryGames=[...imported.slice(0,7),...classic.slice(0,6),...imported.slice(7,18),...classic.slice(6),...imported.slice(18)];

// Solo and same-device imports are parked, not deleted. Re-enable individually after multiplayer integration.
export const discoveryGames=fullDiscoveryGames.filter(game=>game.multiplayer===true);
