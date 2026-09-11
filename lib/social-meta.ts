import { env } from "cloudflare:workers";
import { AccessError, requireTenant } from "@/lib/tenant";
import { canManageModules, requireModuleAccess } from "@/lib/module-access";

export const META_CHANNELS = ["Facebook", "Instagram"] as const;
export const OAUTH_COOKIE = "__Host-noracre-meta";
const encoder = new TextEncoder();
const settings = () => env as unknown as Record<string, string>;
export function metaReady() {
  const e = settings();
  return /^\d+$/.test(e.META_APP_ID ?? "") && (e.META_APP_SECRET ?? "").length >= 20 && /^v\d+\.\d+$/.test(e.META_GRAPH_VERSION ?? "");
}
export function metaConfig() {
  if (!metaReady()) throw new AccessError(503, "Facebook og Instagram venter på at Noracre fullfører Meta-oppsettet.");
  const e = settings();
  // Fixed application origin: never build OAuth redirects from request headers.
  return { appId: e.META_APP_ID, secret: e.META_APP_SECRET, version: e.META_GRAPH_VERSION,
    configId: e.META_LOGIN_CONFIG_ID, origin: "https://crm.noracre.no",
    redirect: "https://crm.noracre.no/api/social/meta/callback" };
}
export async function socialAccess(request: Request, admin = false) {
  const ctx = await requireTenant(request);
  await requireModuleAccess(ctx.organizationId, ctx.membershipId, "markedsforing");
  if (admin && !canManageModules(ctx.role)) throw new AccessError(403, "Bare administratoren kan koble til eller fjerne kontoer.");
  return ctx;
}
export const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
export const fromBase64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const randomSecret = () => toBase64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
export async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))), b => b.toString(16).padStart(2, "0")).join("");
}
async function key(purpose: string) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(metaConfig().secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: encoder.encode("noracre-social-v1"), info: encoder.encode(purpose) }, material,
    purpose === "tokens" ? {name: "AES-GCM", length: 256} : {name: "HMAC", hash: "SHA-256", length: 256}, false,
    purpose === "tokens" ? ["encrypt", "decrypt"] : ["sign", "verify"]);
}
export async function seal(value: unknown, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({name: "AES-GCM", iv, additionalData: encoder.encode(context)}, await key("tokens"), encoder.encode(JSON.stringify(value)));
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(data))}`;
}
export async function unseal<T>(value: string, context: string): Promise<T> {
  try {
    const [v, iv, data] = value.split(".");
    if (v !== "v1") throw Error();
    const plain = await crypto.subtle.decrypt({name: "AES-GCM", iv: fromBase64(iv), additionalData: encoder.encode(context)}, await key("tokens"), fromBase64(data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch { throw new AccessError(409, "Tilkoblingen må opprettes på nytt."); }
}
export const tokenContext = (org: number, platform: string, accountId: string) => `connection:${org}:${platform}:${accountId}`;
export const pendingContext = (org: number, id: string) => `pending:${org}:${id}`;

export class MetaError extends AccessError {
  constructor(public uncertain: boolean, public expired = false, public providerCode?: number) {
    super(502, expired ? "Tilgangen hos Meta er utløpt eller fjernet. Koble til kontoen på nytt." :
      uncertain ? "Svaret fra Meta er uklart. Kontroller kontoen før du forsøker å publisere innholdet på nytt." :
      "Meta avviste forespørselen. Kontroller kontoens rettigheter og bildene.");
  }
}
// Never forward provider URLs/errors/tokens to browsers or application logs.
export async function graph<T>(path: string, token?: string, values: Record<string, string> = {}, method: "GET" | "POST" = "GET"): Promise<T> {
  const c = metaConfig();
  if (!/^[a-zA-Z0-9_/]+$/.test(path)) throw new AccessError(400, "Ugyldig konto.");
  const params = new URLSearchParams(values);
  if (token) {
    const k = await crypto.subtle.importKey("raw", encoder.encode(c.secret), {name: "HMAC", hash: "SHA-256"}, false, ["sign"]);
    params.set("appsecret_proof", Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, encoder.encode(token))), b => b.toString(16).padStart(2, "0")).join(""));
  }
  const url = new URL(`https://graph.facebook.com/${c.version}/${path}`);
  if (method === "GET") url.search = params.toString();
  let response: Response;
  try { response = await fetch(url, {method, redirect: "manual", signal: AbortSignal.timeout(20000),
    headers: token ? {Authorization: `Bearer ${token}`} : {}, ...(method === "POST" ? {body: params} : {})}); }
  catch { throw new MetaError(method === "POST"); }
  // Workers supports manual/follow only. Never follow redirects carrying credentials.
  if (response.status >= 300 && response.status < 400) throw new MetaError(false);
  let data: {error?: {code?: number}};
  try { data = await response.json(); } catch { throw new MetaError(method === "POST"); }
  if (!response.ok || data.error) throw new MetaError(response.status >= 500 && method === "POST", data.error?.code === 190, Number.isSafeInteger(data.error?.code) ? data.error?.code : undefined);
  return data as T;
}
export interface MetaPage { id: string; name: string; access_token: string; tasks?: string[]; instagram_business_account?: {id: string; username?: string} }
export interface PendingAccounts { pages: MetaPage[]; expiresAt: number; permissions: string[] }
export async function discoverAccounts(code: string, stage: (name: string) => void = () => {}): Promise<PendingAccounts> {
  const c = metaConfig();
  stage("code_exchange");
  const short = await graph<{access_token: string}>("oauth/access_token", undefined, {client_id:c.appId, client_secret:c.secret, redirect_uri:c.redirect, code});
  if (!short.access_token) throw new MetaError(false);
  stage("token_exchange");
  const long = await graph<{access_token: string; expires_in?: number}>("oauth/access_token", undefined,
    {grant_type:"fb_exchange_token", client_id:c.appId, client_secret:c.secret, fb_exchange_token:short.access_token});
  if (!long.access_token) throw new MetaError(false);
  stage("permissions");
  const permissions = (await graph<{data: {permission: string; status: string}[]}>("me/permissions", long.access_token)).data.filter(p=>p.status==="granted").map(p=>p.permission);
  stage("pages");
  const pages: MetaPage[] = [];
  let after = "";
  for(let i=0;i<10;i++) {
    const result = await graph<{data:MetaPage[]; paging?:{cursors?:{after?:string}; next?:string}}>("me/accounts",long.access_token,
      {fields:"id,name,access_token,tasks"+(permissions.includes("instagram_basic")?",instagram_business_account{id,username}":""),limit:"100",...(after?{after}:{})});
    pages.push(...result.data.filter(p => /^\d+$/.test(p.id) && p.access_token && p.tasks?.some(t=>["CREATE_CONTENT","MANAGE"].includes(t))));
    if(!result.paging?.next) break;
    after=result.paging.cursors?.after ?? "";
    if(!after || i===9) throw new AccessError(400,"For mange sider. Begrens sidetilgangen hos Meta og prøv igjen.");
  }
  stage("token_expiry");
  const lifetime = Number(long.expires_in), now = Date.now();
  const cap = now + 60*24*3600*1000;
  let expiresAt: number;
  if (Number.isFinite(lifetime) && lifetime > 0) expiresAt = Math.min(now+lifetime*1000,cap);
  else {
    // A repeated exchange can omit expires_in. Verify the token with Meta rather
    // than inventing a new lifetime for an existing credential.
    const {data} = await graph<{data:{is_valid?:boolean;app_id?:string;type?:string;expires_at?:number;data_access_expires_at?:number}}>(
      "debug_token", `${c.appId}|${c.secret}`, {input_token:long.access_token});
    if(data?.is_valid!==true || String(data.app_id)!==c.appId || data.type!=="USER" ||
      !Number.isSafeInteger(data.expires_at) || data.expires_at! < 0) throw new MetaError(false);
    const deadlines=[cap];
    for(const expiry of [data.expires_at,data.data_access_expires_at]) {
      if(expiry===undefined)continue;
      if(!Number.isSafeInteger(expiry)||expiry<0||(expiry>0&&expiry*1000<=now))throw new MetaError(false);
      if(expiry>0)deadlines.push(expiry*1000);
    }
    expiresAt=Math.min(...deadlines);
  }
  return {pages, permissions, expiresAt};
}
export function permittedPlatforms(p: PendingAccounts) {
  const has = (...names:string[])=>names.every(n=>p.permissions.includes(n));
  return META_CHANNELS.filter(platform=> platform==="Facebook" ? has("pages_show_list","pages_read_engagement","pages_manage_posts") :
    has("pages_show_list","pages_read_engagement","instagram_basic","instagram_content_publish"));
}
export async function signMedia(org: number, image: number, post: number, expires: number) {
  return toBase64(new Uint8Array(await crypto.subtle.sign("HMAC",await key("media"),encoder.encode(`${org}:${image}:${post}:${expires}`))));
}
export async function verifyMedia(org: number, image: number, post: number, expires: number, signature: string) {
  if (![org,image,post,expires].every(n=>Number.isSafeInteger(n)&&n>0) || expires<Date.now() || expires>Date.now()+3600000) return false;
  try { return await crypto.subtle.verify("HMAC",await key("media"),fromBase64(signature),encoder.encode(`${org}:${image}:${post}:${expires}`)); } catch {return false;}
}
export async function mediaUrl(org:number,image:number,post:number) {
  const expires=Date.now()+3500000;
  const url=new URL("/api/social/media",metaConfig().origin);
  url.search=new URLSearchParams({org:String(org),image:String(image),post:String(post),expires:String(expires),signature:await signMedia(org,image,post,expires)}).toString();
  return url.toString();
}
