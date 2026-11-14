import test from 'node:test';import assert from 'node:assert/strict';
import {amount} from '../server/domain.mjs';import {formatNear} from '../shared/near-amount.mjs';
test('displayed stakes and payouts preserve all 24 decimals, including one yoctoNEAR',()=>{
 for(const value of ['0','0.000000000000000000000001','0.00001','0.123456789012345678901234','101.125','999999.000000000000000000000001'])assert.equal(formatNear(amount(value)),value);
 assert.equal(formatNear(amount('12.123456'),4),'12.1234');
});
