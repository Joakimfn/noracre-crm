import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {act,create} from 'react-test-renderer';
import {build} from 'esbuild';
import {writeFile,unlink} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
const output=new URL('./.profile-autosave-test.mjs',import.meta.url);
const built=await build({entryPoints:['hooks/use-autosave.ts'],bundle:true,platform:'node',format:'esm',packages:'external',write:false});
await writeFile(output,built.outputFiles[0].text);
const {useAutosave}=await import(output.href);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.window=new EventTarget();
let api,root;
function Harness(props){api=useAutosave({...props,delay:10});return null;}
const render=async props=>act(async()=>{if(root)root.update(React.createElement(Harness,props));else root=create(React.createElement(Harness,props));});
const tick=()=>act(()=>sleep(35));
const dispose=async()=>{if(root)await act(()=>root.unmount());root=null;};

test('loaded baseline is not saved; rapid edits collapse into one write',async()=>{
 const writes=[],save=async v=>{writes.push(v);};
 await render({value:'initial',enabled:false,save});
 await act(()=>api.reset('loaded'));
 await render({value:'loaded',enabled:true,save});await tick();assert.deepEqual(writes,[]);
 await render({value:'a',enabled:true,save});await render({value:'ab',enabled:true,save});
 await tick();assert.deepEqual(writes,['ab']);assert.equal(api.state,'saved');await dispose();
});
test('writes are serialized and edits made during a request are saved afterwards',async()=>{
 const writes=[];let release;
 const save=async v=>{writes.push(v);if(v==='first')await new Promise(r=>release=r);};
 await render({value:'initial',enabled:true,save});
 await render({value:'first',enabled:true,save});await tick();
 await render({value:'second',enabled:true,save});await tick();assert.deepEqual(writes,['first']);
 await act(async()=>{release();await sleep(1);});await tick();
 assert.deepEqual(writes,['first','second']);assert.equal(api.state,'saved');await dispose();
});
test('failure is shown without automatic retry loops and explicit retry preserves edits',async()=>{
 let fails=true;const writes=[];const save=async v=>{writes.push(v);if(fails)throw Error('offline');};
 await render({value:'initial',enabled:true,save});await render({value:'edited',enabled:true,save});
 await tick();assert.equal(api.state,'error');await tick();assert.deepEqual(writes,['edited']);
 fails=false;await act(()=>api.retry());await tick();assert.deepEqual(writes,['edited','edited']);assert.equal(api.state,'saved');await dispose();
});
test('edits wait while image cropping is active and resume once finished',async()=>{
 const writes=[],save=async v=>{writes.push(v);};
 await render({value:'initial',enabled:true,save});await render({value:'crop',enabled:false,save});
 await tick();assert.deepEqual(writes,[]);await render({value:'crop',enabled:true,save});await tick();assert.deepEqual(writes,['crop']);await dispose();
});
test.after(async()=>{await dispose();await unlink(output);delete globalThis.window;});
