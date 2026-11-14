import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from './helpers/store.mjs';
import {createBoardRooms} from '../server/skill/rooms.mjs';
import {createMultiplayer} from '../server/multiplayer.mjs';
import {createArcadeRooms} from '../server/arcade/rooms.mjs';
import {roomInvite, socialInvites} from '../src/invite-links.mjs';

test('member history survives discovery limits, restart, and private-room reopening', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nearfest-history-'));
  let store = (await openStore(join(dir, 'rooms.sqlite')));
  try {
    const host = (await store.ensureUser('host.testnet', 'Host', 'wallet'));
    const member = (await store.ensureUser('friend.testnet', 'Friend', 'wallet'));
    const stranger = (await store.ensureUser('stranger.testnet', 'Stranger', 'wallet'));
    const board = createBoardRooms(store), quiz = createMultiplayer(store), arcade = (await createArcadeRooms(store));
    const services = [board, quiz, arcade];
    const drafts = [{game_id: 'connect-four'}, {game_id: 'trivia'}, {game_id: 'pocket-racers'}];
    const tables = ['skill_rooms', 'multiplayer_rooms', 'arcade_rooms'];
    const joined = (await Promise.all(services.map(async (service, i) => {
      const room = (await service.create({...drafts[i], entry: '0', visibility: 'invite'}, host));
      const before = (await service.action(room.id, member, {type: 'join'}, i === 2 ? room.invite_key : undefined));
      const again = (await service.action(room.id, member, {type: 'join'}));
      assert.equal(again.players.length, before.players.length, 'reopening must not duplicate a seat');
      assert.deepEqual((await service.list(stranger, {mine: true})), []);
      assert.deepEqual((await service.list(null, {mine: true})), []);
      const original = JSON.parse((await store.db.prepare(`SELECT json FROM ${tables[i]} WHERE id=$1`).get(room.id)).json);
      for (let j = 0; j < 210; j++) {
        const unrelated = {...original, id: `unrelated-${i}-${j}`, visibility: 'public', players: [{...original.players[0], id: stranger.id}], host: stranger.id};
        (await store.db.prepare(`INSERT INTO ${tables[i]}(id,json) VALUES($1,$2)`).run(unrelated.id, JSON.stringify(unrelated)));
      }
      return room;
    })));
    (await store.db.close()); store = (await openStore(join(dir, 'rooms.sqlite')));
    const restored = [createBoardRooms(store), createMultiplayer(store), (await createArcadeRooms(store))];
    (await (async()=>{const values=restored,fn=async (service, i) => {
      const mine = (await service.list(member, {mine: true}));
      assert.deepEqual(mine.map(room => room.id), [joined[i].id]);
      const reopened = (await service.get(joined[i].id, member));
      assert.equal(reopened.players.filter(p => p.id === member.id).length, 1);
      assert.equal(reopened.status, 'lobby');
      assert.equal(reopened.pot, '0');
      assert((await service.list(host, {mine: true})).some(room => room.id === joined[i].id));
      assert(!(await service.list(stranger)).some(room => room.id === joined[i].id));
    };for(let i=0;i<values.length;i++)await fn(values[i],i,values);})());
    (await assert.rejects(async () => (await restored[2].get(joined[2].id, stranger)), /invitation/));
    assert.equal((await restored[2].get(joined[2].id, stranger, joined[2].invite_key)).id, joined[2].id);
  } finally {(await store.db.close()); rmSync(dir, {recursive: true, force: true});}
});

test('all share channels preserve the full invitation without unrelated route parameters', () => {
  const link = roomInvite('https://nearfest.example/?game=old&room=other', 'party', 'arena-a', 'key&with=reserved');
  const parsed = new URL(link);
  assert.equal(parsed.searchParams.get('party'), 'arena-a');
  assert.equal(parsed.searchParams.get('invite'), 'key&with=reserved');
  assert.equal(parsed.searchParams.has('game'), false);
  assert.equal(parsed.searchParams.has('room'), false);
  const links = socialInvites(link, 'Friends & games');
  assert.deepEqual(links.map(item => item.name), ['WhatsApp', 'Telegram', 'Facebook', 'X']);
  for (const item of links) assert(decodeURIComponent(item.href).includes(link));
  assert.equal(new URL(roomInvite('https://nearfest.example', 'club', 'abc', 'ignored')).searchParams.has('invite'), false);
});
