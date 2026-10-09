import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const route=readFileSync(path.join(root,'app/api/call-lists/route.ts'),'utf8');
const source=ts.createSourceFile('route.ts',route,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);

function findValuesObject(node){
 if(ts.isFunctionDeclaration(node)&&node.name?.text==='values'){
  const statement=node.body?.statements.find(ts.isReturnStatement);
  if(statement?.expression&&ts.isObjectLiteralExpression(statement.expression))return statement.expression;
 }
 return ts.forEachChild(node,findValuesObject);
}

test('importing 5 or more prospects stays below the D1 100-bound-parameter limit',()=>{
 const valuesObject=findValuesObject(source);
 assert.ok(valuesObject,'values() must return a row object');
 const rowFields=valuesObject.properties.length+2; // listId + country added in insertListRows
 const match=route.match(/const rowsPerInsert=(\d+);/);
 assert.ok(match,'explicit D1-safe batch size required');
 const batchSize=Number(match[1]);
 assert.ok(batchSize>=1);
 assert.ok(rowFields*batchSize<=100,`D1 supports at most 100 bind parameters, got ${rowFields*batchSize}`);
 assert.equal(rowFields,21,'update this test if insert column count changes');
 assert.ok(route.includes('i+=rowsPerInsert'));
 assert.ok(route.includes('rows.slice(i,i+rowsPerInsert)'));
});
