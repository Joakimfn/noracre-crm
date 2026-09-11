import {env} from "cloudflare:workers";
import {sql} from "drizzle-orm";
import {getDb} from "@/db";
import {requireTenant,AccessError,accessResponse} from "@/lib/tenant";
export async function GET(request:Request){try{
 const ctx=await requireTenant(request);if(ctx.role!=="Superadmin")throw new AccessError(403,"Bare superadministratorer har tilgang.");
 const runtime=env as unknown as {SUPABASE_URL?:string;SUPABASE_ANON_KEY?:string;BUCKET?:{head:(key:string)=>Promise<unknown>}};
 async function check(name:string,task:()=>Promise<void>){const start=Date.now();let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([task(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error()),6500);})]);return {name,ok:true,ms:Date.now()-start,detail:"Svar mottatt"};}catch{return {name,ok:false,ms:Date.now()-start,detail:"Kontrollen feilet eller fikk ikke svar innen tidsfristen. Prøv igjen og sjekk leverandørens driftslogg."};}finally{clearTimeout(timer);}}
 const checks=await Promise.all([
 check("CRM-database",async()=>{await getDb().run(sql`SELECT 1`);}),
 check("Fillagring",async()=>{if(!runtime.BUCKET)throw Error();await runtime.BUCKET.head("_noracre_health_probe");}),
 check("Innlogging",async()=>{if(!runtime.SUPABASE_URL||!runtime.SUPABASE_ANON_KEY)throw Error();const r=await fetch(new URL('/auth/v1/health',runtime.SUPABASE_URL),{headers:{apikey:runtime.SUPABASE_ANON_KEY},signal:AbortSignal.timeout(5000),redirect:"manual"});if(!r.ok)throw Error();}),
 ]);
 return Response.json({checkedAt:new Date().toISOString(),status:checks.every(c=>c.ok)?"Normal":"Avvik",checks,scope:"Kontrollerer tilgjengelighet for database, fillagring og innlogging. Bekrefter ikke alle funksjoner, e-postlevering, betalinger eller sosiale medier."},{headers:{"Cache-Control":"no-store"}});
}catch(e){return accessResponse(e);}}
