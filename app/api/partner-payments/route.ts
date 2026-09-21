import {and,desc,eq} from 'drizzle-orm';
import {getDb} from '@/db';
import {organizations,partnerPayments,auditLogs} from '@/db/schema';
import {requireTenant,AccessError,accessResponse} from '@/lib/tenant';
import {actorRef} from '@/lib/actor-names';
import {paymentAmountOre,validatePaidOn,paymentCommission} from '@/lib/partner-payments';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){try{
 const ctx=await requireTenant(request);if(ctx.role!=='Superadmin')throw new AccessError(403,'Bare superadmin kan registrere innbetalinger.');
 const id=Number(new URL(request.url).searchParams.get('organizationId'));if(!Number.isSafeInteger(id)||id<1)throw new AccessError(400,'Velg bedrift.');
 const db=getDb(),[company]=await db.select().from(organizations).where(eq(organizations.id,id)).limit(1);if(!company)throw new AccessError(404,'Bedriften finnes ikke.');
 const [partner]=company.referredByPartnerId?await db.select().from(organizations).where(eq(organizations.id,company.referredByPartnerId)).limit(1):[];
 const payments=await db.select().from(partnerPayments).where(eq(partnerPayments.organizationId,id)).orderBy(desc(partnerPayments.paidOn),desc(partnerPayments.id));
 return json({partner:partner?.isPartner?{id:partner.id,name:partner.name,basisPoints:partner.commissionBps}:null,payments:payments.map(({createdBy,...p})=>p)});
}catch(e){return accessResponse(e);}}
export async function POST(request:Request){try{
 const ctx=await requireTenant(request);if(ctx.role!=='Superadmin')throw new AccessError(403,'Bare superadmin kan registrere innbetalinger.');
 const data=await request.json(),db=getDb(),now=new Date().toISOString();
 if(data.type==='status'){
 if(typeof data.voided!=='boolean'||!Number.isSafeInteger(data.id))throw new AccessError(400,'Ugyldig innbetaling.');
 const [payment]=await db.select().from(partnerPayments).where(eq(partnerPayments.id,data.id)).limit(1);if(!payment)throw new AccessError(404,'Innbetalingen finnes ikke.');
 await db.batch([db.update(partnerPayments).set({voidedAt:data.voided?now:''}).where(eq(partnerPayments.id,payment.id)),db.insert(auditLogs).values({organizationId:payment.organizationId,actor:actorRef(ctx.user),action:data.voided?'Innbetaling annullert':'Innbetaling gjenopprettet',detail:payment.reference,createdAt:now})]);return json({ok:true});
 }
 if(data.type!=='payment')throw new AccessError(400,'Ukjent handling.');
 const id=Number(data.organizationId);if(!Number.isSafeInteger(id)||id<1)throw new AccessError(400,'Velg bedrift.');
 let amountOre:number,paidOn:string;try{amountOre=paymentAmountOre(data.amount);paidOn=validatePaidOn(data.paidOn);}catch(e){throw new AccessError(400,(e as Error).message);}
 const reference=typeof data.reference==='string'?data.reference.trim():'';if(!reference||reference.length>120)throw new AccessError(400,'Oppgi en betalingsreferanse på maksimalt 120 tegn.');
 const [company]=await db.select().from(organizations).where(eq(organizations.id,id)).limit(1);if(!company?.referredByPartnerId)throw new AccessError(409,'Knytt bedriften til en partner først.');
 const [partner]=await db.select().from(organizations).where(eq(organizations.id,company.referredByPartnerId)).limit(1);
 if(!partner?.isPartner||partner.commissionBps==null)throw new AccessError(409,'Avtal partnerens provisjon under Drift først.');
 if(data.acceptedPartnerId!==partner.id||data.acceptedBasisPoints!==partner.commissionBps)throw new AccessError(409,'Partner eller provisjon er endret. Hent opplysningene på nytt før du registrerer betalingen.');
 const referenceKey=reference.toLocaleLowerCase('nb');
 const [duplicate]=await db.select({id:partnerPayments.id}).from(partnerPayments).where(and(eq(partnerPayments.organizationId,id),eq(partnerPayments.referenceKey,referenceKey))).limit(1);if(duplicate)throw new AccessError(409,'Denne betalingsreferansen er allerede registrert for bedriften.');
 const commissionOre=paymentCommission(amountOre,partner.commissionBps);
 try{await db.batch([db.insert(partnerPayments).values({organizationId:id,partnerId:partner.id,companyName:company.name,reference,referenceKey,paidOn,amountOre,basisPoints:partner.commissionBps,commissionOre,createdAt:now,createdBy:actorRef(ctx.user)}),db.insert(auditLogs).values({organizationId:id,actor:actorRef(ctx.user),action:'Innbetaling registrert',detail:JSON.stringify({reference,amountOre,partnerId:partner.id,basisPoints:partner.commissionBps,commissionOre,paidOn}),createdAt:now})]);}catch{throw new AccessError(409,'Registreringen kunne ikke bekreftes. Hent listen på nytt og kontroller referansen og provisjonen.');}
 return json({ok:true,commissionOre},201);
}catch(e){return accessResponse(e);}}
