import {compare} from './simulator.mjs';
const $=id=>document.getElementById(id);
let run;
const clientName=n=>`C${String(n+1).padStart(2,'0')}`;
function cell(row,text,tag='td'){const c=document.createElement(tag);c.textContent=text;row.append(c);return c;}
function drawChart(){
  const ns='http://www.w3.org/2000/svg', svg=document.createElementNS(ns,'svg');
  const chartWidth=window.innerWidth<=620?420:900;
  svg.setAttribute('viewBox',`0 0 ${chartWidth} 300`);svg.setAttribute('role','img');svg.setAttribute('aria-label',`Attempts per simulated tick. ${run.settings.clients} clients. Fixed delay ${run.fixed.summary.attempts} attempts; full jitter ${run.jitter.summary.attempts}. Exact values in exported trace.`);
  const left=50,top=24,w=chartWidth-68,h=222, maxTick=Math.max(8,run.fixed.load.length-1,run.jitter.load.length-1),maxY=Math.max(run.settings.capacity,...run.fixed.load.map(x=>x.attempts),...run.jitter.load.map(x=>x.attempts),1);
  const x=t=>left+t/maxTick*w,y=n=>top+h-n/maxY*h;
  function e(tag,attrs,text){const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!=null)el.textContent=text;svg.append(el);return el;}
  if(run.fixed.outageTicks){e('rect',{x:x(0),y:top,width:x(run.fixed.outageTicks)-left,height:h,fill:'#fff4df'});e('text',{x:x(1),y:16,'text-anchor':'middle',fill:'#a66a00'},'Outage');}
  for(let i=0;i<=4;i++){const n=maxY*i/4;e('line',{x1:left,x2:left+w,y1:y(n),y2:y(n),stroke:'#edf0f4'});e('text',{x:left-9,y:y(n)+4,'text-anchor':'end'},Number(n.toFixed(1)));}
  e('path',{d:`M${left},${top}V${top+h}H${left+w}`,fill:'none',stroke:'#8791a1'});
  e('line',{x1:left,x2:left+w,y1:y(run.settings.capacity),y2:y(run.settings.capacity),stroke:'#8c96a4','stroke-dasharray':'5 5'});
  for(let i=0;i<=5;i++){const t=Math.round(maxTick*i/5);e('text',{x:x(t),y:top+h+21,'text-anchor':'middle'},t);}
  e('text',{x:0,y:12},'Attempts');e('text',{x:left+w/2,y:293,'text-anchor':'middle'},'Simulated tick');
  e('text',{x:left+w,y:Math.max(15,y(run.settings.capacity)-8),'text-anchor':'end'},`Capacity (${run.settings.capacity} / tick)`);
  for(const[key,color]of [['fixed','#d99105'],['jitter','#287848']]){const points=Array.from({length:maxTick+1},(_,t)=>[x(t),y(run[key].load[t]?.attempts??0)]);e('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:color,'stroke-width':'2.3'});for(const [cx,cy]of points)e('circle',{cx,cy,r:3,fill:color});}
  $('chart').replaceChildren(svg);
}
function drawTrace(){
  const selected=$('policy').value;const body=$('trace');body.replaceChildren();
  for(const item of run[selected].trace){const tr=document.createElement('tr');cell(tr,item.tick);cell(tr,clientName(item.client));cell(tr,item.attempt);const td=cell(tr,'');const b=document.createElement('button');b.type='button';b.textContent=item.result;b.setAttribute('aria-label',`Inspect tick ${item.tick}, ${clientName(item.client)}, attempt ${item.attempt}: ${item.result}`);td.append(b);cell(tr,item.effect?'Applied':item.result==='Acknowledged'?'Deduplicated':'None');b.onclick=()=>{for(const r of body.children)r.classList.remove('selected');tr.classList.add('selected');$('detail').textContent=`${clientName(item.client)} · tick ${item.tick} · ${item.result}. ${item.effect?'Server effect applied.':'No new server effect.'} ${item.nextTick!==null?`Retry scheduled at tick ${item.nextTick}.`:item.clientStatus==='exhausted'?'Attempt limit reached; no acknowledgement.':'Acknowledged; no retry.'}`;};body.append(tr);}
  $('detail').textContent='Choose an attempt to inspect its next step.';
}
function render(){
  $('comparison-title').textContent=run.fixed.outageTicks?'Same outage. Two retry policies.':'Same capacity. Two retry policies.';
  const body=$('summary');body.replaceChildren();
  for(const[key,label]of [['fixed','Fixed delay'],['jitter','Full jitter']]){const tr=document.createElement('tr');const first=cell(tr,label);const dot=document.createElement('span');dot.className=`dot ${key}`;first.prepend(dot);for(const k of ['attempts','effects','acknowledged','pending'])cell(tr,run[key].summary[k]);body.append(tr);}
  $('result-note').textContent=`Synthetic run · seed ${run.settings.seed} · duplicate effects: fixed ${run.fixed.summary.duplicateEffects}, jitter ${run.jitter.summary.duplicateEffects}. Unacknowledged at attempt limit: ${run.fixed.summary.exhausted} / ${run.jitter.summary.exhausted}; still pending at horizon: ${run.fixed.summary.horizonPending} / ${run.jitter.summary.horizonPending} (fixed / jitter). Jitter is not guaranteed to win.`;
  drawChart();drawTrace();
}
function execute(){
  try{const input={};for(const id of ['clients','capacity','attempts','seed','delay','jitter'])input[id]=Number($(id).value);input.deduplicate=$('deduplicate').checked;input.scenario=$('scenario').value;run=compare(input);$('error').textContent='';$('dirty').textContent='';render();}
  catch(e){$('error').textContent=e.message;}
}
$('settings').onsubmit=e=>{e.preventDefault();execute();};
$('settings').oninput=()=>{$('dirty').textContent='Settings changed. Run comparison to update the results and export.';};
$('policy').onchange=drawTrace;
window.addEventListener('resize',()=>{if(run)drawChart();});
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(run,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='retrygarden-trace.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
execute();
