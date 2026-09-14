import {osloToday,norwegianSearchDates,norwegianDate,checkSearchScope} from '@/lib/norwegian-search';
import {env} from 'cloudflare:workers';
import {sql} from 'drizzle-orm';
import {getDb} from '@/db';
import {callListAiUsage} from '@/db/schema';
import {AccessError,accessResponse,requireTenant} from '@/lib/tenant';
import {requireModuleAccess} from '@/lib/module-access';
import {getCallListOptions} from '@/lib/call-list-options';
import {CALL_LIST_AI_MODEL,callListAIInput,validateCallListAIResponse} from '@/lib/call-list-ai';
export async function POST(request:Request){
 try{
  const ctx=await requireTenant(request);
  await requireModuleAccess(ctx.organizationId,ctx.membershipId,'ringelister');
  if(Number(request.headers.get('content-length'))>6000)throw new AccessError(413,'Søket er for langt. Bruk maks 1000 tegn.');
  const data=await request.json().catch(()=>null);
  if(typeof data?.prompt!=='string'||data.prompt.trim().length<8||data.prompt.length>1000)throw new AccessError(400,'Beskriv bedriftene med 8–1000 tegn.');
  const today=osloToday();
  try{checkSearchScope(data.prompt);norwegianSearchDates(data.prompt,today);}catch(error){throw new AccessError(422,(error as Error).message);}
  const ai=(env as unknown as {AI?:{run:(model:string,input:unknown)=>Promise<{response?:unknown}>}}).AI;
  if(!ai)throw new AccessError(503,'AI-søk er midlertidig utilgjengelig. Du kan fortsatt bruke filtrene nedenfor.');
  const now=Math.floor(Date.now()/1000),usage=callListAiUsage;
  const [counter]=await getDb().insert(usage).values({membershipId:ctx.membershipId,windowStarted:now,count:1}).onConflictDoUpdate({target:usage.membershipId,set:{windowStarted:sql`CASE WHEN ${usage.windowStarted} <= ${now-3600} THEN ${now} ELSE ${usage.windowStarted} END`,count:sql`CASE WHEN ${usage.windowStarted} <= ${now-3600} THEN 1 ELSE ${usage.count}+1 END`}}).returning();
  if(counter.count>30)throw new AccessError(429,'Du har brukt mange AI-søk på kort tid. Prøv igjen senere, eller bruk filtrene manuelt.');
  const options=await getCallListOptions();
  let response;
  try{response=await ai.run(CALL_LIST_AI_MODEL,callListAIInput(data.prompt.trim(),options,today));}catch{throw new AccessError(502,'AI-en svarte ikke som forventet. Prøv igjen, eller bruk filtrene manuelt.');}
  let raw=response.response;
  if(typeof raw==='string'){try{raw=JSON.parse(raw);}catch{throw new AccessError(502,'AI-en klarte ikke å tolke søket. Prøv igjen.');}}
  try{const filters=validateCallListAIResponse(raw,options,data.prompt,today);const period=filters.establishedFrom&&filters.establishedTo?`Etablert ${norwegianDate(filters.establishedFrom)} – ${norwegianDate(filters.establishedTo)}`:filters.establishedFrom?`Etablert fra ${norwegianDate(filters.establishedFrom)}`:filters.establishedTo?`Etablert til ${norwegianDate(filters.establishedTo)}`:'';return Response.json({filters,period},{headers:{'cache-control':'no-store'}});}catch(error){throw new AccessError(422,(error as Error).message);}
 }catch(error){return accessResponse(error);}
}
