import { runNetworkCheck } from '../src/netcheck.js';
console.log(JSON.stringify(await runNetworkCheck(), null, 2));