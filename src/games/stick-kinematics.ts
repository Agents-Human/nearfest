/** Two-link leg IK. Angles are measured from down, matching the side-view rig.
 * A small extension margin prevents locked knees and singular straight legs. */
export function solveStickLeg(x:number,y:number,thigh=1.58,shin=1.65,bend=1){
 const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
 const distance=clamp(Math.hypot(x,y),Math.abs(thigh-shin)+.08,thigh+shin-.025);
 const heading=Math.atan2(x,-y);
 const hip=heading+bend*Math.acos(clamp((thigh*thigh+distance*distance-shin*shin)/(2*thigh*distance),-1,1));
 const knee=-bend*Math.acos(clamp((distance*distance-thigh*thigh-shin*shin)/(2*thigh*shin),-1,1));
 return {hip,knee,ankle:-(hip+knee)};
}
