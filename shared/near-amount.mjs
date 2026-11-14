/** Keep stakes and payouts exact down to one yoctoNEAR. Precision is only for compact balances. */
export function formatNear(value,precision=24){
 const raw=BigInt(value),negative=raw<0n,n=negative?-raw:raw,unit=10n**24n;
 const fraction=(n%unit).toString().padStart(24,'0').slice(0,precision).replace(/0+$/,'');
 return (negative?'-':'')+(n/unit).toString()+(fraction?'.'+fraction:'');
}
