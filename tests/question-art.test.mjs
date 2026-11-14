import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../server/store.mjs';
import {createPlay} from '../server/play.mjs';
import {createMultiplayer} from '../server/multiplayer.mjs';
import {withQuestionArt} from '../server/question-art.mjs';

test('illustrated questions stay private until play, and both players receive identical artwork', async()=>{
  const store=openStore(':memory:');
  try {
    const [a,b,spectator]=['a','b','viewer'].map(name=>store.ensureUser(name,name,'practice'));
    // A synthetic payload, not a claimed production asset or a downloadable file.
    const illustration={src:'/art/studyjunior/test-fixture.svg',alt:'A science illustration',width:640,height:480};
    const curate=async candidates=>candidates.slice(0,5).map(q=>withQuestionArt(q,new Map([[q.prompt,{...illustration,privateNote:'not public'}]])));
    const solo=createPlay(store,{curate});
    assert(!JSON.stringify(solo.catalog()).includes('test-fixture'));
    const run=await solo.start('science',a);
    assert.deepEqual(run.question.illustration,illustration);
    assert(!('answer' in run.question));
    assert.throws(()=>solo.get(run.id,b));

    const rooms=createMultiplayer(store,{curate});
    const room=rooms.create({game_id:'science',entry:'0'},a,1000);
    rooms.action(room.id,b,{type:'join'},1001);
    for (const user of [a,b]) rooms.action(room.id,user,{type:'ready',ready:true},1002);
    assert.equal(rooms.get(room.id,a,1003).question,null);
    const countdown=await rooms.start(room.id,a,1004);
    assert.equal(countdown.question,null);
    assert(!JSON.stringify(countdown).includes('test-fixture'));
    assert.equal(rooms.get(room.id,spectator,6100).question,null);
    const qa=rooms.get(room.id,a,6100).question;
    assert.deepEqual(qa,rooms.get(room.id,b,6100).question);
    assert.deepEqual(qa.illustration,illustration);
    assert(!('answer' in qa));
    assert(!JSON.stringify(qa).includes('privateNote'));
    const next=rooms.answer(room.id,a,{index:0,answer:0},6200);
    assert.deepEqual(next.question.illustration,illustration);
    assert.equal(rooms.get(room.id,b,6200).me.index,0);
  } finally { store.db.close(); }
});
