import { env } from "cloudflare:workers";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { companies, contacts, attachments } from "@/db/schema";
import { AccessError, accessResponse, requireTenant } from "@/lib/tenant";
import { requireModuleAccess } from "@/lib/module-access";
import { Buffer } from "node:buffer";

const sender = "Noracre CRM <varsler@mail.noracre.no>";
const runtime = env as unknown as { RESEND_API_KEY?: string; BUCKET: R2Bucket };
const maxBytes = 10 * 1024 * 1024;
const validEmail = (value: string) => /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
function ids(value: FormDataEntryValue | null): number[] {
  let parsed: unknown;
  try { parsed = JSON.parse(String(value ?? "[]")); } catch { throw new AccessError(400, "Ugyldig utvalg."); }
  if (!Array.isArray(parsed) || parsed.some(id => !Number.isSafeInteger(id) || id < 1)) throw new AccessError(400, "Ugyldig utvalg.");
  return [...new Set(parsed as number[])];
}
export async function GET(request: Request) {
  try { const ctx = await requireTenant(request); return Response.json({ configured: Boolean(runtime.RESEND_API_KEY), from: sender, replyTo: ctx.user.email }); }
  catch (e) { return accessResponse(e); }
}
export async function POST(request: Request) {
  try {
    const ctx = await requireTenant(request);
    if (Number(request.headers.get("content-length") || 0) > maxBytes + 1024 * 1024) throw new AccessError(413, "Vedleggene kan samlet være maks 10 MB.");
    const form = await request.formData(), companyIds = ids(form.get("companyIds")), attachmentIds = ids(form.get("attachmentIds"));
    const bulk = form.get("mode") === "bulk";
    if (bulk) await requireModuleAccess(ctx.organizationId, ctx.membershipId, "markedsforing");
    if (!companyIds.length || companyIds.length > 500 || (!bulk && companyIds.length !== 1)) throw new AccessError(400, "Velg kunder som skal motta e-posten.");
    const subject = String(form.get("subject") ?? "").trim(), message = String(form.get("message") ?? "").trim();
    if (!subject || !message || subject.length > 250 || message.length > 100000 || /[\r\n]/.test(subject)) throw new AccessError(400, "Fyll inn emne (maks 250 tegn) og melding (maks 100 000 tegn).");
    const key = request.headers.get("idempotency-key") ?? "";
    if (!/^[a-zA-Z0-9-]{20,80}$/.test(key)) throw new AccessError(400, "Sendingsreferanse mangler. Oppdater siden.");
    const db = getDb(), rows = await db.select().from(companies).where(and(eq(companies.organizationId, ctx.organizationId), inArray(companies.id, companyIds)));
    if (rows.length !== companyIds.length) throw new AccessError(404, "En av kundene finnes ikke.");
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
    if (!runtime.RESEND_API_KEY) throw new AccessError(503, "E-posttjenesten mangler oppsett. Kontakt Noracre for å aktivere sending.");
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
    const payload = JSON.stringify({from: sender, to: bulk ? [ctx.user.email] : recipients, ...(bulk ? {bcc: recipients} : {}), reply_to: ctx.user.email, subject, text: message, ...(payloadFiles.length ? {attachments: payloadFiles} : {})});
    // A retry uses the same key and exact payload; different messages get different keys.
    const digest = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload))).toString("hex");
    const response = await fetch("https://api.resend.com/emails", {method:"POST", headers:{Authorization:`Bearer ${runtime.RESEND_API_KEY}`, "Content-Type":"application/json", "Idempotency-Key":`${ctx.organizationId}-${ctx.membershipId}-${key}-${digest}`}, body:payload, signal:AbortSignal.timeout(25000)});
    const result = await response.json() as {id?: string; name?: string};
    if (!response.ok || !result.id) return Response.json({error: response.status === 429 ? "E-posttjenesten er opptatt. Vent litt og prøv igjen." : "E-posttjenesten avviste sendingen. Kontroller avsenderoppsettet hos Noracre og filtypene i vedleggene."}, {status:502});
    return Response.json({accepted:true, count:recipients.length, id:result.id});
  } catch(e) { return accessResponse(e); }
}
