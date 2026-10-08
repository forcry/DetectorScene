// Checks that every file referenced by index.html, sw.js and app.js exists.
import {readFileSync,existsSync} from 'node:fs';
const must=['index.html','styles.css','app.js','tracker.js','sw.js','manifest.webmanifest','icon.svg',
 'vendor/vision_bundle.mjs','vendor/wasm/vision_wasm_internal.js','vendor/wasm/vision_wasm_internal.wasm',
 'vendor/wasm/vision_wasm_nosimd_internal.js','vendor/wasm/vision_wasm_nosimd_internal.wasm','models/efficientdet_lite0.tflite'];
const sw=readFileSync('sw.js','utf8');let bad=0;
for(const f of must){const ok=existsSync(f),inSw=f==='sw.js'||sw.includes(`'${f}'`);
  if(!ok||!inSw){bad++;console.log('PROBLEM',f,ok?'':'(missing on disk)',inSw?'':'(not in sw precache)');}}
console.log(bad?`${bad} problem(s). Run: npm run fetch`:'All files present and precached.');process.exit(bad?1:0);
