import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore} from '../server/store.mjs';
import {createBoardRooms} from '../server/skill/rooms.mjs';
import {createMultiplayer} from '../server/multiplayer.mjs';
import {createArcadeRooms} from '../server/arcade/rooms.mjs';
import {roomInvite, socialInvites} from '../src/invite-links.mjs';

test('member history survives discovery limits, restart, and private-room reopening', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nearfest-history-'));
  let store = openStore(join(dir, 'rooms.sqlite'));
  try {
    const host = store.ensureUser('host.testnet', 'Host', 'wallet');
    const member = store.ensureUser('friend.testnet', 'Friend', 'wallet');
    const stranger = store.ensureUser('stranger.testnet', 'Stranger', 'wallet');
    const board = createBoardRooms(store), quiz = createMultiplayer(store), arcade = createArcadeRooms(store);
    const services = [board, quiz, arcade];
    const drafts = [{game_id: 'connect-four'}, {game_id: 'trivia'}, {game_id: 'pocket-racers'}];
    const tables = ['skill_rooms', 'multiplayer_rooms', 'arcade_rooms'];
    const joined = services.map((service, i) => {
      const room = service.create({...drafts[i], entry: '0', visibility: 'invite'}, host);
      const before = service.action(room.id, member, {type: 'join'}, i === 2 ? room.invite_key : undefined);
      const again = service.action(room.id, member, {type: 'join'});
      assert.equal(again.players.length, before.players.length, 'reopening must not duplicate a seat');
      assert.deepEqual(service.list(stranger, {mine: true}), []);
      assert.deepEqual(service.list(null, {mine: true}), []);
      const original = JSON.parse(store.db.prepare(`SELECT json FROM ${tables[i]} WHERE id=?`).get(room.id).json);
      for (let j = 0; j < 210; j++) {
        const unrelated = {...original, id: `unrelated-${i}-${j}`, visibility: 'public', players: [{...original.players[0], id: stranger.id}], host: stranger.id};
        store.db.prepare(`INSERT INTO ${tables[i]} VALUES(?,?)`).run(unrelated.id, JSON.stringify(unrelated));
      }
      return room;
    });
    store.db.close(); store = openStore(join(dir, 'rooms.sqlite'));
    const restored = [createBoardRooms(store), createMultiplayer(store), createArcadeRooms(store)];
    restored.forEach((service, i) => {
      const mine = service.list(member, {mine: true});
      assert.deepEqual(mine.map(room => room.id), [joined[i].id]);
      const reopened = service.get(joined[i].id, member);
      assert.equal(reopened.players.filter(p => p.id === member.id).length, 1);
      assert.equal(reopened.status, 'lobby');
      assert.equal(reopened.pot, '0');
      assert(service.list(host, {mine: true}).some(room => room.id === joined[i].id));
      assert(!service.list(stranger).some(room => room.id === joined[i].id));
    });
    assert.throws(() => restored[2].get(joined[2].id, stranger), /invitation/);
    assert.equal(restored[2].get(joined[2].id, stranger, joined[2].invite_key).id, joined[2].id);
  } finally {store.db.close(); rmSync(dir, {recursive: true, force: true});}
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
