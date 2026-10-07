import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {readdir,readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('production Worker renders public HTML in the Cloudflare runtime', async () => {
 const config=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));
 const runtime=new Miniflare(convertV4MiniflareOptions({
  modules:(await readdir('dist/server',{recursive:true})).filter(f=>f.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b)).map(f=>({type:'ESModule',path:path.resolve('dist/server',f)})),
  modulesRoot:path.resolve('dist/server'),
  compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,
  d1Databases:['DB'],r2Buckets:['BUCKET'],
  serviceBindings:{ASSETS:()=>new Response('Not found',{status:404})},
 }));
 try {
  const response=await runtime.dispatchFetch('http://localhost/om');
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type')??'',/^text\/html/);
  const html=await response.text();
  assert.match(html,/Noracre/);assert.match(html,/personvern/);
 } finally {await runtime.dispose();}
});
