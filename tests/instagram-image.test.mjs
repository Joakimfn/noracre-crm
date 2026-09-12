import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(tmpdir(),'instagram-image-'));
await build({entryPoints:['lib/instagram-image.ts'],bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'image.mjs')});
const {instagramLayout}=await import(path.join(dir,'image.mjs'));
test('120px square logo becomes 320px square with its proportions intact',()=>{
 assert.deepEqual(instagramLayout(120,120),{width:320,height:320,x:0,y:0,drawWidth:320,drawHeight:320});
});
test('wide, tall, small and large images all fit without cropping or distortion',()=>{
 for(const width of [1,119,320,321,500,1080,1440,3000])for(const height of [1,120,300,401,1000,4000]){
  const r=instagramLayout(width,height);assert.ok(r.width>=320&&r.width<=1440);assert.ok(r.width/r.height>=.8&&r.width/r.height<=1.91);
  assert.ok(r.x>=0&&r.y>=0);assert.ok(r.drawWidth<=r.width+1e-9&&r.drawHeight<=r.height+1e-9);
  assert.ok(Math.abs(r.drawWidth/r.drawHeight-width/height)<1e-8);
 }
});
test('carousel images use a common frame ratio and invalid dimensions fail',()=>{
 const r=instagramLayout(900,1200,1);assert.equal(r.width,r.height);assert.ok(r.x>0);assert.equal(r.y,0);
 for(const [w,h] of [[0,10],[NaN,10],[10,Infinity]])assert.throws(()=>instagramLayout(w,h));
});
process.on('exit',()=>rm(dir,{recursive:true,force:true}));
