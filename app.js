import {Tracker,DEFAULTS} from './tracker.js';
const $=id=>document.getElementById(id);
const DEF={threshold:0.45,interval:100,labels:true,delegate:'GPU',facing:'environment',...DEFAULTS,debug:false};
const S={...DEF};
try{Object.assign(S,JSON.parse(localStorage.getItem('sd.settings')||'{}'));}catch{}
const save=()=>{try{localStorage.setItem('sd.settings',JSON.stringify(S));}catch{}};
const view=$('view'),ctx=view.getContext('2d'),cam=$('cam'),tracker=new Tracker(S);
let det,stream,tracks=[],ms=0,dfps=0,lastInf=0,lastTs=0,rec,chunks=[],recT0=0,err='';

async function loadModel(){
  const {FilesetResolver,ObjectDetector}=await import('./vendor/vision_bundle.mjs');
  const fs=await FilesetResolver.forVisionTasks('./vendor/wasm');
  const mk=d=>ObjectDetector.createFromOptions(fs,{baseOptions:{modelAssetPath:'./models/efficientdet_lite0.tflite',delegate:d},
    runningMode:'VIDEO',scoreThreshold:S.threshold,maxResults:20});
  try{det=await mk(S.delegate);}catch(e){console.warn('delegate failed',e);det=await mk('CPU');S.delegate='CPU';save();$('delegate').value='CPU';}
}
async function startCam(){
  stream?.getTracks().forEach(t=>t.stop());
  stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:S.facing},width:{ideal:1280},height:{ideal:720}}});
  cam.srcObject=stream;await cam.play();tracker.reset();tracks=[];
}
const zone=b=>{const c=(b[0]+b[2]/2)/view.width;return c<1/3?'LEFT':c>2/3?'RIGHT':'CENTER';};
function dbg(t,x,y,w,h,fs){
  const L=`A ${Math.round(t.area)} dA ${(t.dArea*100).toFixed(1)}% score ${t.rate.toFixed(2)}/s ${t.dist||'-'} ${Math.round(t.score*100)}% id${t.id}`;
  ctx.font=`${Math.round(fs*0.8)}px monospace`;const yy=Math.min(y+h,view.height-fs-2);
  ctx.fillStyle='#000c';ctx.fillRect(x,yy,ctx.measureText(L).width+8,fs);
  ctx.fillStyle='#ff0';ctx.textBaseline='top';ctx.fillText(L,x+4,yy+2);ctx.font=`bold ${fs}px sans-serif`;
}
function draw(){
  const fs=Math.max(14,Math.round(view.width/45));ctx.font=`bold ${fs}px sans-serif`;ctx.lineWidth=Math.max(2,fs/6);
  for(const t of tracks){
    const [x,y,w,h]=t.box;ctx.strokeStyle='#4caf50';ctx.strokeRect(x,y,w,h);
    if(S.debug)dbg(t,x,y,w,h,fs);
    if(!S.labels)continue;
    const parts=[t.label.toUpperCase()+' #'+t.id,zone(t.box)];
    if(S.distance&&t.dist)parts.push('~'+t.dist);   // '~' = size-based estimate
    if(t.ready)parts.push(t.state);
    const txt=parts.join(' ');
    const tw=ctx.measureText(txt).width+8,ty=Math.max(0,y-fs-6);
    ctx.fillStyle='#000c';ctx.fillRect(x,ty,tw,fs+6);ctx.fillStyle='#fff';ctx.textBaseline='top';ctx.fillText(txt,x+4,ty+3);
  }
}
function loop(t){
  requestAnimationFrame(loop);
  if(cam.readyState<2)return;
  if(view.width!==cam.videoWidth||view.height!==cam.videoHeight){view.width=cam.videoWidth;view.height=cam.videoHeight;}
  ctx.drawImage(cam,0,0);
  if(det&&t-lastInf>=S.interval){
    const t0=Math.max(performance.now(),lastTs+1);lastTs=t0;
    try{
      const r=det.detectForVideo(cam,t0);
      tracks=tracker.update(r.detections.filter(d=>d.categories[0]).map(d=>({
        box:[d.boundingBox.originX,d.boundingBox.originY,d.boundingBox.width,d.boundingBox.height],
        label:d.categories[0].categoryName,score:d.categories[0].score})),t0,view.width,view.height);err='';
    }catch(e){err='detect error';console.error(e);}
    ms=performance.now()-t0;dfps=0.8*dfps+0.2*(1000/Math.max(1,t-lastInf));lastInf=t;
  }
  draw();
  const r=rec?` · REC ${Math.floor((Date.now()-recT0)/1000)}s`:'';
  $('stat').textContent=`${dfps.toFixed(0)} det/s · ${ms.toFixed(0)} ms · ${S.delegate} · ${tracks.length} obj${r}${err?' · '+err:''}`;
}
function toggleRec(){
  if(rec){rec.stop();return;}
  if(!window.MediaRecorder){alert('Recording is not supported in this browser.');return;}
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(m=>MediaRecorder.isTypeSupported(m));
  rec=new MediaRecorder(view.captureStream(30),mime?{mimeType:mime,videoBitsPerSecond:4e6}:undefined);chunks=[];
  rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  rec.onstop=()=>{const type=rec.mimeType||'video/webm',b=new Blob(chunks,{type});
    const a=document.createElement('a');a.href=URL.createObjectURL(b);
    a.download=`detect-${new Date().toISOString().replace(/[:.]/g,'-')}.${type.includes('mp4')?'mp4':'webm'}`;
    a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);rec=null;$('rec').classList.remove('on');$('rec').textContent='● REC';};
  rec.start(1000);recT0=Date.now();$('rec').classList.add('on');$('rec').textContent='■ STOP';
}
function explain(e){
  if(!window.isSecureContext)return 'Camera needs HTTPS (or localhost).';
  if(e?.name==='NotAllowedError')return 'Camera permission denied. Allow it in site settings.';
  if(e?.name==='NotFoundError')return 'No camera found.';
  return 'Failed: '+(e?.message||e)+' (run npm run fetch if model files are missing)';
}
// settings UI
const bind=(id,key,fn)=>{const el=$(id),isC=el.type==='checkbox';
  isC?el.checked=S[key]:el.value=S[key];
  el.addEventListener('input',()=>{S[key]=isC?el.checked:el.type==='range'?+el.value:el.value;save();fn?.();upd();});};
