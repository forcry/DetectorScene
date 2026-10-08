// Bump VERSION on every deploy that changes any file below.
const VERSION='sd-v2';
const ASSETS=['./','index.html','styles.css','app.js','tracker.js','manifest.webmanifest','icon.svg',
 'vendor/vision_bundle.mjs','vendor/wasm/vision_wasm_internal.js','vendor/wasm/vision_wasm_internal.wasm',
 'vendor/wasm/vision_wasm_nosimd_internal.js','vendor/wasm/vision_wasm_nosimd_internal.wasm',
 'models/efficientdet_lite0.tflite'];
const abs=a=>new URL(a,self.registration.scope).href;
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(ASSETS.map(abs))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==VERSION).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request)));
});
