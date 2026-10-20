import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate, compare, validate} from './simulator.mjs';

test('single lost acknowledgement applies twice without deduplication',()=>{
  const r=simulate({clients:1,capacity:1,attempts:4},'fixed');
  assert.deepEqual(r.trace.map(x=>[x.tick,x.result,x.effect]),[[0,'Unavailable',false],[2,'Response lost',true],[4,'Acknowledged',true]]);
  assert.deepEqual(r.summary,{attempts:3,effects:2,duplicateEffects:1,acknowledged:1,pending:0,exhausted:0,horizonPending:0});
});
test('same lost acknowledgement is retried but stable key prevents repeated effect',()=>{
  const r=simulate({clients:1,capacity:1,attempts:4,deduplicate:true},'fixed');
  assert.deepEqual(r.trace.map(x=>[x.tick,x.result,x.effect]),[[0,'Unavailable',false],[2,'Response lost',true],[4,'Acknowledged',false]]);
  assert.equal(r.summary.attempts,3);assert.equal(r.summary.effects,1);assert.equal(r.summary.duplicateEffects,0);
});
test('all clients fit capacity without outage: exactly one effect and ack each',()=>{
  for(const policy of ['fixed','jitter']){
    const r=simulate({clients:12,capacity:12,scenario:'capacity'},policy);
    assert.equal(r.trace.length,12);assert.equal(r.load.length,1);assert.equal(r.summary.effects,12);assert.equal(r.summary.acknowledged,12);assert.equal(r.summary.pending,0);
  }
});
test('one allowed attempt during initial outage exhausts clients without effects',()=>{
  const r=simulate({clients:5,attempts:1},'fixed');
  assert.equal(r.summary.effects,0);assert.equal(r.summary.acknowledged,0);assert.equal(r.summary.exhausted,5);assert.equal(r.summary.pending,5);
});
test('capacity admits first IDs only; later clients retry and capacity resets each tick',()=>{
  const r=simulate({clients:3,capacity:1,attempts:3,scenario:'capacity'},'fixed');
  assert.deepEqual(r.trace.filter(x=>x.effect).map(x=>[x.tick,x.client]),[[0,0],[2,1],[4,2]]);
  assert.equal(r.summary.acknowledged,3);assert.equal(r.summary.attempts,6);
});
test('exact seed reproduces both complete traces',()=>{
  assert.deepEqual(compare({clients:37,seed:123,deduplicate:true}),compare({clients:37,seed:123,deduplicate:true}));
  assert.notDeepEqual(simulate({clients:37,seed:123},'jitter').trace,simulate({clients:37,seed:124},'jitter').trace);
});
test('finite horizon preserves unresolved scheduled work instead of calling it failed or acknowledged',()=>{
  const r=simulate({clients:80,capacity:1,attempts:8,delay:16,scenario:'outage'},'fixed');
  assert.equal(r.load.length,80);assert.equal(r.summary.attempts,394);
  assert.equal(r.summary.acknowledged,4);assert.equal(r.summary.effects,4);
  assert.equal(r.summary.pending,76);assert.equal(r.summary.horizonPending,76);assert.equal(r.summary.exhausted,0);
  assert.ok(r.clients.filter(c=>c.status==='pending').every(c=>c.next===80&&c.attempts===5));
});
test('invalid settings fail before a simulation; no silent coercion or rounding',()=>{
  for(const input of [{clients:0},{clients:81},{capacity:0},{attempts:1.1},{seed:-1},{seed:2**32},{delay:0},{jitter:0},{scenario:'unknown'},{deduplicate:'true'},{clients:NaN},{capacity:Infinity},{clients:'8'}])assert.throws(()=>validate(input));
  assert.throws(()=>simulate({},'invented'));
});
test('200 bounded scenarios satisfy independent accounting and application invariants',()=>{
  for(let seed=0;seed<200;seed++)for(const policy of ['fixed','jitter']){
    const r=simulate({clients:1+seed%43,capacity:1+seed%9,attempts:1+seed%8,seed,delay:1+seed%16,jitter:1+seed%32,deduplicate:seed%2===0,scenario:['lost-ack','capacity','outage'][seed%3]},policy);
    assert.equal(r.summary.attempts,r.trace.length);
    assert.equal(r.load.reduce((n,x)=>n+x.attempts,0),r.trace.length);
    assert.equal(r.trace.filter(x=>x.effect).length,r.summary.effects);
    assert.equal(r.clients.filter(x=>x.status==='acknowledged').length,r.summary.acknowledged);
    assert.equal(r.summary.acknowledged+r.summary.exhausted+r.summary.horizonPending,r.settings.clients);
    assert.equal(r.summary.pending,r.summary.exhausted+r.summary.horizonPending);
    for(const tick of r.load){
      const rows=r.trace.filter(x=>x.tick===tick.tick);
      const admitted=rows.filter(x=>['Acknowledged','Response lost'].includes(x.result));
      assert.equal(admitted.length,tick.admitted);assert.ok(admitted.length<=r.settings.capacity);
      if(tick.tick<r.outageTicks)assert.equal(admitted.length,0);
    }
    for(const client of r.clients){
      const rows=r.trace.filter(x=>x.client===client.id);
      assert.ok(rows.length<=r.settings.attempts);
      assert.equal(rows.filter(x=>x.effect).length,client.applied);
      if(r.settings.deduplicate)assert.ok(client.applied<=1);
      const ack=rows.findIndex(x=>x.result==='Acknowledged');if(ack>=0)assert.equal(ack,rows.length-1);
      for(const row of rows){if(row.nextTick!==null)assert.ok(row.nextTick>row.tick);if(['Unavailable','Capacity rejected'].includes(row.result))assert.equal(row.effect,false);}
    }
  }
});
