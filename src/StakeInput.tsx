import {useId} from 'react';

export default function StakeInput({defaultValue='0'}: {defaultValue?: string}) {
  const hint=useId();
  return <label>Stake per player
    <div className="stake-amount-input">
      <input name="entry" type="number" inputMode="decimal" min="0" step="any" defaultValue={defaultValue} required aria-label="Stake per player in NEAR" aria-describedby={hint}/>
      <span aria-hidden="true">NEAR</span>
    </div>
    <small id={hint}>Enter your stake in NEAR.</small>
  </label>;
}
