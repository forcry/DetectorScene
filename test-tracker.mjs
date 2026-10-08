import {Tracker} from './tracker.js';import assert from 'node:assert';
const t=new Tracker();const d=(x,l='car')=>({box:[x,50,100,60],label:l,score:.9});
t.update([d(10),d(300)]);let o=t.update([d(14),d(305)]);
assert.equal(o.length,2);assert.deepEqual(o.map(x=>x.id),[1,2]);
for(let i=0;i<7;i++)o=t.update([d(310)]);               // first car lost, dropped
o=t.update([d(12),d(310)]);                              // reappears -> new id
assert.ok(o.every(x=>x.id>=1));assert.equal(t.counters.car,3);
t.update([d(10,'person')]);assert.equal(t.counters.person,1);console.log('tracker ok');
// ---- motion state + distance ----
const run=(n,wf,cx=640)=>{const tr=new Tracker(),hist=[];
  for(let i=0;i<n;i++){const w=wf(i);
    const o=tr.update([{box:[cx-w/2,300,w,w*0.6],label:'car',score:.9}],i*100,1280,720);hist.push(o[0]&&{...o[0]});}
  return hist.filter(Boolean);};
let h=run(30,i=>100*1.02**i);
assert.ok(h.slice(0,5).every(t=>t.state!=='APPROACHING'),'needs several measurements first');
assert.equal(h.at(-1).state,'APPROACHING');
h=run(30,i=>300*0.98**i);assert.equal(h.at(-1).state,'MOVING AWAY');
h=run(40,()=>600);assert.equal(h.at(-1).state,'STABLE');assert.equal(h.at(-1).dist,'NEAR');   // large != approaching
h=run(60,i=>100*(1+(i%2?0.03:-0.03)));assert.ok(h.every(t=>t.state==='STABLE'),'jitter must not flicker');
h=run(10,()=>40);assert.equal(h.at(-1).dist,'FAR');
// hysteresis: once APPROACHING, a brief pause shorter than confirm does not flip it
const tr=new Tracker();let last,ii=0;const step=w=>tr.update([{box:[640-w/2,300,w,w*.6],label:'car',score:.9}],ii++*100,1280,720)[0];
for(let k=0;k<30;k++)last=step(100*1.02**k);assert.equal(last.state,'APPROACHING');
const w0=100*1.02**29;for(let k=0;k<2;k++)last=step(w0);assert.equal(last.state,'APPROACHING');
console.log('motion/distance ok');
