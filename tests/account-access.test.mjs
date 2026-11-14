import test from 'node:test';
import assert from 'node:assert/strict';
import {hasAccess, roomBudget, parseNearEntry} from '../src/account-access.ts';

test('room setup accounts for stake, storage and gas before continuing', () => {
  const user = {id:'friend.testnet', kind:'wallet', name:'Friend', balance:parseNearEntry('0.119')};
  const request = {wallet:true, minimum:roomBudget(parseNearEntry('0.1'))};
  assert.equal(request.minimum, parseNearEntry('0.12'));
  assert.equal(roomBudget(parseNearEntry('0.1'), true), parseNearEntry('0.21'));
  assert.equal(hasAccess(null, request), false);
  assert.equal(hasAccess({...user, kind:'practice'}, request), false);
  assert.equal(hasAccess(user, request), false);
  assert.equal(hasAccess({...user, balance:request.minimum}, request), true);
  assert.equal(hasAccess({...user, balance:request.minimum, chain_error:'RPC unavailable'}, request), false);
  assert.equal(roomBudget('0', true), '0');
  assert.equal(hasAccess({...user, kind:'practice', balance:'0'}, {wallet:false}), true);
});

test('typed stakes keep exact precision and reject malformed amounts before onboarding', () => {
  assert.equal(parseNearEntry('0.000000000000000000000001'), '1');
  assert.equal(parseNearEntry('10.25'), '10250000000000000000000000');
  for (const value of ['-1', '1e3', 'NaN', '', '0.0000000000000000000000001']) {
    assert.throws(() => parseNearEntry(value), /valid NEAR amount/);
  }
});
