import {actorRef} from "@/lib/actor-names";
import {and,asc,eq} from 'drizzle-orm';
import {getDb} from '@/db';
import {organizations,memberships,auditLogs,partnerPayments} from '@/db/schema';
import {requireTenant,AccessError,accessResponse} from '@/lib/tenant';
import {validateReferral} from '@/lib/partners';
import {partnerCommissionOverview} from '@/lib/partner-payments';
const json=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){try{
 const ctx=await requireTenant(request),db=getDb();
 if(ctx.role==='Superadmin')return json({organizations:await db.select({id:organizations.id,name:organizations.name,status:organizations.status,isPartner:organizations.isPartner,referredByPartnerId:organizations.referredByPartnerId,partnerAssignedAt:organizations.partnerAssignedAt,scheduledDisableAt:organizations.scheduledDisableAt}).from(organizations).orderBy(asc(organizations.name))});
 const [partner]=await db.select().from(organizations).where(eq(organizations.id,ctx.organizationId)).limit(1);
 if(ctx.role!=='Partner'||!partner?.isPartner)throw new AccessError(403,'Bare partnere har tilgang til partneroversikten.');
 // A referral never grants tenant access. Scope customers and the payment ledger to this partner.
 const [orgs,payments]=await Promise.all([
 db.select({id:organizations.id,name:organizations.name,status:organizations.status,partnerAssignedAt:organizations.partnerAssignedAt,scheduledDisableAt:organizations.scheduledDisableAt}).from(organizations).where(eq(organizations.referredByPartnerId,ctx.organizationId)),
 db.select().from(partnerPayments).where(eq(partnerPayments.partnerId,ctx.organizationId))]);
 const now=new Date(),customers=orgs.map(org=>({id:org.id,name:org.name,assignedAt:org.partnerAssignedAt,active:org.status==='Aktiv'&&(!org.scheduledDisableAt||org.scheduledDisableAt>now.toISOString())}));
 return json({...partnerCommissionOverview(customers,payments,now),commissionBps:partner.commissionBps});
}catch(e){return accessResponse(e);}}
export async function POST(request:Request){try{
 const ctx=await requireTenant(request);
 if(ctx.role!=='Superadmin')throw new AccessError(403,'Bare superadmin kan administrere partnere.');
 const data=await request.json(),id=Number(data.organizationId),db=getDb();
 if(!Number.isSafeInteger(id)||id<1||typeof data.isPartner!=='boolean')throw new AccessError(400,'Velg bedrift og bedriftstype.');
 const [org]=await db.select().from(organizations).where(eq(organizations.id,id)).limit(1);
 if(!org)throw new AccessError(404,'Bedriften finnes ikke.');
 const referredByPartnerId=data.referredByPartnerId===org.referredByPartnerId?org.referredByPartnerId:await validateReferral(data.referredByPartnerId,id);
 if(org.isPartner&&!data.isPartner){
 const [refs,users]=await Promise.all([db.select({id:organizations.id}).from(organizations).where(eq(organizations.referredByPartnerId,id)).limit(1),db.select({id:memberships.id}).from(memberships).where(and(eq(memberships.organizationId,id),eq(memberships.role,'Partner'),eq(memberships.active,true))).limit(1)]);
 if(refs.length||users.length)throw new AccessError(409,'Fjern partnerkoblingene og deaktiver partnerbrukerne før du fjerner partnerstatus.');
 }
 const now=new Date().toISOString(),partnerAssignedAt=referredByPartnerId===org.referredByPartnerId?org.partnerAssignedAt:referredByPartnerId?now:'';
 await db.batch([db.update(organizations).set({isPartner:data.isPartner,referredByPartnerId,partnerAssignedAt}).where(eq(organizations.id,id)),db.insert(auditLogs).values({organizationId:id,actor:actorRef(ctx.user),action:'Partnerkobling endret',detail:JSON.stringify({isPartner:data.isPartner,previousPartnerId:org.referredByPartnerId,referredByPartnerId,partnerAssignedAt}),createdAt:now})]);
 return json({ok:true});
}catch(e){return accessResponse(e);}}
