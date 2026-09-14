import {and,eq,sql} from 'drizzle-orm';
import {getDb} from '@/db';
import {companies,contacts,activities,dataImports} from '@/db/schema';
import {AccessError,accessResponse,requireTenant} from '@/lib/tenant';
import {actorRef} from '@/lib/actor-names';
import {fieldsForMode,importRowProblem,contactImportName,importDate,type ImportMode,type ImportRow} from '@/lib/data-import';

const id=()=>{const a=crypto.getRandomValues(new Uint32Array(2));return (a[0]&0xffff)*4294967296+a[1];};
export async function POST(request:Request){try{
 const ctx=await requireTenant(request),data=await request.json() as {mode:ImportMode;source:string;requestId:string;rows:ImportRow[]};
 if(!['customers','contacts','activities'].includes(data.mode)||!Array.isArray(data.rows)||!data.rows.length||data.rows.length>50)throw new AccessError(400,'Velg en gyldig import med 1–50 rader per del.');
 if(!/^[a-zA-Z0-9-]{20,100}$/.test(data.requestId??''))throw new AccessError(400,'Importreferanse mangler.');
 const source=String(data.source??'Import').trim().slice(0,100)||'Import',db=getDb(),now=new Date().toISOString();
 const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({mode:data.mode,source,rows:data.rows}))))).map(n=>n.toString(16).padStart(2,'0')).join('');
 const batchId=`${ctx.organizationId}:${data.requestId}`;
 const prior=await db.select().from(dataImports).where(eq(dataImports.id,batchId)).limit(1);
 if(prior.length){if(prior[0].fingerprint!==fingerprint)throw new AccessError(409,'Importreferansen er allerede brukt til andre data.');return Response.json(JSON.parse(prior[0].result));}
 const rows=data.rows.map((row,index)=>{if(!row||typeof row!=='object')throw new AccessError(400,`Rad ${index+1} er ugyldig.`);const clean:ImportRow={};for(const field of fieldsForMode(data.mode)){const value=String(row[field.key]??'').trim();if(value.length>(field.key==='note'?20000:500))throw new AccessError(400,`Rad ${index+1}: feltet ${field.label} er for langt.`);clean[field.key]=value;}
  const problem=importRowProblem(clean,data.mode);if(problem)throw new AccessError(400,`Rad ${index+1}: ${problem}.`);
  for(const email of [clean.email,clean.contactEmail])if(email&&!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email))throw new AccessError(400,`Rad ${index+1}: ugyldig e-postadresse.`);
  try{clean.createdAt=importDate(clean.createdAt);clean.dueAt=importDate(clean.dueAt);}catch(e){throw new AccessError(400,`Rad ${index+1}: ${(e as Error).message}`);}return clean;
 });
 const known=await db.select().from(companies).where(eq(companies.organizationId,ctx.organizationId));
 const people=await db.select().from(contacts).where(eq(contacts.organizationId,ctx.organizationId));
 const history=await db.select().from(activities).where(eq(activities.organizationId,ctx.organizationId));
 const statements: any[]=[];const result={customers:0,contacts:0,activities:0,skipped:0,processed:rows.length};const followups=new Set<number>();
 for(const [index,row] of rows.entries()){
  const orgNumber=(row.orgNumber??'').replace(/\D/g,''),reference=row.companyReference?.toLowerCase();
  let matches=known.filter(company=>data.mode==='customers'?(orgNumber?company.orgNumber.replace(/\D/g,'')===orgNumber:row.externalId?company.importSource===source&&company.importId===row.externalId:company.name.toLowerCase()===row.name!.toLowerCase()):company.name.toLowerCase()===reference||(company.orgNumber&&company.orgNumber.replace(/\D/g,'')===reference?.replace(/\s/g,''))||(company.importSource===source&&company.importId&&company.importId.toLowerCase()===reference));
  if(matches.length>1)throw new AccessError(400,`Rad ${index+1}: Flere kunder passer. Bruk organisasjonsnummer eller kunde-ID.`);
  let company=matches[0];let changed=false;
  if(!company&&data.mode!=='customers')throw new AccessError(400,`Rad ${index+1}: Fant ikke bedriften «${row.companyReference}». Importer bedriftene først og bruk samme kilde for kunde-ID.`);
  if(!company){const record={id:id(),organizationId:ctx.organizationId,name:row.name!,orgNumber,phone:row.phone??'',email:row.email??'',contactName:'',city:row.city??'',industry:row.industry??'',note:row.note??'',stage:row.stage||'Ny kunde',source,importSource:source,importId:row.externalId??'',assignedTo:actorRef(ctx.user),createdAt:now,updatedAt:now};statements.push(db.insert(companies).values(record));company=record as typeof known[number];known.push(company);result.customers++;changed=true;}
  if(data.mode==='customers'&&row.externalId&&!company.importId){statements.push(db.update(companies).set({importId:row.externalId,importSource:source}).where(and(eq(companies.id,company.id),eq(companies.organizationId,ctx.organizationId))));company.importId=row.externalId;company.importSource=source;}
  const personName=contactImportName(row);
  if(personName&&data.mode!=='activities'){
   const duplicate=people.some(person=>person.companyId===company.id&&(row.contactEmail?person.email.toLowerCase()===row.contactEmail.toLowerCase():person.name.toLowerCase()===personName.toLowerCase()&&person.phone===(row.contactPhone??'')));
   if(!duplicate){const person={id:id(),organizationId:ctx.organizationId,companyId:company.id,name:personName,title:row.contactTitle??'',phone:row.contactPhone??'',email:row.contactEmail??'',isPrimary:!people.some(p=>p.companyId===company.id),createdAt:now};statements.push(db.insert(contacts).values(person));people.push(person);result.contacts++;changed=true;}
  }
  if(data.mode==='activities'||row.dueAt){
   const note=data.mode==='activities'?row.note!:'Følg opp',dueAt=row.dueAt??'',createdAt=row.createdAt||now,kind=row.kind||'Annet';
   const duplicate=history.some(a=>a.companyId===company.id&&a.note===note&&a.dueAt===dueAt&&a.kind===kind&&(dueAt||a.createdAt===createdAt));
   if(!duplicate){const activity={id:id(),organizationId:ctx.organizationId,companyId:company.id,companyName:company.name,contactId:null,note,dueAt,kind,createdAt,completedAt:dueAt?'':createdAt,createdBy:actorRef(ctx.user),reminderMinutes:'[15]'};statements.push(db.insert(activities).values(activity));history.push(activity);result.activities++;changed=true;if(dueAt)followups.add(company.id);}
  }
  if(!changed)result.skipped++;
 }
 for(const companyId of followups)statements.push(db.update(companies).set({
 nextAction:sql`COALESCE((SELECT note FROM activities WHERE organization_id=${ctx.organizationId} AND company_id=${companyId} AND completed_at='' AND due_at<>'' ORDER BY due_at,id LIMIT 1),'')`,
 nextActionDate:sql`COALESCE((SELECT due_at FROM activities WHERE organization_id=${ctx.organizationId} AND company_id=${companyId} AND completed_at='' AND due_at<>'' ORDER BY due_at,id LIMIT 1),'')`,
 nextContactId:sql`(SELECT contact_id FROM activities WHERE organization_id=${ctx.organizationId} AND company_id=${companyId} AND completed_at='' AND due_at<>'' ORDER BY due_at,id LIMIT 1)`,
 }).where(and(eq(companies.id,companyId),eq(companies.organizationId,ctx.organizationId))));
 // Cache each completed part in the same transaction, so retrying after a timeout is safe.
 try{await db.batch([db.insert(dataImports).values({id:batchId,organizationId:ctx.organizationId,fingerprint,result:JSON.stringify(result),createdAt:now}),...statements]);}catch(e){const [saved]=await db.select().from(dataImports).where(eq(dataImports.id,batchId));if(saved?.fingerprint===fingerprint)return Response.json(JSON.parse(saved.result));throw e;}

 return Response.json(result,{status:201});
}catch(e){return accessResponse(e)}}
