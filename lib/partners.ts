import {eq} from 'drizzle-orm';
import {getDb} from '@/db';
import {organizations} from '@/db/schema';
import {AccessError} from '@/lib/tenant';
/** Superadmin endpoints must check the caller before invoking this validator. */
export async function validateReferral(value:unknown,organizationId?:number){
 if(value==null||value===''||value==='none')return null;
 if(typeof value!=='string'&&typeof value!=='number')throw new AccessError(400,'Velg en gyldig partnerbedrift.');
 const id=Number(value);
 if(!Number.isSafeInteger(id)||id<1||id===organizationId)throw new AccessError(400,'Velg en annen, gyldig partnerbedrift.');
 const [partner]=await getDb().select().from(organizations).where(eq(organizations.id,id)).limit(1);
 if(!partner?.isPartner||partner.status!=='Aktiv'||(partner.scheduledDisableAt&&partner.scheduledDisableAt<=new Date().toISOString()))throw new AccessError(400,'Velg en aktiv partnerbedrift.');
 return id;
}
