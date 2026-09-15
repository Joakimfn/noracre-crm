import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {Response} from 'undici';
import path from 'node:path';

test('public form sends successfully in the actual Workers runtime with D1',async()=>{
 const output=await build({stdin:{contents:"import {publicEnquiry} from './lib/public-enquiries';export default {fetch:publicEnquiry};",resolveDir:path.resolve(import.meta.dirname,'..')},bundle:true,write:false,format:'esm',platform:'browser'});
 let sends=0;const outboundService=async request=>{assert.equal(request.url,'https://api.resend.com/emails');assert.equal(request.method,'POST');sends++;return Response.json({id:'test-only'});};
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:output.outputFiles[0].text,d1Databases:['DB'],bindings:{RESEND_API_KEY:'test-only'},outboundService}));
 try{
  const body=JSON.stringify({requestId:crypto.randomUUID(),type:'customer',company:'Runtime test',name:'Test',email:'test@example.test',users:'1–5'});
  const options={method:'POST',headers:{origin:'https://noracre.no','content-type':'application/json','cf-connecting-ip':'203.0.113.1'},body};
  const response=await mf.dispatchFetch('https://noracre.no/api/public/enquiry',options);
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{sent:true});
  assert.equal(sends,1);
  // The duplicate must succeed without invoking the simulated provider again.
  assert.equal((await mf.dispatchFetch('https://noracre.no/api/public/enquiry',options)).status,200);assert.equal(sends,1);
 }finally{await mf.dispose();}
});
