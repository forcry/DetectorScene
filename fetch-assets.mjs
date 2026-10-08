// One-time: downloads the MediaPipe runtime and COCO model into ./vendor and ./models. Needs Node 18+.
import {mkdir,writeFile} from 'node:fs/promises';import {dirname} from 'node:path';
const V='0.10.14',CDN=`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${V}/`;
const files=[['vision_bundle.mjs','vendor/vision_bundle.mjs'],
 ...['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm'].map(f=>['wasm/'+f,'vendor/wasm/'+f])]
 .map(([s,d])=>[CDN+s,d]);
files.push(['https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite','models/efficientdet_lite0.tflite']);
for(const [url,dest] of files){
  const r=await fetch(url);if(!r.ok)throw new Error(`${r.status} ${url}`);
  await mkdir(dirname(dest),{recursive:true});await writeFile(dest,Buffer.from(await r.arrayBuffer()));console.log('ok',dest);
}
