import {test,after} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm,readFile} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';import {DatabaseSync} from 'node:sqlite';
const dir=await mkdtemp(path.join(tmpdir(),'commission-'));after(()=>rm(dir,{recursive:true,force:true}));await build({stdin:{contents:"export * from './lib/commission-percentage';export * from './lib/partner-payments';",resolveDir:path.resolve('.')},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'module.mjs')});const {parseCommissionPercentage,paymentAmountOre,validatePaidOn,paymentCommission,paymentCommissionReport}=await import(pathToFileURL(path.join(dir,'module.mjs')));
test('percentages and paid amounts use exact bounded integer units',()=>{
 for(const [input,expected] of [['12,5',1250],['0',0],['100',10000],['0.01',1]])assert.equal(parseCommissionPercentage(input),expected);
 for(const input of ['',null,true,-1,101,'1e1','20.999','NaN'])assert.throws(()=>parseCommissionPercentage(input));
 assert.equal(paymentAmountOre('1 000,50'),100050);assert.equal(paymentCommission(100050,2500),25013);assert.equal(paymentCommission(12345,0),0);assert.equal(paymentCommission(12345,10000),12345);
 for(const input of ['0','-1','1.234','Infinity','10000000.01'])assert.throws(()=>paymentAmountOre(input));
});
test('payment dates use Norwegian calendar days and reject future or invalid days',()=>{
 const now=new Date('2026-09-20T22:30:00Z');assert.equal(validatePaidOn('2026-09-21',now),'2026-09-21');assert.throws(()=>validatePaidOn('2026-09-22',now));assert.throws(()=>validatePaidOn('2026-02-30',now));
});
test('invoice basis sums received payments by receipt month, retaining original percentages and excluding voids',()=>{
 const p={id:1,companyName:'Customer',reference:'ONE',paidOn:'2026-08-31',amountOre:100050,basisPoints:2500,commissionOre:25013,voidedAt:''};
 const r=paymentCommissionReport([p,{...p,id:2,reference:'TWO',basisPoints:1000,commissionOre:10005},{...p,id:3,voidedAt:'2026-09-01'},{...p,id:4,paidOn:'2026-09-01'}],new Date('2026-09-21'));
 assert.equal(r.previousMonth,'2026-08');const aug=r.months.find(m=>m.month==='2026-08');assert.equal(aug.commissionOre,35018);assert.equal(aug.amountOre,200100);assert.equal(aug.closed,true);assert.equal(r.months[0].closed,false);assert.equal(paymentCommissionReport([],new Date('2026-01-01')).previousMonth,'2025-12');
});
test('database migration protects stored rates and duplicate payments without inventing a commission',async()=>{
 const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE organizations(id INTEGER PRIMARY KEY,name TEXT,is_partner INTEGER,referred_by_partner_id INTEGER);INSERT INTO organizations VALUES(1,'Partner',1,NULL),(2,'Customer',0,1);");db.exec(await readFile('drizzle/0026_partner_commission.sql','utf8'));assert.equal(db.prepare('SELECT commission_bps FROM organizations WHERE id=1').get().commission_bps,null);db.exec('UPDATE organizations SET commission_bps=2500 WHERE id=1');
 const insert="INSERT INTO partner_payments(organization_id,partner_id,company_name,reference,reference_key,paid_on,amount_ore,basis_points,commission_ore,created_at,created_by) VALUES(2,1,'Customer','BANK','bank','2026-09-01',100050,2500,25013,'now','tester')";
 db.exec(insert);assert.throws(()=>db.exec(insert),/UNIQUE/);db.exec('UPDATE organizations SET commission_bps=3000 WHERE id=1');assert.equal(db.prepare('SELECT basis_points FROM partner_payments').get().basis_points,2500);assert.throws(()=>db.exec(insert.replaceAll("'BANK'","'NEXT'").replaceAll("'bank'","'next'")),/agreement changed/);assert.throws(()=>db.exec('UPDATE organizations SET commission_bps=10001 WHERE id=1'),/CHECK/);db.close();
});
