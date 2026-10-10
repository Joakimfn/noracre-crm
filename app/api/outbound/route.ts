import {and,desc,eq,gte,inArray,isNull,or,sql} from 'drizzle-orm';
import {getDb} from '@/db';
import {callListEntries,callListAssignments,memberships,moduleLicenses,organizations,outboundLeadState,outboundCallLogs,outboundDeals,outboundDealPayments,outboundCompanyOwnership,outboundSuppression} from '@/db/schema';
import {AccessError,accessResponse,requireTenant} from '@/lib/tenant';
import {accessibleLists,requireList} from '@/lib/saved-call-lists';
import {canManageModules,requireModuleAccess} from '@/lib/module-access';
import {normalizeRegistryId} from '@/lib/prospect-import';

const outcomes=['Ikke svar','Sentralbord','Feil nummer','Beslutningstaker kontaktet','Interessert','Ikke interessert','Møte booket','Reservert mot kontakt'] as const;
const stages=['Prospekt','Demo booket','Demo gjennomført','Prøveperiode','Tilbud','Kunde','Tapt'] as const;
const publicJson=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const integer=(v:unknown,min=0,max=100000000)=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const isoDate=(value:unknown)=>typeof value==='string'&&value.length<40&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';
const clean=(value:unknown,max=500)=>String(value??'').trim().slice(0,max);
const manager=(role:string)=>canManageModules(role);
type Context=Awaited<ReturnType<typeof requireTenant>>;
async function orgFor(ctx:Context){
 const [org]=await getDb().select().from(organizations).where(eq(organizations.id,ctx.organizationId)).limit(1);
 if(!org)throw new AccessError(404,'Bedriften finnes ikke.');
 return org;
}
async function entryFor(ctx:Context,entryId:unknown){
 if(!integer(entryId,1))throw new AccessError(400,'Velg en gyldig bedrift.');
 const [entry]=await getDb().select().from(callListEntries).where(and(eq(callListEntries.organizationId,ctx.organizationId),eq(callListEntries.id,Number(entryId)))).limit(1);
 if(!entry||!entry.listId)throw new AccessError(404,'Bedriften finnes ikke i en tilgjengelig ringeliste.');
 await requireList(ctx,entry.listId);
 return entry;
}
async function ensureOwner(ctx:Context,entry:typeof callListEntries.$inferSelect,requestedMemberId:number,canTransfer:boolean){
 const db=getDb(),now=new Date().toISOString(),orgNumber=normalizeRegistryId(entry.orgNumber,entry.country);
 if(orgNumber){
  const key=and(eq(outboundCompanyOwnership.organizationId,ctx.organizationId),eq(outboundCompanyOwnership.country,entry.country),eq(outboundCompanyOwnership.orgNumber,orgNumber));
  await db.insert(outboundCompanyOwnership).values({organizationId:ctx.organizationId,country:entry.country,orgNumber,assignedMembershipId:requestedMemberId,updatedAt:now}).onConflictDoNothing();
  const [owner]=await db.select().from(outboundCompanyOwnership).where(key).limit(1);
  if(owner?.assignedMembershipId!==requestedMemberId){
   if(!canTransfer)throw new AccessError(409,'Bedriften er allerede tildelt en annen selger i en ringeliste.');
   await db.update(outboundCompanyOwnership).set({assignedMembershipId:requestedMemberId,updatedAt:now}).where(key);
   // Keep any previously contacted copies in other lists assigned to the same person.
   const matching=db.select({id:callListEntries.id}).from(callListEntries).where(and(
    eq(callListEntries.organizationId,ctx.organizationId),eq(callListEntries.country,entry.country),
    eq(sql`UPPER(REPLACE(${callListEntries.orgNumber}, ' ', ''))`,orgNumber)
   ));
   await db.update(outboundLeadState).set({assignedMembershipId:requestedMemberId,updatedAt:now}).where(and(
    eq(outboundLeadState.organizationId,ctx.organizationId),inArray(outboundLeadState.entryId,matching)
   ));
  }
 }
 await db.insert(outboundLeadState).values({organizationId:ctx.organizationId,entryId:entry.id,assignedMembershipId:requestedMemberId,createdAt:now,updatedAt:now}).onConflictDoNothing();
 const [state]=await db.select().from(outboundLeadState).where(and(eq(outboundLeadState.organizationId,ctx.organizationId),eq(outboundLeadState.entryId,entry.id))).limit(1);
 if(!state)throw new AccessError(500,'Kunne ikke hente salgsoppfølgingen.');
 if(state.assignedMembershipId!==requestedMemberId){
  if(state.assignedMembershipId!==0&&!canTransfer)throw new AccessError(409,'Dette leadet er tildelt en annen selger.');
  await db.update(outboundLeadState).set({assignedMembershipId:requestedMemberId,updatedAt:now}).where(eq(outboundLeadState.id,state.id));
 }
 return {...state,assignedMembershipId:requestedMemberId};
}
async function activeSetup(ctx:Context){
 const org=await orgFor(ctx);
 if(!org.outboundEnabled)throw new AccessError(403,'Outbound er ikke aktivert for bedriften.');
 if(!manager(ctx.role))await requireModuleAccess(ctx.organizationId,ctx.membershipId,'ringelister');
 return org;
}
function readSettings(org:Awaited<ReturnType<typeof orgFor>>){
 return {enabled:org.outboundEnabled,currency:org.outboundCurrency,timezone:org.outboundTimezone,commissionBps:org.outboundCommissionBps,pitch:org.outboundPitch};
}
export async function GET(request:Request){
 try{
  const ctx=await requireTenant(request),db=getDb(),org=await orgFor(ctx),isManager=manager(ctx.role);
  const settings=readSettings(org);
  if(!org.outboundEnabled)return publicJson({settings,rows:[],metrics:null,deals:[],payments:[],members:[],hasMore:false});
  if(!isManager)await requireModuleAccess(ctx.organizationId,ctx.membershipId,'ringelister');
  const url=new URL(request.url),listId=url.searchParams.get('listId'),offset=Number(url.searchParams.get('offset')??0);
  if(!integer(offset,0,100000))throw new AccessError(400,'Ugyldig side.');
  const lists=await accessibleLists(ctx),allowed=lists.map(l=>l.id);
  if(listId)await requireList(ctx,listId);
  const scope=listId?inArray(callListEntries.listId,[Number(listId)]):inArray(callListEntries.listId,allowed.length?allowed:[-1]);
  const rows=await db.select({entry:callListEntries,state:outboundLeadState,companyOwner:outboundCompanyOwnership,suppressionId:outboundSuppression.id})
   .from(callListEntries)
   .leftJoin(outboundLeadState,and(eq(outboundLeadState.entryId,callListEntries.id),eq(outboundLeadState.organizationId,ctx.organizationId)))
   .leftJoin(outboundCompanyOwnership,and(eq(outboundCompanyOwnership.organizationId,ctx.organizationId),eq(outboundCompanyOwnership.country,callListEntries.country),eq(outboundCompanyOwnership.orgNumber,callListEntries.orgNumber)))
   .leftJoin(outboundSuppression,and(eq(outboundSuppression.organizationId,ctx.organizationId),eq(outboundSuppression.country,callListEntries.country),eq(outboundSuppression.orgNumber,callListEntries.orgNumber)))
   .where(and(eq(callListEntries.organizationId,ctx.organizationId),scope,
    isManager?undefined:or(isNull(outboundLeadState.assignedMembershipId),eq(outboundLeadState.assignedMembershipId,0),eq(outboundLeadState.assignedMembershipId,ctx.membershipId)),
    isManager?undefined:or(isNull(outboundCompanyOwnership.assignedMembershipId),eq(outboundCompanyOwnership.assignedMembershipId,ctx.membershipId))
   )).orderBy(desc(callListEntries.id)).limit(150).offset(offset);
   const users=await db.select({id:memberships.id,name:memberships.name,role:memberships.role,active:memberships.active}).from(memberships).where(and(eq(memberships.organizationId,ctx.organizationId),eq(memberships.active,true)));
  const visible=rows.map(r=>({...r.entry,state:r.state,assignedMembershipId:r.companyOwner?.assignedMembershipId??r.state?.assignedMembershipId??0,
   suppressed:!!r.state?.doNotContact||!!r.suppressionId}));
  const weekAgo=new Date(Date.now()-7*86400000).toISOString();
  const callScope=and(eq(outboundCallLogs.organizationId,ctx.organizationId),gte(outboundCallLogs.createdAt,weekAgo),isManager?undefined:eq(outboundCallLogs.membershipId,ctx.membershipId));
  const calls=await db.select({outcome:outboundCallLogs.outcome,membershipId:outboundCallLogs.membershipId,total:sql<number>`count(*)`}).from(outboundCallLogs)
    .where(callScope).groupBy(outboundCallLogs.membershipId,outboundCallLogs.outcome);
  const [{uniqueCalled}]=await db.select({uniqueCalled:sql<number>`count(distinct ${outboundCallLogs.entryId})`}).from(outboundCallLogs).where(callScope);
  const sumCalls=(rows:typeof calls)=>rows.reduce((total,row)=>total+Number(row.total),0);
  const conversations=sumCalls(calls.filter(c=>['Beslutningstaker kontaktet','Interessert','Ikke interessert','Møte booket'].includes(c.outcome)));
  const deals=await db.select().from(outboundDeals).where(and(eq(outboundDeals.organizationId,ctx.organizationId),isManager?undefined:eq(outboundDeals.membershipId,ctx.membershipId))).orderBy(desc(outboundDeals.updatedAt)).limit(400);
  const payments=await db.select().from(outboundDealPayments).where(and(eq(outboundDealPayments.organizationId,ctx.organizationId),isManager?undefined:eq(outboundDealPayments.membershipId,ctx.membershipId))).orderBy(desc(outboundDealPayments.createdAt)).limit(400);
  const attempts=sumCalls(calls);
  const metrics={attempts,uniqueCalled:Number(uniqueCalled),conversations,meetings:sumCalls(calls.filter(c=>c.outcome==='Møte booket')),conversationRate:attempts?Math.round(conversations/attempts*1000)/10:0,weekly:true,
    stages:Object.fromEntries(stages.map(stage=>[stage,deals.filter(d=>d.pipeline===stage).length]))};
  const byMember=users.filter(u=>isManager||u.id===ctx.membershipId).map(u=>{
    const mine=calls.filter(c=>c.membershipId===u.id);
    const ownDeals=deals.filter(d=>d.membershipId===u.id);
    const ownPayments=payments.filter(p=>p.membershipId===u.id);
    return {membershipId:u.id,name:u.name,attempts:sumCalls(mine),conversations:sumCalls(mine.filter(c=>['Beslutningstaker kontaktet','Interessert','Ikke interessert','Møte booket'].includes(c.outcome))),meetings:sumCalls(mine.filter(c=>c.outcome==='Møte booket')),won:ownDeals.filter(d=>d.pipeline==='Kunde').length,
      commissionsByCurrency:Object.fromEntries([...new Set(ownPayments.map(p=>p.currency))].map(currency=>[currency,ownPayments.filter(p=>p.currency===currency).reduce((sum,p)=>sum+Math.round(p.paidAmountMinor*p.commissionBps/10000),0)]))};
  });
  return publicJson({settings,rows:visible,members:isManager?users:users.filter(u=>u.id===ctx.membershipId),metrics,deals,payments,byMember,
   hasMore:rows.length===150,nextOffset:offset+rows.length,canManage:isManager,listId,listCount:lists.length});
 }catch(e){return accessResponse(e);}
}
export async function POST(request:Request){
 try{
  const ctx=await requireTenant(request),db=getDb(),body=await request.json() as Record<string,unknown>,now=new Date().toISOString(),type=String(body.type??'');
  if(type==='settings'){
   if(!manager(ctx.role))throw new AccessError(403,'Bare administrator kan endre outbound-innstillinger.');
   if(typeof body.enabled!=='boolean'||typeof body.currency!=='string'||!/^[A-Z]{3}$/.test(body.currency)||!integer(body.commissionBps,0,5000))throw new AccessError(400,'Ugyldig innstilling.');
   const timezone=clean(body.timezone,64),pitch=clean(body.pitch,8000);
   try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format(new Date());}catch{throw new AccessError(400,'Velg en gyldig tidssone.');}
   const [saved]=await db.update(organizations).set({outboundEnabled:body.enabled,outboundCurrency:body.currency,outboundTimezone:timezone,outboundCommissionBps:Number(body.commissionBps),outboundPitch:pitch}).where(eq(organizations.id,ctx.organizationId)).returning();
   return publicJson({settings:readSettings(saved)});
  }
  const org=await activeSetup(ctx),isManager=manager(ctx.role);
  if(type==='assign'){
   if(!isManager)throw new AccessError(403,'Bare administrator kan fordele leads.');
   if(!Array.isArray(body.entryIds)||body.entryIds.length<1||body.entryIds.length>50||!integer(body.membershipId,1))throw new AccessError(400,'Velg 1–50 bedrifter og en selger.');
   const assignedMember=Number(body.membershipId),[member]=await db.select().from(memberships).where(and(eq(memberships.id,assignedMember),eq(memberships.organizationId,ctx.organizationId),eq(memberships.active,true))).limit(1);
   if(!member)throw new AccessError(400,'Selgeren må være aktiv i denne bedriften.');
   const [license]=await db.select().from(moduleLicenses).where(and(eq(moduleLicenses.organizationId,ctx.organizationId),eq(moduleLicenses.membershipId,assignedMember),eq(moduleLicenses.moduleKey,'ringelister'),eq(moduleLicenses.active,true))).limit(1);
   if(!license)throw new AccessError(400,'Selgeren mangler lisens til Ringelister.');
   let assigned=0;
   for(const entryId of body.entryIds){
    const entry=await entryFor(ctx,entryId);
    await ensureOwner(ctx,entry,assignedMember,true);
    const [existing]=await db.select().from(callListAssignments).where(and(eq(callListAssignments.organizationId,ctx.organizationId),eq(callListAssignments.listId,entry.listId!),eq(callListAssignments.membershipId,assignedMember))).limit(1);
    if(!existing)await db.insert(callListAssignments).values({organizationId:ctx.organizationId,listId:entry.listId!,membershipId:assignedMember,assignedBy:ctx.user.displayName,createdAt:now,acknowledgedAt:''}).onConflictDoNothing();
    assigned++;
   }
   return publicJson({assigned});
  }
  if(type==='dial'){
   const entry=await entryFor(ctx,body.entryId),outcome=clean(body.outcome,64);
   if(!outcomes.includes(outcome as typeof outcomes[number]))throw new AccessError(400,'Ugyldig samtaleresultat.');
   const orgNumber=normalizeRegistryId(entry.orgNumber,entry.country);
   const blocked=orgNumber?await db.select().from(outboundSuppression).where(and(eq(outboundSuppression.organizationId,ctx.organizationId),eq(outboundSuppression.country,entry.country),eq(outboundSuppression.orgNumber,orgNumber))).limit(1):[];
   if(blocked.length&&outcome!=='Reservert mot kontakt')throw new AccessError(409,'Denne bedriften har reservert seg mot kontakt.');
   const state=await ensureOwner(ctx,entry,ctx.membershipId,false);
   if(state.doNotContact&&outcome!=='Reservert mot kontakt')throw new AccessError(409,'Denne bedriften har reservert seg mot kontakt.');
   if(typeof body.note!=='string'||body.note.length>1500)throw new AccessError(400,'Notatet kan være maks 1 500 tegn.');
   let nextAt=body.nextCallAt?isoDate(body.nextCallAt):'';
   if(body.nextCallAt&&!nextAt)throw new AccessError(400,'Ugyldig dato for neste samtale.');
   if(!nextAt&&['Ikke svar','Sentralbord','Interessert','Beslutningstaker kontaktet'].includes(outcome))nextAt=new Date(Date.now()+48*3600000).toISOString();
   if(['Reservert mot kontakt','Feil nummer','Ikke interessert'].includes(outcome))nextAt='';
   const closed=outcome==='Reservert mot kontakt';
   if(closed&&orgNumber)await db.insert(outboundSuppression).values({organizationId:ctx.organizationId,country:entry.country,orgNumber,name:entry.name,createdByMembershipId:ctx.membershipId,reason:clean(body.note,500),createdAt:now}).onConflictDoNothing();
   const pipeline=outcome==='Møte booket'?'Demo booket':closed||outcome==='Ikke interessert'?'Tapt':state.pipeline;
   const [updated]=await db.update(outboundLeadState).set({lastOutcome:outcome,lastNote:clean(body.note,1500),nextCallAt:nextAt,attempts:sql`${outboundLeadState.attempts}+1`,doNotContact:closed||state.doNotContact,pipeline,contactName:clean(body.contactName,120)||state.contactName,contactPhone:clean(body.contactPhone,40)||state.contactPhone,updatedAt:now}).where(eq(outboundLeadState.id,state.id)).returning();
   if(closed||outcome==='Ikke interessert')await db.update(outboundDeals).set({pipeline:'Tapt',updatedAt:now}).where(and(eq(outboundDeals.organizationId,ctx.organizationId),eq(outboundDeals.entryId,entry.id)));
   if(outcome==='Møte booket')await db.insert(outboundDeals).values({organizationId:ctx.organizationId,entryId:entry.id,membershipId:ctx.membershipId,pipeline:'Demo booket',monthlyAmountMinor:0,currency:org.outboundCurrency,commissionBps:org.outboundCommissionBps,createdAt:now,updatedAt:now}).onConflictDoUpdate({target:outboundDeals.entryId,set:{pipeline:'Demo booket',updatedAt:now}});
   await db.insert(outboundCallLogs).values({organizationId:ctx.organizationId,entryId:entry.id,membershipId:ctx.membershipId,outcome,note:clean(body.note,1500),nextCallAt:nextAt,createdAt:now});
   await db.update(callListEntries).set({handledBy:ctx.user.displayName,updatedAt:now,status:closed||outcome==='Ikke interessert'?'Ikke aktuell':outcome==='Møte booket'?'Møte booket':outcome==='Ikke svar'?'Ringte – ikke svar':'Kontaktet'}).where(and(eq(callListEntries.id,entry.id),eq(callListEntries.organizationId,ctx.organizationId)));
   return publicJson({lead:updated});
  }
  if(type==='stage'){
   const entry=await entryFor(ctx,body.entryId),stage=clean(body.pipeline,40);
   if(!stages.includes(stage as typeof stages[number]))throw new AccessError(400,'Ugyldig salgsfase.');
   const current=await db.select().from(outboundLeadState).where(and(eq(outboundLeadState.organizationId,ctx.organizationId),eq(outboundLeadState.entryId,entry.id))).limit(1);
   const owner=current[0]?.assignedMembershipId||ctx.membershipId;
   if(owner!==ctx.membershipId&&!isManager)throw new AccessError(403,'Dette leadet tilhører en annen selger.');
   const state=await ensureOwner(ctx,entry,owner,isManager);
   if(state.doNotContact&&stage!=='Tapt')throw new AccessError(409,'Reserverte bedrifter kan ikke kontaktes.');
   const monthlyAmountMinor=Number(body.monthlyAmountMinor??0);
   if(!integer(monthlyAmountMinor,0,10000000000))throw new AccessError(400,'Ugyldig kontraktsverdi.');
   const note=clean(body.note,1000);
   await db.update(outboundLeadState).set({pipeline:stage,lastNote:note||state.lastNote,updatedAt:now}).where(eq(outboundLeadState.id,state.id));
   await db.insert(outboundDeals).values({organizationId:ctx.organizationId,entryId:entry.id,membershipId:owner,pipeline:stage,monthlyAmountMinor,currency:org.outboundCurrency,commissionBps:org.outboundCommissionBps,note,createdAt:now,updatedAt:now}).onConflictDoUpdate({target:outboundDeals.entryId,set:{pipeline:stage,monthlyAmountMinor,currency:org.outboundCurrency,note,updatedAt:now}});
   return publicJson({ok:true});
  }
  if(type==='payment'){
   if(!isManager)throw new AccessError(403,'Kun administrator kan bekrefte betalinger.');
   const entry=await entryFor(ctx,body.entryId);
   const [deal]=await db.select().from(outboundDeals).where(and(eq(outboundDeals.organizationId,ctx.organizationId),eq(outboundDeals.entryId,entry.id))).limit(1);
   if(!deal||deal.pipeline!=='Kunde')throw new AccessError(400,'Sett salgsfasen til Kunde før betalingen registreres.');
   const ref=clean(body.reference,100),amount=Number(body.paidAmountMinor);
   if(ref.length<3||!integer(amount,1,10000000000)||body.confirmed!==true)throw new AccessError(400,'Bekreft en faktisk mottatt betaling, beløp og referanse.');
   const inserted=await db.insert(outboundDealPayments).values({organizationId:ctx.organizationId,entryId:entry.id,membershipId:deal.membershipId,paymentReference:ref,paidAmountMinor:amount,currency:deal.currency,commissionBps:deal.commissionBps,createdAt:now}).onConflictDoNothing().returning({id:outboundDealPayments.id});
   if(!inserted.length)throw new AccessError(409,'Denne betalingsreferansen er allerede registrert. Betalingen ble ikke lagt til på nytt.');
   return publicJson({ok:true,warning:'Registrert etter administrativ bekreftelse; ingen automatisk betalingskontroll er utført.'});
  }
  throw new AccessError(400,'Ukjent outbound-handling.');
 }catch(e){return accessResponse(e);}
}
