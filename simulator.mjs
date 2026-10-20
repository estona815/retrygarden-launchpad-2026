export const MODEL = 'retrygarden/discrete-network/v1';
export const DEFAULTS = Object.freeze({clients:8, capacity:3, attempts:4, seed:42, delay:2, jitter:8, deduplicate:false, scenario:'lost-ack'});

export function validate(input) {
  const s = {...DEFAULTS, ...input};
  for (const [key, min, max] of [['clients',1,80],['capacity',1,80],['attempts',1,8],['seed',0,4294967295],['delay',1,16],['jitter',1,32]]) {
    if (!Number.isInteger(s[key]) || s[key] < min || s[key] > max) throw new Error(`${key} must be an integer from ${min} to ${max}.`);
  }
  if (!['lost-ack','capacity','outage'].includes(s.scenario)) throw new Error('Unknown scenario.');
  if (typeof s.deduplicate !== 'boolean') throw new Error('Deduplication must be a boolean.');
  return s;
}

// Integer arithmetic PRNG: identical seed/configuration produces identical traces.
function random(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state,1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

export function simulate(input, policy) {
  const settings = validate(input);
  if (!['fixed','jitter'].includes(policy)) throw new Error('Unknown policy.');
  const rand = random(settings.seed);
  const clients = Array.from({length:settings.clients},(_,i)=>({id:i, next:0, attempts:0, status:'pending', applied:0, lost:false}));
  const trace = [], load = [];
  const outage = settings.scenario === 'capacity' ? 0 : 2;
  for (let tick=0; tick<80; tick++) {
    let admitted=0, attempted=0;
    // Stable client order deliberately exposes the model's tie-breaking assumption.
    for (const client of clients) {
      if (client.status !== 'pending' || client.next !== tick) continue;
      client.attempts++; attempted++;
      const row={tick, client:client.id, attempt:client.attempts, result:'', effect:false};
      if (tick < outage) row.result='Unavailable';
      else if (admitted >= settings.capacity) row.result='Capacity rejected';
      else {
        admitted++;
        row.effect = !settings.deduplicate || client.applied === 0;
        if (row.effect) client.applied++;
        if (settings.scenario==='lost-ack' && client.id%3===0 && !client.lost) {
          client.lost=true; row.result='Response lost';
        } else { row.result='Acknowledged'; client.status='acknowledged'; }
      }
      if (client.status==='pending') {
        if (client.attempts >= settings.attempts) client.status='exhausted';
        else {
          const wait = policy==='fixed' ? settings.delay : 1+Math.floor(rand()*Math.min(settings.jitter,2**client.attempts));
          client.next=tick+wait;
        }
      }
      row.clientStatus=client.status;
      row.nextTick=client.status==='pending' ? client.next : null;
      trace.push(row);
    }
    load.push({tick,attempts:attempted,admitted});
    if (clients.every(c=>c.status!=='pending')) break;
  }
  const effects=clients.reduce((n,c)=>n+c.applied,0);
  const acknowledged=clients.filter(c=>c.status==='acknowledged').length;
  return {model:MODEL, settings, policy, horizon:80, outageTicks:outage, load, trace, clients,
    summary:{attempts:trace.length,effects,duplicateEffects:clients.reduce((n,c)=>n+Math.max(0,c.applied-1),0),acknowledged,pending:settings.clients-acknowledged,exhausted:clients.filter(c=>c.status==='exhausted').length,horizonPending:clients.filter(c=>c.status==='pending').length}};
}

export function compare(input) {
  const settings=validate(input);
  return {model:MODEL, synthetic:true, settings, assumptions:['Discrete ticks and zero service latency.','Stable client order resolves simultaneous requests.','Two initial unavailable ticks except capacity-only scenario.','First accepted response is lost once for clients C01, C04, C07, etc. in lost-ack scenario.','Retries use a seeded PRNG and finite attempts. Jitter has a one-tick minimum.','Optional deduplication retains each operation key for the entire run.','Pending includes exhausted and horizon-pending clients; not a production benchmark.'],fixed:simulate(settings,'fixed'),jitter:simulate(settings,'jitter')};
}
