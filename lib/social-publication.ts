import {LinkedInError,publishLinkedIn,requireLinkedInPage,unsealLinkedIn} from "@/lib/social-linkedin";
import {validateImage} from "@/lib/safe-image";
import { env } from "cloudflare:workers";
import { and, eq, lt, lte, gt, or } from "drizzle-orm";
import { getDb } from "@/db";
import { marketingPostImages, marketingPosts, socialConnections, socialDeliveries, memberships, organizations } from "@/db/schema";
import { AccessError } from "@/lib/tenant";
import { graph, mediaUrl, META_CHANNELS, MetaError, tokenContext, unseal } from "@/lib/social-meta";
import { jpegDimensions, publishMeta } from "@/lib/social-publish";
import {requireModuleAccess} from '@/lib/module-access';
type Publisher={organizationId:number;membershipId:number};
type PublicationInput={postId:number;confirm:boolean;action?:string;scheduledAt?:string;targets?:{id:number;platform:string;accountId:string}[]};

export function socialScheduleTime(value:unknown,now=Date.now()){
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value))throw new AccessError(400,'Velg et gyldig tidspunkt med tidssone.');
  const timestamp=Date.parse(value),calendarDate=new Date(value.slice(0,10));
  if(!Number.isFinite(calendarDate.getTime())||calendarDate.toISOString().slice(0,10)!==value.slice(0,10))throw new AccessError(400,'Velg en gyldig dato.');
  if(!Number.isFinite(timestamp)||timestamp<now+60000||timestamp>now+366*86400000)throw new AccessError(400,'Velg et tidspunkt minst ett minutt frem og maks ett år frem.');
  return new Date(timestamp).toISOString();
}
export async function scheduledSocialAccess(ctx:Publisher){
  const now=new Date().toISOString();
  const [member]=await getDb().select({id:memberships.id}).from(memberships).innerJoin(organizations,eq(organizations.id,memberships.organizationId)).where(and(
    eq(memberships.id,ctx.membershipId),eq(memberships.organizationId,ctx.organizationId),eq(memberships.active,true),eq(organizations.status,'Aktiv'),
    or(eq(memberships.scheduledDisableAt,''),gt(memberships.scheduledDisableAt,now)),or(eq(organizations.scheduledDisableAt,''),gt(organizations.scheduledDisableAt,now)))).limit(1);
  if(!member)throw new AccessError(403,'Brukeren har ikke lenger tilgang til bedriften.');
  await requireModuleAccess(ctx.organizationId,ctx.membershipId,'markedsforing');
}
export async function cancelSocialPublication(ctx:Publisher,postId:number){
  const [post]=await getDb().update(marketingPosts).set({status:'Kladd',scheduledMembershipId:0,scheduledTargets:'[]',publicationError:'',updatedAt:new Date().toISOString()}).where(and(eq(marketingPosts.id,postId),eq(marketingPosts.organizationId,ctx.organizationId),eq(marketingPosts.status,'Planlagt'))).returning();
  if(!post)throw new AccessError(409,'Innlegget er ikke planlagt, eller publiseringen har allerede startet. Oppdater innholdsplanen.');
  return {status:'Kladd',results:[]};
}
export async function publishStoredPost(ctx:Publisher,body:PublicationInput,prepared:Map<number,File>,authorize:()=>Promise<unknown>,mode:'manual'|'due'='manual',expectedVersion?:string){
    if(body.confirm!==true)throw new AccessError(400,"Bekreft publisering først.");
    const [post]=await getDb().select().from(marketingPosts).where(and(eq(marketingPosts.id,Number(body.postId)),eq(marketingPosts.organizationId,ctx.organizationId))).limit(1);
    if(!post)throw new AccessError(404,"Innlegget finnes ikke.");
    const scheduling=body.action==='schedule';
    const scheduledAt=scheduling?socialScheduleTime(body.scheduledAt):post.scheduledAt;
    if(scheduling)await scheduledSocialAccess(ctx);
    if(mode==='due'&&(post.status!=='Planlagt'||post.updatedAt!==expectedVersion||post.scheduledAt>new Date().toISOString()))throw new AccessError(409,'Innlegget er ikke klart for publisering.');
    const channels=JSON.parse(post.platforms) as string[];
    if(!channels.length||channels.some(p=>![...META_CHANNELS,"LinkedIn"].includes(p)))throw new AccessError(400,"Velg Facebook, Instagram eller LinkedIn for publisering.");
    if((scheduling||mode==='due')&&channels.some(p=>!META_CHANNELS.some(channel=>channel===p)))throw new AccessError(400,'Automatisk publisering støtter Facebook og Instagram.');
    const images=await getDb().select().from(marketingPostImages).where(and(eq(marketingPostImages.postId,post.id),eq(marketingPostImages.organizationId,ctx.organizationId))).orderBy(marketingPostImages.id);
    if([...prepared.keys()].some(id=>!images.some(i=>i.id===id)))throw new AccessError(400,"Bildet tilhører ikke dette innlegget.");
    if(images.length>6)throw new AccessError(400,"Maks seks bilder per innlegg.");
    for(const file of prepared.values()){
      await validateImage(file,8*1024*1024);
      if(file.type!=="image/jpeg")throw new AccessError(400,"Klargjorte bilder må være JPEG.");
    }
    if(channels.includes("Instagram")){
      if(!images.length)throw new AccessError(400,"Legg til minst ett bilde for Instagram.");
      if([...post.content].length>2200)throw new AccessError(400,"Instagram-teksten kan være maks 2 200 tegn.");
      for(const image of images){
        const replacement=prepared.get(image.id);
        if((replacement?.type??image.contentType)!=='image/jpeg')throw new AccessError(400,"Bildet må tilpasses for Instagram. Åpne publiseringsvinduet på nytt.");
        if((replacement?.size??image.size)>8*1024*1024)throw new AccessError(400,`Bildet «${image.filename}» er over 8 MB.`);
        const file=replacement??await (env.BUCKET as R2Bucket).get(image.objectKey);
        const size=file?jpegDimensions(new Uint8Array(await file.arrayBuffer())):null;
        if(!size||size.width<320||size.width>1440||size.height===0||size.width/size.height<.8||size.width/size.height>1.91)
          throw new AccessError(400,`Bildet «${image.filename}» må tilpasses. Åpne publiseringsvinduet på nytt.`);
      }
    }
    const linkedinImages:{bytes:ArrayBuffer;contentType:string}[]=[];
    if(channels.includes("LinkedIn")){
      if([...post.content].length>3000)throw new AccessError(400,"LinkedIn-teksten kan være maks 3 000 tegn.");
      for(const image of images){
        const replacement=prepared.get(image.id),type=replacement?.type??image.contentType;
        if(!["image/jpeg","image/png","image/gif"].includes(type))throw new AccessError(400,"LinkedIn støtter JPEG, PNG og GIF. Last opp bildet i et av disse formatene.");
        const file=replacement??await (env.BUCKET as R2Bucket).get(image.objectKey);if(!file)throw new AccessError(404,"Et bilde mangler. Ingen innlegg er publisert.");
        const bytes=await file.arrayBuffer();await validateImage(new File([bytes],image.filename,{type}),10*1024*1024);
        const raw=new Uint8Array(bytes),v=new DataView(bytes);
        const size=type==='image/jpeg'?jpegDimensions(raw):type==='image/png'&&bytes.byteLength>=24?{width:v.getUint32(16),height:v.getUint32(20)}:type==='image/gif'&&bytes.byteLength>=10?{width:v.getUint16(6,true),height:v.getUint16(8,true)}:null;
        if(!size||!size.width||!size.height||size.width*size.height>=36152320)throw new AccessError(400,"LinkedIn-bildene må ha færre enn 36 millioner piksler.");
        linkedinImages.push({bytes,contentType:type});
      }
    }
    const accounts=[];
    for(const platform of channels){
      const [c]=await getDb().select().from(socialConnections).where(and(eq(socialConnections.organizationId,ctx.organizationId),eq(socialConnections.platform,platform))).limit(1);
      if(!c||c.expiresAt<=Date.now())throw new AccessError(409,`Koble til ${platform} før publisering.`);
      if(scheduling&&c.expiresAt<=Date.parse(scheduledAt))throw new AccessError(409,`${platform}-tilkoblingen utløper før valgt tidspunkt. Koble til på nytt eller velg et tidligere tidspunkt.`);
      const expected = Array.isArray(body.targets) ? body.targets.find((t: {platform?:string})=>t?.platform===platform) : undefined;
      if(!expected || expected.id!==c.id || expected.accountId!==c.accountId)
        throw new AccessError(409,"Kontotilkoblingen er endret. Åpne publiseringsbekreftelsen på nytt.");
      const token=await (platform==="LinkedIn"?unsealLinkedIn<string>(c.token,tokenContext(ctx.organizationId,platform,c.accountId)):unseal<string>(c.token,tokenContext(ctx.organizationId,platform,c.accountId)));
      if(platform==="LinkedIn")await requireLinkedInPage(token,c.accountId);
      else {const account=await graph<{id:string}>(c.accountId,token,{fields:"id"});if(account.id!==c.accountId)throw new AccessError(409,"Kontoen må kobles til på nytt.");}
      accounts.push({...c,plainToken:token});
    }
    // Atomic post claim prevents parallel requests and retried HTTP calls from duplicating posts.
    const [claimed]=await getDb().update(marketingPosts).set({status:"Publiserer",publicationError:"",updatedAt:new Date().toISOString()}).where(and(eq(marketingPosts.id,post.id),eq(marketingPosts.organizationId,ctx.organizationId),eq(marketingPosts.status,mode==='due'?"Planlagt":"Kladd"),eq(marketingPosts.updatedAt,post.updatedAt))).returning();
    if(!claimed)throw new AccessError(409,"Innlegget er allerede behandlet. Kontroller statusen før du gjør noe mer.");
    // Only the winning publication request can replace images. No Meta writes before preparation succeeds.
    try {
      for(const image of images){
        const file=prepared.get(image.id);if(!file)continue;
        const objectKey=`marketing/${ctx.organizationId}/${post.id}/${crypto.randomUUID()}`;
        await (env.BUCKET as R2Bucket).put(objectKey,await file.arrayBuffer(),{httpMetadata:{contentType:'image/jpeg'}});
        await getDb().update(marketingPostImages).set({objectKey,contentType:'image/jpeg',size:file.size,filename:image.filename.replace(/\.[^.]+$/,'')+'.jpg'}).where(and(eq(marketingPostImages.id,image.id),eq(marketingPostImages.organizationId,ctx.organizationId)));
      }
    }catch{
      await getDb().update(marketingPosts).set({status:"Kladd"}).where(and(eq(marketingPosts.id,post.id),eq(marketingPosts.organizationId,ctx.organizationId),eq(marketingPosts.status,"Publiserer")));
      throw new AccessError(503,"Bildene kunne ikke klargjøres. Ingenting ble publisert. Prøv igjen.");
    }
    if(scheduling){
      // Store only explicitly confirmed destinations; tokens stay in encrypted connections.
      const targets=accounts.map(c=>({id:c.id,platform:c.platform,accountId:c.accountId}));
      await getDb().update(marketingPosts).set({status:'Planlagt',scheduledAt,scheduledMembershipId:ctx.membershipId,scheduledTargets:JSON.stringify(targets),updatedAt:new Date().toISOString()}).where(and(eq(marketingPosts.id,post.id),eq(marketingPosts.status,'Publiserer')));
      return {status:'Planlagt',scheduledAt,results:[]};
    }
    const results=[];
    for(const account of accounts){
      let deliveryId:number|undefined;
      try {
        const [delivery]=await getDb().insert(socialDeliveries).values({organizationId:ctx.organizationId,postId:post.id,platform:account.platform,accountId:account.accountId,createdAt:new Date().toISOString()}).onConflictDoNothing().returning();
        if(!delivery){results.push({platform:account.platform,status:"unknown",error:"Et publiseringsforsøk finnes allerede. Kontroller kontoen."});continue;}
        deliveryId=delivery.id;
        // Recheck entitlement and selected account immediately before each external write.
        await authorize();
        const [current]=await getDb().select({token:socialConnections.token,expiresAt:socialConnections.expiresAt,accountId:socialConnections.accountId}).from(socialConnections).where(and(eq(socialConnections.id,account.id),eq(socialConnections.organizationId,ctx.organizationId))).limit(1);
        if(current?.token!==account.token||current.accountId!==account.accountId||current.expiresAt<=Date.now())throw new AccessError(409,"Tilkoblingen ble endret. Publiseringen er stoppet.");
        const remoteId=account.platform==="LinkedIn" ? await publishLinkedIn(account.accountId,account.plainToken,post.content,linkedinImages) : await publishMeta(account.platform,account.accountId,account.plainToken,post.content,await Promise.all(images.map(i=>mediaUrl(ctx.organizationId,i.id,post.id))));
        await getDb().update(socialDeliveries).set({status:"published",remoteId}).where(eq(socialDeliveries.id,delivery.id));
        results.push({platform:account.platform,status:"published",remoteId});
      }catch(error){
        const status=(error instanceof MetaError||error instanceof LinkedInError)&&!error.uncertain||error instanceof AccessError&&!(error instanceof MetaError)&&!(error instanceof LinkedInError)?"failed":"unknown";
        const message=error instanceof AccessError?error.message:"Uklart resultat. Kontroller kontoen på den aktuelle kanalen før du publiserer innholdet på nytt.";
        if(deliveryId)await getDb().update(socialDeliveries).set({status,error:message}).where(eq(socialDeliveries.id,deliveryId));
        results.push({platform:account.platform,status,error:message});
      }
    }
    const status=results.every(r=>r.status==="published")?"Publisert":results.some(r=>r.status==="published")?"Delvis publisert":"Kontroller publisering";
    await getDb().update(marketingPosts).set({status,updatedAt:new Date().toISOString()}).where(and(eq(marketingPosts.id,post.id),eq(marketingPosts.organizationId,ctx.organizationId)));
    return {status,scheduledAt:post.scheduledAt,results};
}

