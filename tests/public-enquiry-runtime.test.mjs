import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {MockAgent} from 'undici';
import path from 'node:path';

test('public form sends successfully in the actual Workers runtime with D1',async()=>{
 const output=await build({stdin:{contents:"import {publicEnquiry} from './lib/public-enquiries';export default {fetch:publicEnquiry};",resolveDir:path.resolve(import.meta.dirname,'..')},bundle:true,write:false,format:'esm',platform:'browser'});
 const mock=new MockAgent();mock.disableNetConnect();
 mock.get('https://api.resend.com').intercept({path:'/emails',method:'POST'}).reply(200,{id:'test-only'});
 const mf=new Miniflare({modules:true,script:output.outputFiles[0].text,d1Databases:['DB'],bindings:{RESEND_API_KEY:'test-only'},fetchMock:mock});
 try{
  const body=JSON.stringify({requestId:crypto.randomUUID(),type:'customer',company:'Runtime test',name:'Test',email:'test@example.test',users:'1–5'});
  const options={method:'POST',headers:{origin:'https://noracre.no','content-type':'application/json','cf-connecting-ip':'203.0.113.1'},body};
  const response=await mf.dispatchFetch('https://noracre.no/api/public/enquiry',options);
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{sent:true});
  // No second provider interception exists: a duplicate must succeed without another send.
  assert.equal((await mf.dispatchFetch('https://noracre.no/api/public/enquiry',options)).status,200);
 }finally{await mf.dispose();await mock.close();}
});
