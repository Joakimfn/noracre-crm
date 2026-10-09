import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Resolve bundled React from this repository instead of /tmp.
const dir=await mkdtemp(path.join(root,'.noracre-numbers-test-'));
await build({
 entryPoints:[path.join(root,'components/normalized-number-input.tsx')],
 bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'number.mjs'),
 plugins:[{name:'stub',setup(b){
  b.onResolve({filter:/^@\/components\/ui\/input$/},()=>({path:'input',namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const Input=()=>null'}));
 }}]
});
const {normalizeIntegerInput}=await import(pathToFileURL(path.join(dir,'number.mjs')));
after(()=>rm(dir,{recursive:true,force:true}));

test('Typing single-digit numbers never leaves leading zeros',()=>{
 for(const [input,expected] of [['07','7'],['001','1'],['000','0'],['10','10'],['0','0'],['',''],['0.7','0.7'],['-07','-7']]){
  assert.equal(normalizeIntegerInput(input),expected);
 }
});
test('The standard number input also normalizes numbers without altering identifiers or time strings',()=>{
 const source=readFileSync(path.join(root,'components/ui/input.tsx'),'utf8');
 assert.match(source,/if \(type === "number"\)/);
 assert.match(source,/oldValue\.replace/);
 assert.match(source,/onChange\?\.\(event\)/);
});
