import test from 'node:test';
import assert from 'node:assert/strict';
import { coverKey, streamLink } from '../server/media.mjs';
test('stream links allow only canonical public YouTube videos and Twitch channels',()=>{
  assert.deepEqual(streamLink('https://www.youtube.com/live/M7lc1UVf-VE?si=test'),{platform:'youtube',id:'M7lc1UVf-VE',url:'https://www.youtube.com/watch?v=M7lc1UVf-VE'});
  assert.equal(streamLink('https://www.twitch.tv/Player_01').id,'player_01');
  assert.equal(streamLink(''),null); assert.equal(coverKey('science'),'science');
  for(const url of ['javascript:alert(1)','http://twitch.tv/player','https://user:password@twitch.tv/player','https://twitch.tv.evil.example/player','https://youtube.com/watch?v=oops','https://twitch.tv:444/player','https://youtube.com/@channel','https://127.0.0.1/video','https://twitch.tv/directory']) assert.throws(()=>streamLink(url));
  assert.throws(()=>coverKey('https://image.invalid/picture.png'));
});
