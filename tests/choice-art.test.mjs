import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {banks} from '../server/question-bank.mjs';
import {candidatesFor,createPlay} from '../server/play.mjs';
import {withChoiceArt} from '../server/choice-art.mjs';
import manifest from '../server/choice-assets.json' with {type:'json'};
import {openStore} from './helpers/store.mjs';
import {createMultiplayer} from '../server/multiplayer.mjs';

test('every illustrated choice matches its label after shuffling, with the correct answer unchanged',()=>{
  const seen=new Set();
  for(const [topic,bank] of Object.entries(banks))for(const question of candidatesFor(topic)){
    if(!manifest.questions[question.prompt])continue;
    seen.add(question.prompt);
    assert.equal(question.choiceArt.length,question.choices.length);
    assert.equal(question.choices[question.answer],bank.find(([prompt])=>prompt===question.prompt)[1]);
    for(const choices of [question.choices,[...question.choices].reverse()]){
      const decorated=withChoiceArt({...question,choices});
      decorated.choiceArt.forEach((art,index)=>{
        assert.equal(art.alt,choices[index]);
        assert.equal(art.hash,manifest.questions[question.prompt][choices[index]]);
        assert.equal(art.src,`https://clever-hall.fra1.digitaloceanspaces.com/assets/${art.hash}.svg`);
        assert(!('tags' in art));assert(!('collections' in art));assert(!('answer' in art));
      });
    }
  }
  assert.equal(seen.size,Object.keys(manifest.questions).length);
  for(const prompt of ['Which animal is a mammal?','Which of these animals lays eggs?','Which of these is a citrus fruit?','What has a neck but no head?'])assert(seen.has(prompt));
});

test('every published asset has identical verified source and fallback bytes',()=>{
  for(const asset of Object.values(manifest.assets)){
    const original=readFileSync(new URL(`../assets/source/studyjunior/choices/${asset.hash}.svg`,import.meta.url));
    const fallback=readFileSync(new URL(`../public${asset.fallbackSrc}`,import.meta.url));
    assert.equal(createHash('sha256').update(original).digest('hex'),asset.hash);
    assert.deepEqual(fallback,original);
    assert(asset.width>0&&asset.height>0);
    assert(!/<(?:script|foreignObject)\b/i.test(original.toString()));
  }
});

test('unrelated words, abstract answers, and incomplete matches stay playable without invented images',()=>{
  for(const question of [
    {type:'choice',prompt:'Unscramble: ELPPA',choices:['Apple','Peach','Pear','Lemon']},
    {type:'choice',prompt:'Which animal is a mammal?',choices:['Dolphin','Shark','Trout','Octopus']},
    {type:'choice',prompt:'2 + 2 = ?',choices:['2','3','4','5']},
  ])assert.deepEqual(withChoiceArt(question),question);
});

test('stored solo and multiplayer rounds gain the same pictures without exposing answers or changing scores',async()=>{
  const store=(await openStore(':memory:'));
  try{
    const [a,b,viewer]=(await Promise.all(['art-a','art-b','art-viewer'].map(async id=>(await store.ensureUser(id,id,'practice')))));
    const curate=async candidates=>{
      const pictured=candidates.filter(q=>q.choiceArt);
      // Simulate persisted rounds created before choice illustrations existed.
      return [...pictured,...candidates.filter(q=>!q.choiceArt)].slice(0,5).map(({choiceArt,...q})=>q);
    };
    const solo=createPlay(store,{curate});
    let run=await solo.start('animals',a);
    assert(run.question.choiceArt?.length===4);assert(!('answer' in run.question));
    const stored=JSON.parse((await store.db.prepare('SELECT json FROM play_runs WHERE id=$1').get(run.id)).json);
    assert(!stored.questions[0].choiceArt);
    assert.deepEqual((await solo.get(run.id,a)).question,run.question);
    run=(await solo.answer(run.id,a,{index:0,answer:stored.questions[0].answer}));
    assert.equal(run.score,1);assert.equal(run.feedback.correct,true);
    assert(run.question.choiceArt?.length===4);

    const rooms=createMultiplayer(store,{curate});
    const room=(await rooms.create({game_id:'animals',entry:'0'},a,1000));
    (await rooms.action(room.id,b,{type:'join'},1001));
    for(const user of [a,b])(await rooms.action(room.id,user,{type:'ready',ready:true},1002));
    const countdown=await rooms.start(room.id,a,1003);
    assert.equal(countdown.question,null);assert(!JSON.stringify(countdown).includes('choiceArt'));
    assert.equal((await rooms.get(room.id,viewer,6100)).question,null);
    const first=(await rooms.get(room.id,a,6100)).question;
    assert.deepEqual(first,(await rooms.get(room.id,b,6100)).question);
    assert(first.choiceArt?.length===4);assert(!('answer' in first));
    const truth=banks.animals.find(([prompt])=>prompt===first.prompt)[1];
    const next=(await rooms.answer(room.id,a,{index:0,answer:first.choices.indexOf(truth)},6200));
    assert.equal(next.me.score,1);assert.equal((await rooms.get(room.id,b,6200)).me.index,0);
    assert.deepEqual(first.choiceArt,(await rooms.get(room.id,b,6200)).question.choiceArt);
  }finally{(await store.db.close());}
});
