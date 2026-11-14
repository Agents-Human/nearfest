import {arcadeGames} from './arcade/catalog.mjs';
import {skillGames} from './skill/engines.mjs';
import library from './library-catalog.json' with {type:'json'};
import {packs} from './pack-recipes.mjs';
const quiz=(id,title,category,label,description,seconds=75)=>({id,title,category,label,description,rounds:5,seconds,kind:'quiz'});
const casual=(id,title,label,description)=>({id,title,category:'Gaming',label,description,rounds:0,seconds:0,kind:'game',engine:'local'});
const originals = [
 casual('2048','Just one more tile','2048','A little board, a growing collection of numbers, and the irresistible promise of one more tile.'),
 quiz('trivia','Know-it-all?','Facts','Trivia','A little bit of everything. Five questions. No spoilers.'),
 {id:'chess',title:'One move. Checkmate.',category:'Gaming',label:'Chess',description:'A chess position with one decisive move hiding in plain sight.',rounds:1,seconds:90,kind:'puzzle'},
 casual('memory','A perfect match','Memory','A board full of familiar symbols and almost-remembered places. Give your memory a playful workout.'),
 quiz('maths','Number rush','Maths','Quick maths','Fresh numbers. Sixty seconds. Think fast.',60),
 quiz('space','Space cadet','Science','Space','Take a quick trip through our solar system.'),
 casual('lights','Lights out!','Logic puzzle','A little grid of lights with a satisfying logic hidden underneath. Every switch changes the picture.'),
 quiz('music','On the record','Facts','Music','Keys, notes, rhythm. How well do you know the music?'),
 quiz('sports','Sports brain','Sports','Sports','Five sporting questions. Bring your game face.'),
 casual('slide','Get in line','Sliding puzzle','Eight tiles, one empty space, and a puzzle waiting to fall into place.'),
 quiz('geography','Where on Earth?','Facts','Geography','A tiny world tour. No passport required.'),
 quiz('science','Lab partners','Science','Science','A quick science showdown. Bring your curiosity.'),
 quiz('animals','Wild guesses','Science','Animals','From ocean giants to tiny insects. Know your neighbours.'),
 casual('codebreaker','Crack the code','Codebreaker','A colourful mystery with a secret at its centre. Let a few small clues lead you to the answer.'),
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

export const games=[...arcadeGames,...skillGames,...library,...originals.map(g=>({...g,kind:['lights','slide','codebreaker'].includes(g.id)?'puzzle':g.kind,art:g.id,multiplayer:g.engine!=='local'})),...Array.from({length:50},(_,i)=>Array.from({length:20},(_,j)=>packs[j*50+i])).flat()];

// Published games are our own implementations with both solo and online play.
// Imported sources, older solo prototypes and generated configurations stay archived.
const featuredIds=['platform-relay','pocket-racers','stick-rivals','tappy-plane','bridge-builders','cat-defense','oware','checkers','chess-online','connect-four','reversi','hex','nine-mens-morris','maths','science','trivia','chess'];
// Removed from the product catalogue and new-room creation. Keep engine metadata
// available so existing room history and pending settlements can still be read.
const retiredGameIds=new Set(['pocket-soccer','marble-run','dots-boxes','paddle-duel','air-hockey','bomb-maze','marble-knockout','kitchen-rush','paint-tag']);
const published=games.filter(g=>!retiredGameIds.has(g.id)&&!g.pack&&(g.engine==='arcade'||g.engine==='skill'&&g.id!=='kalah'||!g.engine));
const byId=new Map(published.map(g=>[g.id,g]));
const orderedPublished=[...featuredIds.map(id=>byId.get(id)),...published.filter(g=>!featuredIds.includes(g.id))].filter(Boolean);
export const discoveryGames=[...orderedPublished.filter(g=>g.engine),...orderedPublished.filter(g=>!g.engine)]
 .map(g=>({...g,solo:true,bettable:g.bettable!==false}));
export const publishedGame=id=>discoveryGames.find(g=>g.id===id);
