import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { marketingPostImages, organizations, socialConnections, socialDeliveries } from "@/db/schema";
import { and, eq, gt, inArray } from "drizzle-orm";
import { safeImageType } from "@/lib/safe-image";
import { verifyMedia } from "@/lib/social-meta";
export async function GET(request:Request){
  try {
    const p=new URL(request.url).searchParams,org=Number(p.get("org")),id=Number(p.get("image")),post=Number(p.get("post"));
    if(!await verifyMedia(org,id,post,Number(p.get("expires")),p.get("signature")??""))return new Response(null,{status:403});
    const [organization]=await getDb().select().from(organizations).where(and(eq(organizations.id,org),eq(organizations.status,"Aktiv"))).limit(1);
    const [delivery]=await getDb().select({id:socialDeliveries.id}).from(socialDeliveries).innerJoin(socialConnections,and(eq(socialConnections.organizationId,socialDeliveries.organizationId),eq(socialConnections.platform,socialDeliveries.platform),eq(socialConnections.accountId,socialDeliveries.accountId),gt(socialConnections.expiresAt,Date.now()))).where(and(eq(socialDeliveries.organizationId,org),eq(socialDeliveries.postId,post),inArray(socialDeliveries.status,["sending","published","unknown"]))).limit(1);
    if(!organization||!delivery)return new Response(null,{status:404});
    const [image]=await getDb().select().from(marketingPostImages).where(and(eq(marketingPostImages.id,id),eq(marketingPostImages.organizationId,org),eq(marketingPostImages.postId,post))).limit(1);
    if(!image||!safeImageType(image.contentType))return new Response(null,{status:404});
    const object=await (env.BUCKET as R2Bucket).get(image.objectKey);
    if(!object)return new Response(null,{status:404});
    return new Response(object.body,{headers:{"Content-Type":image.contentType,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
  }catch{return new Response(null,{status:403});}
}
