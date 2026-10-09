import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(path.join(tmpdir(),'noracre-prospect-import-'));
await build({entryPoints:[new URL('../lib/prospect-import.ts',import.meta.url).pathname],platform:'node',format:'esm',bundle:true,outfile:path.join(dir,'import.mjs')});
const {mapProspectRows,mapHeadcountRows}=await import(pathToFileURL(path.join(dir,'import.mjs')));
after(()=>rm(dir,{recursive:true,force:true}));

test('free company and supplier CSV exports map name, sector and province without invented registration IDs',()=>{
 const rows=mapProspectRows([
  {'company_number':'SC000007','company_name':'Glasgow Industries','employees_total':'7','city':'Glasgow','sic':'6201'},
  {'supplier_name':'Zambezi Engineering','sector':'Construction','province':'Lusaka','award_id':'award-42'},
 ]);
 assert.equal(rows.length,2);
 assert.deepEqual(rows[0],{name:'Glasgow Industries',orgNumber:'SC000007',industry:'6201',city:'Glasgow',employees:7,phone:'',email:'',website:''});
 assert.equal(rows[1].name,'Zambezi Engineering');assert.equal(rows[1].industry,'Construction');
 assert.equal(rows[1].city,'Lusaka');assert.equal(rows[1].orgNumber,'');
});
test('unknown staff stays unknown, zero stays numeric zero, bogus values cannot become valid staff counts',()=>{
 const rows=mapProspectRows([
  {'company_name':'Unknown UK','employees':''},
  {'company_name':'Zero UK','employees':'0'},
  {'company_name':'Not count','employees':'approx 18'},
  {'company_name':'Negative','employees':'-1'},
  {'company_name':'Float','employees':'3.5'},
  {'company_name':'Huge','employees':'1000001'},
 ]);
 assert.deepEqual(rows.map(r=>r.employees),[null,0,null,null,null,null]);
});
test('headcount updates need an actual company number, never join on fuzzy supplier names or award identifiers',()=>{
 const rows=mapHeadcountRows([
  {'Company Number':'12345678','Employees':'19'},
  {'company_number':'SC000007','number_of_employees':'12'},
  {'company_number':'SC000007','number_of_employees':'13'},
  {'supplier_name':'Fake Inc','supplier_id':'00042','employees':'20'},
  {'Company Number':'BE000002','Employees':'unavailable'},
 ]);
 assert.deepEqual(rows,[{orgNumber:'12345678',employees:19},{orgNumber:'SC000007',employees:13}]);
});
