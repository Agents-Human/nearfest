// Accelerate only maintenance timers in the spawned fault-injection test.
const interval=globalThis.setInterval;
globalThis.setInterval=(work,milliseconds,...args)=>interval(work,milliseconds===30000?25:milliseconds===1000?100:milliseconds,...args);
