// Per-class greedy IoU tracker + temporal motion state + relative-distance category.
// Boxes are [x,y,w,h]. IDs are per class (CAR #4). All thresholds live in DEFAULTS and are tunable in Settings.
export const DEFAULTS={
  approachRate:0.2,   // log-area growth per second needed to START approaching / moving away (0.2 ~ +22% area/s)
  exitRate:0.08,      // must fall back inside this band to return to STABLE (hysteresis)
  confirm:4,          // consecutive measurements agreeing before a state change
  cooldownMs:800,     // minimum time between state changes of one track
  window:6,           // measurements used for the least-squares area trend
  distance:true,      // show the FAR/MID/NEAR estimate
  farBelow:0.01,      // box area / frame area below this => FAR
  nearAbove:0.08      // above this => NEAR
};
const KEYS=Object.keys(DEFAULTS);
export const iou=(a,b)=>{
  const x1=Math.max(a[0],b[0]),y1=Math.max(a[1],b[1]);
  const x2=Math.min(a[0]+a[2],b[0]+b[2]),y2=Math.min(a[1]+a[3],b[1]+b[3]);
  const i=Math.max(0,x2-x1)*Math.max(0,y2-y1),u=a[2]*a[3]+b[2]*b[3]-i;
  return u>0?i/u:0;
};
export class Tracker{
  constructor(o={}){
    this.iouMin=o.iouMin??0.3;this.maxMiss=o.maxMiss??5;this.minHits=o.minHits??2;this.smooth=o.smooth??0.6;
    this.cfg={...DEFAULTS};this.setConfig(o);this.reset();
  }
  setConfig(o){
    for(const k of KEYS)if(o[k]!==undefined)this.cfg[k]=o[k];
    const c=this.cfg;if(c.nearAbove<=c.farBelow)c.nearAbove=c.farBelow*2;
  }
  reset(){this.tracks=[];this.counters={};}
  update(dets,now=0,W=0,H=0){
    const pairs=[];
    this.tracks.forEach((t,i)=>dets.forEach((d,j)=>{
      if(t.label!==d.label)return;const v=iou(t.box,d.box);if(v>=this.iouMin)pairs.push([v,i,j]);}));
    pairs.sort((a,b)=>b[0]-a[0]);
    const ut=new Set(),ud=new Set();
    for(const[,i,j]of pairs){
      if(ut.has(i)||ud.has(j))continue;ut.add(i);ud.add(j);
      const t=this.tracks[i],d=dets[j],s=this.smooth;
      t.box=t.box.map((v,k)=>v+s*(d.box[k]-v));t.score=d.score;t.hits++;t.miss=0;
      this._motion(t,d.box,now,W,H);   // motion uses the RAW detection box, not the smoothed one
    }
    this.tracks.forEach((t,i)=>{if(!ut.has(i))t.miss++;});
    dets.forEach((d,j)=>{if(ud.has(j))return;
      const id=this.counters[d.label]=(this.counters[d.label]||0)+1;
      const t={id,label:d.label,box:d.box.slice(),score:d.score,hits:1,miss:0,
        samples:[],rate:0,state:'STABLE',ready:false,cand:null,candN:0,lastChange:now,area:0,frac:0,dArea:0,prevA:0,dist:null,ef:undefined};
      this.tracks.push(t);this._motion(t,d.box,now,W,H);});
    this.tracks=this.tracks.filter(t=>t.miss<=this.maxMiss);
    return this.tracks.filter(t=>t.hits>=this.minHits&&t.miss<=1);
  }
  _motion(t,b,now,W,H){
    if(!W||!H)return;
    const c=this.cfg,a=b[2]*b[3],f=a/(W*H);
    t.area=a;t.frac=f;
    // relative distance: smoothed frame-area fraction with 10% hysteresis. Size only; NOT physical distance.
    t.ef=t.ef===undefined?f:t.ef+0.3*(f-t.ef);
    const m=1.1,fb=c.farBelow,nb=c.nearAbove;let d=t.dist;
    if(!d)d=t.ef<fb?'FAR':t.ef>nb?'NEAR':'MID';
    else if(d==='FAR'){if(t.ef>fb*m)d='MID';}
    else if(d==='MID'){if(t.ef<fb/m)d='FAR';else if(t.ef>nb*m)d='NEAR';}
    else if(t.ef<nb/m)d='MID';
    t.dist=d;
    // boxes clipped by the frame edge have untrustworthy area: skip the motion measurement
    if(b[0]<=2||b[1]<=2||b[0]+b[2]>=W-2||b[1]+b[3]>=H-2)return;
    t.dArea=t.prevA?(a-t.prevA)/t.prevA:0;t.prevA=a;
    const s=t.samples,ts=now/1000;
    if(s.length&&ts-s[s.length-1][0]>1.5){s.length=0;t.ready=false;}
    s.push([ts,Math.log(Math.max(a,1))]);if(s.length>c.window)s.shift();
    if(s.length<Math.min(4,c.window))return;
    // least-squares slope of log(area) vs time = relative growth rate (scale-free: big objects are not special)
    const n=s.length;let mt=0,ml=0;for(const[p,q]of s){mt+=p;ml+=q;}mt/=n;ml/=n;
    let num=0,den=0;for(const[p,q]of s){num+=(p-mt)*(q-ml);den+=(p-mt)**2;}
    t.rate=den>1e-9?num/den:0;t.ready=true;
    const r=t.rate,st=t.state;let cand;
    if(st==='STABLE')cand=r>c.approachRate?'APPROACHING':r<-c.approachRate?'MOVING AWAY':'STABLE';
    else if(st==='APPROACHING')cand=r<c.exitRate?'STABLE':st;
    else cand=r>-c.exitRate?'STABLE':st;
    if(cand===st){t.candN=0;t.cand=null;return;}
    t.candN=(t.cand===cand?t.candN:0)+1;t.cand=cand;
    if(t.candN>=c.confirm&&now-t.lastChange>=c.cooldownMs){t.state=cand;t.lastChange=now;t.candN=0;t.cand=null;}
  }
}
