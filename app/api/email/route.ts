import {getMailAccount,sendFromMailbox} from "@/lib/user-mail";
import { env } from "cloudflare:workers";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, contacts, attachments } from "@/db/schema";
import { AccessError, accessResponse, requireTenant } from "@/lib/tenant";
import { requireModuleAccess } from "@/lib/module-access";
import { Buffer } from "node:buffer";
import {createCampaign,dispatchCampaign,campaignOutcome} from "@/lib/email-campaigns";
import {requireOutboundCompaniesContact} from '@/lib/outbound-access';

const runtime = env as unknown as { BUCKET: R2Bucket };
const maxBytes = 10 * 1024 * 1024;
const validEmail = (value: string) => /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
function ids(value: FormDataEntryValue | null): number[] {
  let parsed: unknown;
  try { parsed = JSON.parse(String(value ?? "[]")); } catch { throw new AccessError(400, "Ugyldig utvalg."); }
  if (!Array.isArray(parsed) || parsed.some(id => !Number.isSafeInteger(id) || id < 1)) throw new AccessError(400, "Ugyldig utvalg.");
  return [...new Set(parsed as number[])];
}
export async function GET(request: Request) {
  try { const ctx = await requireTenant(request); const account=await getMailAccount(ctx.organizationId,ctx.membershipId); return Response.json({configured:Boolean(account),from:account?.email||"",replyTo:account?.email||""}); }
  catch (e) { return accessResponse(e); }
}
export async function POST(request: Request) {
  try {
    const ctx = await requireTenant(request);
    if (Number(request.headers.get("content-length") || 0) > maxBytes + 1024 * 1024) throw new AccessError(413, "Vedleggene kan samlet være maks 10 MB.");
    const form = await request.formData(), companyIds = ids(form.get("companyIds")), attachmentIds = ids(form.get("attachmentIds"));
    const campaign = form.get("mode") === "campaign", bulk = campaign || form.get("mode") === "bulk";
    if (bulk) await requireModuleAccess(ctx.organizationId, ctx.membershipId, "markedsforing");
    if (!companyIds.length || companyIds.length > 500 || (!bulk && companyIds.length !== 1)) throw new AccessError(400, "Velg kunder som skal motta e-posten.");
    const subject = String(form.get("subject") ?? "").trim(), message = String(form.get("message") ?? "").trim();
    if (!subject || !message || subject.length > 250 || message.length > 100000 || /[\r\n]/.test(subject)) throw new AccessError(400, "Fyll inn emne (maks 250 tegn) og melding (maks 100 000 tegn).");
    const key = request.headers.get("idempotency-key") ?? "";
    if (!/^[a-zA-Z0-9-]{20,80}$/.test(key)) throw new AccessError(400, "Sendingsreferanse mangler. Oppdater siden.");
    const db = getDb(), rows:typeof companies.$inferSelect[]=[];
    for(let i=0;i<companyIds.length;i+=75)rows.push(...await db.select().from(companies).where(and(eq(companies.organizationId, ctx.organizationId), inArray(companies.id, companyIds.slice(i,i+75)))));
    if (rows.length !== companyIds.length) throw new AccessError(404, "En av kundene finnes ikke.");
    await requireOutboundCompaniesContact(ctx,rows);
    let recipients = rows.map(row => row.email.trim().toLowerCase());
    const contactId = Number(form.get("contactId"));
    if (!bulk && contactId) {
      const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.companyId, companyIds[0]), eq(contacts.organizationId, ctx.organizationId))).limit(1);
      if (!contact) throw new AccessError(404, "Kontaktpersonen finnes ikke.");
      recipients = [(contact.email || rows[0].email).trim().toLowerCase()];
    }
    recipients = [...new Set(recipients)];
    if (recipients.some(email => !validEmail(email))) throw new AccessError(400, "En mottaker mangler en gyldig e-postadresse. Rett adressen før sending.");
    if (recipients.length > (bulk ? 49 : 1)) throw new AccessError(400, "Maks 49 mottakere per utsending. Velg en mindre kundegruppe.");
    const account=await getMailAccount(ctx.organizationId,ctx.membershipId);
    if(!account)throw new AccessError(409,"Koble til din egen Google- eller Microsoft-konto før du sender.");
    if (bulk && attachmentIds.length) throw new AccessError(400, "Last opp vedlegg til denne utsendingen.");
    const files = form.getAll("files").filter((value): value is File => value instanceof File);
    if (files.length + attachmentIds.length > 10) throw new AccessError(400, "Maks 10 vedlegg per e-post.");
    let total = files.reduce((sum, file) => sum + file.size, 0);
    if (total > maxBytes || files.some(file => !file.size)) throw new AccessError(413, "Vedlegg må ha innhold og kan samlet være maks 10 MB.");
    const stored = attachmentIds.length ? await db.select().from(attachments).where(and(eq(attachments.organizationId, ctx.organizationId), eq(attachments.companyId, companyIds[0]), inArray(attachments.id, attachmentIds))) : [];
    if (stored.length !== attachmentIds.length) throw new AccessError(404, "Et vedlegg finnes ikke på denne kunden.");
    total += stored.reduce((sum, file) => sum + file.size, 0);
    if (total > maxBytes) throw new AccessError(413, "Vedleggene kan samlet være maks 10 MB.");
    const payloadFiles: {filename: string; content: string}[] = [];
    const addFile = (name: string, data: ArrayBuffer) => payloadFiles.push({filename: name.replace(/[\r\n\x00/\\]/g, "_").slice(0,180) || "vedlegg", content: Buffer.from(data).toString("base64")});
    for (const file of files) addFile(file.name, await file.arrayBuffer());
    for (const file of stored) { const object = await runtime.BUCKET.get(file.objectKey); if (!object) throw new AccessError(404, "Et vedlegg er utilgjengelig."); addFile(file.filename, await object.arrayBuffer()); }
    const input={to:bulk?[account.email]:recipients,bcc:bulk?recipients:[],subject,message,files:payloadFiles,key};
    if(campaign){
      const scheduledAt=String(form.get("scheduledAt")??"");
      const row=await createCampaign(account,input,companyIds,scheduledAt);
      if(!scheduledAt){await dispatchCampaign(row.id);const outcome=await campaignOutcome(row.id);if(outcome?.status!=="Sendt")return Response.json({id:row.id,error:outcome?.error||"Sendingen behandles. Kontroller innholdsplanen før et nytt forsøk."},{status:409});}
      if(scheduledAt&&!["Planlagt","Sender","Sendt"].includes(row.status))return Response.json({id:row.id,error:"Denne utsendingen er avbrutt eller har feilet. Se innholdsplanen."},{status:409});
      return Response.json({accepted:true,scheduled:Boolean(scheduledAt),count:recipients.length,id:row.id});
    }
    await sendFromMailbox(account,input);
    return Response.json({accepted:true,count:recipients.length});
  } catch(e) { return accessResponse(e); }
}
