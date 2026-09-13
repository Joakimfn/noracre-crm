import {env} from 'cloudflare:workers';
import {and,eq,inArray} from 'drizzle-orm';
import {getDb} from '@/db';
import {marketingPostImages,socialDeliveries} from '@/db/schema';
import {requireTenant,accessResponse,AccessError} from '@/lib/tenant';
import {requireModuleAccess,canManageModules} from '@/lib/module-access';
import {ensureCampaigns} from '@/lib/email-campaigns';
const runtime=()=>env as unknown as {DB:D1Database;BUCKET:R2Bucket};
export async function GET(request:Request){try{
 const ctx=await requireTenant(request);await requireModuleAccess(ctx.organizationId,ctx.membershipId,'markedsforing');
 const db=runtime().DB;await ensureCampaigns(db);
 const p=new URL(request.url).searchParams,history=p.get('view')==='history',q=(p.get('q')??'').trim().toLocaleLowerCase('nb-NO').slice(0,500);
 const union=`SELECT id,'post' kind,content,platforms,scheduled_at scheduledAt,status,created_at createdAt,updated_at updatedAt,'' subject,'' sender,0 recipientCount,0 membershipId,'' error,'' sentAt,'[]' files FROM marketing_posts WHERE organization_id=? AND status<>'Slettet'
 UNION ALL SELECT -id,'email',message,'["E-post"]',scheduled_at,status,created_at,updated_at,subject,sender,recipient_count,membership_id,error,sent_at,files FROM email_campaigns WHERE organization_id=? AND hidden=0`;
 const historyExpr="(kind='post' AND status='Publisert') OR (kind='email' AND status NOT IN ('Planlagt','Sender'))";
 const counts=await db.prepare(`SELECT sum(CASE WHEN ${historyExpr} THEN 0 ELSE 1 END) upcoming,sum(CASE WHEN ${historyExpr} THEN 1 ELSE 0 END) history FROM (${union})`).bind(ctx.organizationId,ctx.organizationId).first<{upcoming:number;history:number}>();
 const where=`(${history?'':'NOT '}(${historyExpr})) AND instr(lower(replace(replace(replace(subject || ' ' || content,'Æ','æ'),'Ø','ø'),'Å','å')),?)>0`;
 const bindings=[ctx.organizationId,ctx.organizationId,q];
 const totalRow=await db.prepare(`SELECT count(*) total FROM (${union}) WHERE ${where}`).bind(...bindings).first<{total:number}>();
 const total=totalRow?.total??0,pages=Math.max(1,Math.ceil(total/5)),requested=Number(p.get('page')),page=Math.min(pages,Number.isSafeInteger(requested)&&requested>0?requested:1);
 const order=history?"COALESCE(NULLIF(sentAt,''),updatedAt) DESC,kind,id":"CASE WHEN scheduledAt='' THEN 1 ELSE 0 END,scheduledAt,createdAt DESC,kind,id";
 const rows=await db.prepare(`SELECT * FROM (${union}) WHERE ${where} ORDER BY ${order} LIMIT 5 OFFSET ?`).bind(...bindings,(page-1)*5).all<{id:number;kind:string;membershipId:number;files:string}>();
 const entries=rows.results as {id:number;kind:string;membershipId:number;files:string}[];
 const ids=entries.filter(r=>r.kind==='post').map(r=>r.id);
 const images=ids.length?await getDb().select({id:marketingPostImages.id,postId:marketingPostImages.postId,filename:marketingPostImages.filename,contentType:marketingPostImages.contentType,size:marketingPostImages.size}).from(marketingPostImages).where(and(eq(marketingPostImages.organizationId,ctx.organizationId),inArray(marketingPostImages.postId,ids))):[];
 const deliveries=ids.length?await getDb().select().from(socialDeliveries).where(and(eq(socialDeliveries.organizationId,ctx.organizationId),inArray(socialDeliveries.postId,ids))):[];
 return Response.json({posts:entries.map(r=>({...r,canManage:r.kind==='post'||r.membershipId===ctx.membershipId||canManageModules(ctx.role),files:JSON.parse(r.files),images:images.filter(i=>i.postId===r.id),deliveries:deliveries.filter(d=>d.postId===r.id).map(d=>({platform:d.platform,status:d.status,error:d.error}))})),pagination:{page,pages,pageSize:5,total},counts:{upcoming:counts?.upcoming??0,history:counts?.history??0}});
}catch(e){return accessResponse(e);}}
export async function DELETE(request:Request){try{
 const ctx=await requireTenant(request);await requireModuleAccess(ctx.organizationId,ctx.membershipId,'markedsforing');
 const body=await request.json();if(body.confirm!==true||!Number.isSafeInteger(body.id)||body.id>=0)throw new AccessError(400,'Bekreft riktig e-post først.');
 const db=runtime().DB;await ensureCampaigns(db);
 const row=await db.prepare("UPDATE email_campaigns SET status=CASE WHEN status='Planlagt' THEN 'Avbrutt' ELSE status END,hidden=CASE WHEN status='Planlagt' THEN 0 ELSE 1 END,updated_at=? WHERE id=? AND organization_id=? AND (membership_id=? OR ?=1) AND status<>'Sender' AND hidden=0 RETURNING payload_key")
 .bind(new Date().toISOString(),-body.id,ctx.organizationId,ctx.membershipId,canManageModules(ctx.role)?1:0).first<{payload_key:string}>();
 if(!row)throw new AccessError(409,'E-posten finnes ikke, sendes nå eller tilhører en annen avsender.');
 await runtime().BUCKET.delete(row.payload_key).catch(()=>{});
 return Response.json({ok:true});
}catch(e){return accessResponse(e);}}
