import { env } from "cloudflare:workers";
import { AccessError } from "@/lib/tenant";
import { fromBase64, toBase64 } from "@/lib/social-meta";

export const LINKEDIN_COOKIE="__Host-noracre-linkedin";
export const LINKEDIN_SCOPES=["rw_organization_admin","w_organization_social"];
const settings=()=>env as unknown as Record<string,string>;
export function linkedinReady(){const e=settings();return /^[a-zA-Z0-9]{6,100}$/.test(e.LINKEDIN_CLIENT_ID??'')&&(e.LINKEDIN_CLIENT_SECRET??'').length>=16;}
export function linkedinConfig(){
  if(!linkedinReady())throw new AccessError(503,"LinkedIn venter på at Noracre fullfører tilkoblingen.");
  const e=settings(),version=e.LINKEDIN_API_VERSION||"202608";
  if(!/^20\d{2}(0[1-9]|1[0-2])$/.test(version))throw new AccessError(503,"LinkedIn-oppsettet må oppdateres av Noracre.");
  return {id:e.LINKEDIN_CLIENT_ID,secret:e.LINKEDIN_CLIENT_SECRET,version,redirect:"https://crm.noracre.no/api/social/linkedin/callback"};
}
export class LinkedInError extends AccessError {
  constructor(public uncertain=false,public expired=false,public providerStatus=502){super(502,expired?"LinkedIn-tilgangen er utløpt eller fjernet. Koble til på nytt.":uncertain?"Svaret fra LinkedIn er uklart. Kontroller bedriftssiden før du forsøker å publisere innholdet på nytt.":providerStatus===403?"LinkedIn avviste tilgangen. Kontroller at appen har Community Management-tilgang og at du administrerer bedriftssiden.":providerStatus===429?"LinkedIn har nådd grensen for forespørsler. Prøv igjen senere.":"LinkedIn avviste forespørselen. Kontroller innlegget og bedriftssidens rettigheter.");}
}
const encoder=new TextEncoder();
async function key(){const material=await crypto.subtle.importKey("raw",encoder.encode(linkedinConfig().secret),"HKDF",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"HKDF",hash:"SHA-256",salt:encoder.encode("noracre-linkedin-v1"),info:encoder.encode("tokens")},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);}
export async function sealLinkedIn(value:unknown,context:string){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:encoder.encode(context)},await key(),encoder.encode(JSON.stringify(value)));return `li1.${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;}
export async function unsealLinkedIn<T>(value:string,context:string):Promise<T>{try{const [v,iv,data]=value.split('.');if(v!=='li1')throw Error();const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromBase64(iv),additionalData:encoder.encode(context)},await key(),fromBase64(data));return JSON.parse(new TextDecoder().decode(decrypted));}catch{throw new AccessError(409,"Koble til LinkedIn på nytt.");}}
export async function linkedinRequest(path:string,token:string,body?:unknown):Promise<Response>{
  if(!/^(organizationAcls\?|organizations\/\d+$|images(?:\?|\/)|posts$)/.test(path)||path.includes('..'))throw new AccessError(400,"Ugyldig LinkedIn-forespørsel.");
  let r:Response;try{r=await fetch(`https://api.linkedin.com/rest/${path}`,{method:body===undefined?'GET':'POST',redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${token}`,'LinkedIn-Version':linkedinConfig().version,'X-Restli-Protocol-Version':'2.0.0','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}catch{throw new LinkedInError(body!==undefined);}
  if(!r.ok)throw new LinkedInError(body!==undefined&&r.status>=500,r.status===401,r.status);return r;
}
export async function linkedinJson<T>(path:string,token:string,body?:unknown):Promise<T>{const r=await linkedinRequest(path,token,body);try{return await r.json() as T;}catch{throw new LinkedInError(body!==undefined);}}
export interface LinkedInPage {id:string;name:string}
export interface LinkedInPending {pages:LinkedInPage[];token:string;expiresAt:number}
// Posts API commentary uses little text: preserve the CRM's literal text instead
// of interpreting punctuation as mentions or other markup.
export const linkedinCommentary=(text:string)=>text.replace(/[|{}@\[\]()<>#\\*_~]/g,char=>`\\${char}`);
const organizationId=(urn:string)=>/^urn:li:organization:\d+$/.test(urn)?urn.split(':').at(-1)!:null;
export async function linkedinOrganizations(token:string):Promise<LinkedInPage[]>{
  const ids=new Set<string>();
  for(let start=0;start<1000;start+=100){
    const r=await linkedinJson<{elements:{organization?:string;organizationTarget?:string;role:string;state:string}[];paging?:{links?:{rel:string}[];total?:number}}>(`organizationAcls?q=roleAssignee&state=APPROVED&count=100&start=${start}`,token);
    if(!Array.isArray(r.elements))throw new LinkedInError();
    for(const entry of r.elements){const id=organizationId(entry.organizationTarget||entry.organization||'');if(id&&entry.state==='APPROVED'&&['ADMINISTRATOR','CONTENT_ADMINISTRATOR','CONTENT_ADMIN'].includes(entry.role))ids.add(id);}
    if(r.elements.length<100&&!r.paging?.links?.some(l=>l.rel==='next'))break;
    if(start===900)throw new AccessError(400,"For mange LinkedIn-sider. Begrens tilgangen og prøv igjen.");
  }
  const pages:LinkedInPage[]=[];
  for(const id of ids){const org=await linkedinJson<{id:number;localizedName?:string}>(`organizations/${id}`,token);if(String(org.id)!==id)throw new LinkedInError();pages.push({id,name:org.localizedName||`LinkedIn-side ${id}`});}
  return pages;
}
export async function requireLinkedInPage(token:string,id:string){if(!(await linkedinOrganizations(token)).some(p=>p.id===id))throw new AccessError(409,"Du har ikke lenger publiseringstilgang til denne LinkedIn-siden. Koble til på nytt.");}
export async function discoverLinkedIn(code:string):Promise<LinkedInPending>{
  const c=linkedinConfig();let r:Response;try{r=await fetch('https://www.linkedin.com/oauth/v2/accessToken',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,client_id:c.id,client_secret:c.secret,redirect_uri:c.redirect})});}catch{throw new LinkedInError();}
  if(!r.ok)throw new LinkedInError(false,r.status===401,r.status);
  let data:{access_token?:string;expires_in?:number;scope?:string};try{data=await r.json();}catch{throw new LinkedInError();}
  const seconds=Number(data.expires_in);if(!data.access_token||!Number.isFinite(seconds)||seconds<=0)throw new LinkedInError();
  if(typeof data.scope==='string'&&LINKEDIN_SCOPES.some(s=>!data.scope!.split(/[ ,]+/).includes(s)))throw new AccessError(403,"Gi Noracre tilgang til å finne bedriftssiden og publisere innlegg.");
  return {token:data.access_token,expiresAt:Date.now()+seconds*1000,pages:await linkedinOrganizations(data.access_token)};
}