const upd=()=>{$('o1').textContent=Math.round(S.threshold*100)+'%';$('o2').textContent=S.interval;};
bind('threshold','threshold',()=>det?.setOptions({scoreThreshold:S.threshold}));
bind('interval','interval');bind('labels','labels');
bind('delegate','delegate',async()=>{try{$('stat').textContent='Reloading model…';await loadModel();}catch(e){err='model reload failed';}});
upd();
// motion / distance tuning controls (built from a spec so thresholds are easy to add)
const MCTL=[['approachRate','Approach threshold (area growth /s)',.05,.6,.01],['exitRate','Return-to-stable threshold',.01,.3,.01],
 ['confirm','Confirmations needed',2,12,1],['cooldownMs','State cooldown (ms)',0,3000,100],
 ['farBelow','FAR below (frame-area fraction)',.002,.05,.002],['nearAbove','NEAR above (frame-area fraction)',.03,.3,.01]];
for(const[k,txt,min,max,step]of MCTL){
  const l=document.createElement('label'),o=document.createElement('output'),i=document.createElement('input');
  Object.assign(i,{type:'range',min,max,step,value:S[k]});o.textContent=S[k];l.append(txt+' ',o,i);$('motion').append(l);
  i.addEventListener('input',()=>{S[k]=+i.value;o.textContent=S[k];save();tracker.setConfig(S);});
}
bind('distance','distance');bind('debug','debug');
$('cfg').onclick=()=>$('dlg').showModal();
$('rec').onclick=toggleRec;
$('flip').onclick=async()=>{if(rec)return;S.facing=S.facing==='environment'?'user':'environment';save();
  try{await startCam();}catch(e){err='camera switch failed';}};
$('go').onclick=async()=>{
  $('go').disabled=true;
  try{$('msg').textContent='Loading model…';await loadModel();
    $('msg').textContent='Starting camera…';await startCam();
    $('start').hidden=true;$('stat').hidden=false;$('bar').hidden=false;requestAnimationFrame(loop);
  }catch(e){console.error(e);$('msg').textContent=explain(e);$('go').disabled=false;}
};
if('serviceWorker' in navigator&&!['localhost','127.0.0.1'].includes(location.hostname))
  navigator.serviceWorker.register('sw.js').catch(e=>console.warn('SW',e));
