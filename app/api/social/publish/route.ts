import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { marketingPostImages, marketingPosts, socialConnections, socialDeliveries } from "@/db/schema";
import { AccessError, accessResponse } from "@/lib/tenant";
import { graph, mediaUrl, META_CHANNELS, MetaError, socialAccess, tokenContext, unseal } from "@/lib/social-meta";
import { jpegDimensions, publishMeta } from "@/lib/social-publish";
export async function POST(request:Request){
  try {
    const ctx=await socialAccess(request),body=await request.json();
    if(body.confirm!==true)throw new AccessError(400,"Bekreft publisering først.");
    const [post]=await getDb().select().from(marketingPosts).where(and(eq(marketingPosts.id,Number(body.postId)),eq(marketingPosts.organizationId,ctx.organizationId))).limit(1);
    if(!post)throw new AccessError(404,"Innlegget finnes ikke.");
    const channels=JSON.parse(post.platforms) as string[];
    if(!channels.length||channels.some(p=>!META_CHANNELS.includes(p as "Facebook"|"Instagram")))throw new AccessError(400,"Publisering støttes foreløpig bare for Facebook og Instagram. Lag en kladd med disse kanalene.");
    const images=await getDb().select().from(marketingPostImages).where(and(eq(marketingPostImages.postId,post.id),eq(marketingPostImages.organizationId,ctx.organizationId))).orderBy(marketingPostImages.id);
    if(images.length>6)throw new AccessError(400,"Maks seks bilder per innlegg.");
    if(channels.includes("Instagram")){
      if(!images.length||images.some(i=>i.contentType!=="image/jpeg"||i.size>8*1024*1024)||post.content.length>2200)
        throw new AccessError(400,"Instagram krever 1–6 JPEG-bilder på maks 8 MB og tekst på maks 2200 tegn.");
      for(const image of images){
        const file=await (env.BUCKET as R2Bucket).get(image.objectKey);
        const size=file?jpegDimensions(new Uint8Array(await file.arrayBuffer())):null;
        if(!size||size.width<320||size.width>1440||size.height===0||size.width/size.height<.8||size.width/size.height>1.91)
          throw new AccessError(400,"Instagram-bilder må ha bredde 320–1440 piksler og sideforhold mellom 4:5 og 1,91:1.");
      }
    }
    const accounts=[];
    for(const platform of channels){
      const [c]=await getDb().select().from(socialConnections).where(and(eq(socialConnections.organizationId,ctx.organizationId),eq(socialConnections.platform,platform))).limit(1);
      if(!c||c.expiresAt<=Date.now())throw new AccessError(409,`Koble til ${platform} før publisering.`);
      const expected = Array.isArray(body.targets) ? body.targets.find((t: {platform?:string})=>t?.platform===platform) : undefined;
      if(!expected || expected.id!==c.id || expected.accountId!==c.accountId)
        throw new AccessError(409,"Kontotilkoblingen er endret. Åpne publiseringsbekreftelsen på nytt.");
      const token=await unseal<string>(c.token,tokenContext(ctx.organizationId,platform,c.accountId));
      const account=await graph<{id:string}>(c.accountId,token,{fields:"id"});
      if(account.id!==c.accountId)throw new AccessError(409,"Kontoen må kobles til på nytt.");
      accounts.push({...c,plainToken:token});
    }
    // Atomic post claim prevents parallel requests and retried HTTP calls from duplicating posts.
    const [claimed]=await getDb().update(marketingPosts).set({status:"Publiserer",updatedAt:new Date().toISOString()}).where(and(eq(marketingPosts.id,post.id),eq(marketingPosts.organizationId,ctx.organizationId),eq(marketingPosts.status,"Kladd"))).returning();
    if(!claimed)throw new AccessError(409,"Innlegget er allerede behandlet. Kontroller statusen før du gjør noe mer.");
    const results=[];
    for(const account of accounts){
      let deliveryId:number|undefined;
      try {
        const [delivery]=await getDb().insert(socialDeliveries).values({organizationId:ctx.organizationId,postId:post.id,platform:account.platform,accountId:account.accountId,createdAt:new Date().toISOString()}).onConflictDoNothing().returning();
        if(!delivery){results.push({platform:account.platform,status:"unknown",error:"Et publiseringsforsøk finnes allerede. Kontroller kontoen."});continue;}
        deliveryId=delivery.id;
        // Recheck entitlement and selected account immediately before each external write.
        await socialAccess(request);
        const [current]=await getDb().select({token:socialConnections.token}).from(socialConnections).where(and(eq(socialConnections.id,account.id),eq(socialConnections.organizationId,ctx.organizationId))).limit(1);
        if(current?.token!==account.token)throw new AccessError(409,"Tilkoblingen ble endret. Publiseringen er stoppet.");
        const urls=await Promise.all(images.map(i=>mediaUrl(ctx.organizationId,i.id,post.id)));
        const remoteId=await publishMeta(account.platform,account.accountId,account.plainToken,post.content,urls);
        await getDb().update(socialDeliveries).set({status:"published",remoteId}).where(eq(socialDeliveries.id,delivery.id));
        results.push({platform:account.platform,status:"published",remoteId});
      }catch(error){
        const status=error instanceof MetaError&&!error.uncertain||error instanceof AccessError&&!(error instanceof MetaError)?"failed":"unknown";
        const message=error instanceof AccessError?error.message:"Uklart resultat. Kontroller kontoen hos Meta før du publiserer innholdet på nytt.";
        if(deliveryId)await getDb().update(socialDeliveries).set({status,error:message}).where(eq(socialDeliveries.id,deliveryId));
        results.push({platform:account.platform,status,error:message});
      }
    }
    const status=results.every(r=>r.status==="published")?"Publisert":results.some(r=>r.status==="published")?"Delvis publisert":"Kontroller publisering";
    await getDb().update(marketingPosts).set({status,updatedAt:new Date().toISOString()}).where(and(eq(marketingPosts.id,post.id),eq(marketingPosts.organizationId,ctx.organizationId)));
    return Response.json({status,results});
  }catch(e){return accessResponse(e);}
}