// Upload only to LinkedIn's documented upload endpoint. Never follow redirects with a bearer token.
export async function publishLinkedIn(accountId:string,token:string,content:string,images:{bytes:ArrayBuffer;contentType:string}[]){
  if(!/^\d+$/.test(accountId))throw new AccessError(400,"Ugyldig LinkedIn-side.");
  if([...content].length>3000)throw new AccessError(400,"LinkedIn-teksten kan være maks 3 000 tegn.");
  const author=`urn:li:organization:${accountId}`,urns:string[]=[];
  for(const image of images){
    const upload=await linkedinJson<{value:{uploadUrl:string;image:string}}>('images?action=initializeUpload',token,{initializeUploadRequest:{owner:author}});
    const target=new URL(upload.value.uploadUrl);
    if(target.origin!=='https://www.linkedin.com'||!target.pathname.startsWith('/dms-uploads/')||target.username||target.password||!/^urn:li:image:[A-Za-z0-9_-]+$/.test(upload.value.image))throw new LinkedInError();
    let response:Response;try{response=await fetch(target,{method:'PUT',redirect:'manual',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${token}`,'Content-Type':image.contentType},body:image.bytes});}catch{throw new LinkedInError();}
    if(!response.ok)throw new LinkedInError(false,response.status===401,response.status);
    let available=false;
    for(let attempt=0;attempt<5;attempt++){
      const status=await linkedinJson<{status:string;owner:string}>(`images/${encodeURIComponent(upload.value.image)}`,token);
      if(status.owner!==author)throw new LinkedInError();
      if(status.status==='AVAILABLE'){available=true;break;}
      if(!['PROCESSING','WAITING_UPLOAD'].includes(status.status))throw new LinkedInError();
      if(attempt<4)await new Promise(resolve=>setTimeout(resolve,1000));
    }
    if(!available)throw new AccessError(409,"LinkedIn bruker lengre tid på bildet. Innlegget er ikke publisert på LinkedIn.");
    urns.push(upload.value.image);
  }
  const media=urns.length===1?{media:{id:urns[0]}}:urns.length>1?{multiImage:{images:urns.map(id=>({id}))}}:undefined;
  const r=await linkedinRequest('posts',token,{author,commentary:linkedinCommentary(content),visibility:'PUBLIC',distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]},lifecycleState:'PUBLISHED',isReshareDisabledByAuthor:false,...(media?{content:media}:{})});
  const id=r.headers.get('x-restli-id');if(r.status!==201||!id||!/^urn:li:(share|ugcPost):\d+$/.test(id))throw new LinkedInError(true);
  return id;
}