export async function dispatchDueSocialPosts(){
  const now=new Date().toISOString(),db=getDb();
  // An interrupted provider write may have succeeded. Never automatically retry it.
  await db.update(marketingPosts).set({status:'Kontroller publisering',publicationError:'Publiseringen ble avbrutt. Kontroller de valgte kontoene før du oppretter et nytt innlegg.',updatedAt:now}).where(and(eq(marketingPosts.status,'Publiserer'),lt(marketingPosts.updatedAt,new Date(Date.now()-15*60000).toISOString())));
  const due=await db.select().from(marketingPosts).where(and(eq(marketingPosts.status,'Planlagt'),lte(marketingPosts.scheduledAt,now))).orderBy(marketingPosts.scheduledAt,marketingPosts.id).limit(5);
  for(const post of due){
    const ctx={organizationId:post.organizationId,membershipId:post.scheduledMembershipId};
    try{
      await scheduledSocialAccess(ctx);
      await publishStoredPost(ctx,{postId:post.id,confirm:true,targets:JSON.parse(post.scheduledTargets)},new Map(),()=>scheduledSocialAccess(ctx),'due',post.updatedAt);
    }catch(error){
      // Version guard keeps a cancelled or newly scheduled draft untouched.
      await db.update(marketingPosts).set({status:'Feilet',publicationError:error instanceof AccessError?error.message:'Innlegget kunne ikke klargjøres. Kontroller tilkoblingene og bildene.',updatedAt:new Date().toISOString()}).where(and(eq(marketingPosts.id,post.id),eq(marketingPosts.status,'Planlagt'),eq(marketingPosts.updatedAt,post.updatedAt)));
    }
  }
}
