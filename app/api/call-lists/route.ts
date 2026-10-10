import {entryScope,requireList,countryFor,createList} from "@/lib/saved-call-lists";
import {searchInternationalRegister,registerSource} from "@/lib/international-registers";
import {searchFranceRegisterPage} from '@/lib/france-register';
import {parseCallListFilters,expandLocations,matchesCallListCompany} from '@/lib/call-list-filters';
import {getCallListOptions} from '@/lib/call-list-options';
import {validateReminderMinutes} from "@/lib/followup-reminder";
import { actorJson, actorRef } from "@/lib/actor-names";
import { canManageModules, requireModuleAccess } from "@/lib/module-access";
import { and, desc, eq, getTableColumns, inArray, ne, sql } from "drizzle-orm";
import {normalizeRegistryId} from '@/lib/prospect-import';
import { getDb } from "@/db";
import {commitLegacyOutboundStatus,legacyCallOutcome,outboundContactEntryScope,outboundDueEntryScope,outboundEntryPermission,outboundEntryScope,outboundOrganizationFor,requireOutboundEntryAccess} from '@/lib/outbound-access';
import {outboundRegistryExpression} from '@/lib/outbound-identity';
import {eligibleForOutbound,normalizeOutboundRules} from '@/lib/outbound-markets';
import {
  activities,
  savedCallLists,
  callListEntries,
  companies,
  contacts,
  moduleLicenses,
  organizationModules,
  outboundCallLogs,
  outboundLeadState,
} from "@/db/schema";
import { AccessError, accessResponse, requireTenant } from "@/lib/tenant";

type BrregCompany = {
  organisasjonsnummer?: string;
  navn?: string;
  antallAnsatte?: number;
  harRegistrertAntallAnsatte?: boolean;
  stiftelsesdato?: string;
  naeringskode2?: {kode?:string};
  naeringskode3?: {kode?:string};
  telefon?: string;
  mobil?: string;
  epostadresse?: string;
  hjemmeside?: string;
  konkurs?: boolean;
  underAvvikling?: boolean;
  underKonkursbehandling?: boolean;
  naeringskode1?: { kode?: string; beskrivelse?: string };
  forretningsadresse?: {
    kommunenummer?: string;
    kommune?: string;
    poststed?: string;
  };
  postadresse?: { kommunenummer?: string; kommune?: string; poststed?: string };
};
const statuses = [
  "Ny",
  "Ringte – ikke svar",
  "Kontaktet",
  "Møte booket",
  "Tilbud sendt",
  "Ikke aktuell",
  "Lagt til som kunde",
];
const shuffle = <T>(rows: T[]) => {
  const copy = [...rows];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const requireModule = (organizationId: number, membershipId: number) => requireModuleAccess(organizationId, membershipId, "ringelister");
function values(
  row: Record<string, unknown>,
  organizationId: number,
  source: string,
  now: string,
  country?:string,
) {
  return {
    organizationId,
    orgNumber: normalizeRegistryId(row.orgNumber ?? row.organisasjonsnummer ?? row.siren ?? row.siret,country),
    name: String(row.name ?? row.navn ?? "").trim(),
    industry: String(row.industry ?? row.bransje ?? ""),
    city: String(row.city ?? row.sted ?? ""),
    address: String(row.address ?? ""),
    postalCode: String(row.postalCode ?? ""),
    employees: row.employees == null || row.employees === ""
      ? null
      : Number.isSafeInteger(Number(row.employees)) && Number(row.employees)>=0 && Number(row.employees)<=1000000
        ? Number(row.employees)
        : null,
    employeeRange: String(row.employeeRange ?? "").slice(0,40),
    employeeRangeYear: /^\d{4}$/.test(String(row.employeeRangeYear??""))?String(row.employeeRangeYear):"",
    phone: String(row.phone ?? row.telefon ?? ""),
    email: String(row.email ?? row.epost ?? ""),
    website: String(row.website ?? row.nettside ?? ""),
    status: "Ny",
    source,
    meetingAt: "",
    customerId: null,
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    handledBy: "",
    createdAt: now,
    updatedAt: now,
  };
}

async function insertListRows(list:typeof savedCallLists.$inferSelect,rows:(typeof callListEntries.$inferInsert)[],removeOnFailure=true){
 const db=getDb(),batches=[];
 // Each entry binds 25 columns. D1 permits 100 bound parameters per query,
 // so four rows fit exactly; five rows would fail.
 const rowsPerInsert=4;
 for(let i=0;i<rows.length;i+=rowsPerInsert)batches.push(db.insert(callListEntries).values(rows.slice(i,i+rowsPerInsert).map(row=>({...row,listId:list.id,country:list.country}))).returning());
 try{return (await db.batch(batches as [typeof batches[number],...typeof batches[number][]])).flat() as typeof callListEntries.$inferSelect[];}
 catch(error){if(removeOnFailure)await db.batch([db.delete(callListEntries).where(and(eq(callListEntries.organizationId,list.organizationId),eq(callListEntries.listId,list.id))),db.delete(savedCallLists).where(and(eq(savedCallLists.organizationId,list.organizationId),eq(savedCallLists.id,list.id)))]);throw error;}
}

async function visibleQueueRows(ctx:Awaited<ReturnType<typeof requireTenant>>,rows:typeof callListEntries.$inferSelect[]) {
 const db=getDb(),organization=await outboundOrganizationFor(ctx),ownership=await outboundEntryScope(ctx),visible=new Set<number>(),permissions=new Map<number,boolean>();
 for(let i=0;i<rows.length;i+=50){
  const allowed=await db.select({id:callListEntries.id,contactPermission:outboundEntryPermission(ctx)}).from(callListEntries).where(and(eq(callListEntries.organizationId,ctx.organizationId),inArray(callListEntries.id,rows.slice(i,i+50).map(row=>row.id)),ownership,outboundContactEntryScope(ctx)));
  for(const row of allowed){visible.add(row.id);permissions.set(row.id,row.contactPermission);}
 }
 const rules=normalizeOutboundRules(organization.outboundMarketRules);
 return rows.filter(row=>visible.has(row.id)&&eligibleForOutbound({...row,contactPermission:permissions.get(row.id)},rules,new Date(),organization.outboundTimezone).eligible);
}

export async function GET(request: Request) {
  try {
    const ctx = await requireTenant(request),
      db = getDb(),
      view =
        new URL(request.url).searchParams.get("view") === "history"
          ? "history"
          : "queue";
    const [[module], license] = await Promise.all([
      db
        .select()
        .from(organizationModules)
        .where(
          and(
            eq(organizationModules.organizationId, ctx.organizationId),
            eq(organizationModules.moduleKey, "ringelister"),
          ),
        )
        .limit(1),
      db
        .select()
        .from(moduleLicenses)
        .where(
          and(
            eq(moduleLicenses.organizationId, ctx.organizationId),
            eq(moduleLicenses.membershipId, ctx.membershipId),
            eq(moduleLicenses.moduleKey, "ringelister"),
            eq(moduleLicenses.active, true),
          ),
        )
        .limit(1),
    ]);
    if (!module?.active || !license.length) {
      if (!canManageModules(ctx.role)) throw new AccessError(403, "Modulen er ikke tildelt deg.", "MODULE_REQUIRED");
      return await actorJson(ctx,{ active: false, entries: [] });
    }
    const params=new URL(request.url).searchParams;
    const offset=Number(params.get("offset")??0);
    if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw new AccessError(400,"Ugyldig side i ringelisten.");
    const scope = await entryScope(ctx,params.get("listId"));
    const organization=await outboundOrganizationFor(ctx),ownership=await outboundEntryScope(ctx);
    const condition =
      view === "history"
        ? and(
            eq(callListEntries.organizationId, ctx.organizationId),
            ne(callListEntries.status, "Ny"),
          )
        : and(
            eq(callListEntries.organizationId, ctx.organizationId),
            organization.outboundEnabled?outboundDueEntryScope(ctx):eq(callListEntries.status, "Ny"),
          );
    const rows = await db
      .select({...getTableColumns(callListEntries),contactPermission:outboundEntryPermission(ctx)})
      .from(callListEntries)
      .where(and(condition,scope,ownership,view==='queue'?outboundContactEntryScope(ctx):undefined))
      .orderBy(desc(callListEntries.id))
      .limit(1000)
      .offset(offset);
    return await actorJson(ctx,{
      active: true,
      pricePerUser: module.pricePerUser,
      entries: view === "queue" ? shuffle(rows.filter(row=>eligibleForOutbound(row,normalizeOutboundRules(organization.outboundMarketRules),new Date(),organization.outboundTimezone).eligible)) : rows,
      hasMore: rows.length===1000,
      nextOffset: offset+rows.length,
    });
  } catch (e) {
    return accessResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireTenant(request);
    await requireModule(ctx.organizationId, ctx.membershipId);
    const data = (await request.json()) as Record<string, unknown>,
      db = getDb(),
      now = new Date().toISOString();
    if (data.type === "status" || data.type === "addCustomer") {
      if(data.type==='status'&&!statuses.includes(String(data.status)))throw new AccessError(400,'Ugyldig status i ringelisten.');
      const status =
        data.type === "addCustomer"
          ? "Lagt til som kunde"
          : statuses.includes(String(data.status))
            ? String(data.status)
            : "Ny";
      const [current] = await db
        .select()
        .from(callListEntries)
        .where(
          and(
            eq(callListEntries.id, Number(data.id)),
            eq(callListEntries.organizationId, ctx.organizationId),
          ),
        )
        .limit(1);
      if (!current)
        return await actorJson(ctx,
          { error: "Bedriften finnes ikke." },
          { status: 404 },
        );
      if(current.listId)await requireList(ctx,current.listId);
      const access=await requireOutboundEntryAccess(ctx,current);
      const requestId=String(data.requestId??request.headers.get('idempotency-key')??crypto.randomUUID());
      if(!/^[a-zA-Z0-9:-]{8,120}$/.test(requestId))throw new AccessError(400,'Ugyldig samtalereferanse.');
      if(access.organization.outboundEnabled){
        const [previous]=await db.select().from(outboundCallLogs).where(and(eq(outboundCallLogs.organizationId,ctx.organizationId),eq(outboundCallLogs.requestId,requestId))).limit(1);
        if(previous){if(previous.entryId!==current.id||previous.membershipId!==ctx.membershipId||previous.outcome!==legacyCallOutcome(status)||previous.note!==(String(data.meetingNote??'').trim()||String(data.note??'').trim()).slice(0,1500)||(data.nextCallAt&&(!Number.isFinite(Date.parse(String(data.nextCallAt)))||previous.nextCallAt!==new Date(String(data.nextCallAt)).toISOString())))throw new AccessError(409,'Samtalereferansen er allerede brukt med annet innhold.');const [company]=current.customerId?await db.select().from(companies).where(and(eq(companies.organizationId,ctx.organizationId),eq(companies.id,current.customerId))).limit(1):[];return await actorJson(ctx,{entry:current,company,replayed:true});}
      }
      if(access.organization.outboundEnabled&&data.nextCallAt!==undefined&&data.nextCallAt!==''&&(typeof data.nextCallAt!=='string'||!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(data.nextCallAt)||!Number.isFinite(Date.parse(data.nextCallAt))))throw new AccessError(400,'Oppgi dato for neste samtale med tidssone.');
      if(data.note!==undefined&&(typeof data.note!=='string'||data.note.length>1500))throw new AccessError(400,'Notatet kan være maks 1 500 tegn.');
      const pending:Parameters<typeof db.batch>[0][number][]=[];
      const newRowId=()=>Number.parseInt(crypto.randomUUID().replaceAll('-','').slice(0,13),16)||1;
      let customerId = current.customerId;
      const meetingAt =
        status === "Møte booket"
          ? String(data.meetingAt ?? "")
          : current.meetingAt;
      let reminderMinutes="[15]";
      if(status==="Møte booket"){try{reminderMinutes=JSON.stringify(validateReminderMinutes(data.reminderMinutes??[15]));}catch(e){throw new AccessError(400,(e as Error).message);}}
      const meetingNote=String(data.meetingNote??"").trim();
      if(status==="Møte booket"&&meetingNote.length>5000)return await actorJson(ctx,{error:"Møtenotatet kan være maks 5 000 tegn."},{status:400});
      const contactName = String(
          data.contactName ?? current.contactName ?? "",
        ).trim(),
        contactEmail = String(
          data.contactEmail ?? current.contactEmail ?? "",
        ).trim(),
        contactPhone = String(
          data.contactPhone ?? current.contactPhone ?? "",
        ).trim();
      let customer: typeof companies.$inferSelect | undefined;
      if (
        status === "Møte booket" ||
        status === "Tilbud sendt" ||
        data.type === "addCustomer"
      ) {
        if (status === "Møte booket" && (!meetingAt || Number.isNaN(new Date(meetingAt).getTime())))
          return await actorJson(ctx,
            { error: "Velg dato og tidspunkt for møtet." },
            { status: 400 },
          );
        [customer] = current.orgNumber
          ? await db
              .select()
              .from(companies)
              .where(
                and(
                  eq(companies.organizationId, ctx.organizationId),
                  eq(outboundRegistryExpression(companies.orgNumber,companies.country), normalizeRegistryId(current.orgNumber,current.country)),
                  eq(companies.country, current.country),
                ),
              )
              .limit(1)
          : [];
        if (!customer){
          const planned={
              id:newRowId(),
              organizationId: ctx.organizationId,
              name: current.name,
              country: current.country,
              orgNumber: normalizeRegistryId(current.orgNumber,current.country),
              phone: contactPhone || current.phone,
              email: contactEmail || current.email,
              industry: current.industry,
              city: current.city,
              address: current.address,
              postalCode: current.postalCode,
              employees: current.employees,
              employeeRange: current.employeeRange,
              employeeRangeYear: current.employeeRangeYear,
              stage:
                status === "Møte booket"
                  ? "Møte avtalt"
                  : status === "Tilbud sendt"
                    ? "Tilbud sendt"
                    : "Ny kunde",
              nextAction: status === "Møte booket" ? "Gjennomfør møte" : "",
              nextActionDate: meetingAt,
              source: current.source,
              assignedTo: actorRef(ctx.user),
              createdAt: now,
              updatedAt: now,
            };
          pending.push(db.insert(companies).values(planned));
          // References needed by the remaining batch are known before any writes.
          customer={...planned,nextContactId:null} as typeof companies.$inferSelect;
        }
        customerId = customer.id;
        let contactId: number | null = null;
        if (
          (status === "Møte booket" || status === "Tilbud sendt") &&
          contactName
        ) {
          const existingContact = contactEmail
            ? await db
                .select()
                .from(contacts)
                .where(
                  and(
                    eq(contacts.organizationId, ctx.organizationId),
                    eq(contacts.companyId, customer.id),
                    eq(contacts.email, contactEmail),
                  ),
                )
                .limit(1)
            : [];
          if (existingContact[0]) contactId = existingContact[0].id;
          else {
            const person={
                id:newRowId(),
                organizationId: ctx.organizationId,
                companyId: customer.id,
                name: contactName,
                email: contactEmail,
                phone: contactPhone,
                isPrimary: true,
                createdAt: now,
              };
            pending.push(db.insert(contacts).values(person));
            contactId = person.id;
          }
        }
        if (status === "Møte booket") {
          pending.push(db
            .update(companies)
            .set({
              stage: "Møte avtalt",
              nextAction: "Gjennomfør møte",
              nextActionDate: meetingAt,
              nextContactId: contactId,
              updatedAt: now,
            })
            .where(
              and(
                eq(companies.id, customer.id),
                eq(companies.organizationId, ctx.organizationId),
              ),
            ));
          customer={...customer,stage:"Møte avtalt",nextAction:"Gjennomfør møte",nextActionDate:meetingAt,nextContactId:contactId,updatedAt:now};
          pending.push(db.insert(activities).values({
            organizationId: ctx.organizationId,
            companyId: customer.id,
            contactId,
            companyName: customer.name,
            kind: "Møte",
            note: meetingNote || "Møte booket fra ringelisten",
            dueAt: meetingAt,
            reminderMinutes,
            completedAt: "",
            createdBy: actorRef(ctx.user),
            createdAt: now,
          }));
        }
        if (status === "Tilbud sendt")
          pending.push(db
            .update(companies)
            .set({
              stage: "Tilbud sendt",
              phone: contactPhone || customer.phone,
              email: contactEmail || customer.email,
              nextContactId: contactId,
              updatedAt: now,
            })
            .where(
              and(
                eq(companies.id, customer.id),
                eq(companies.organizationId, ctx.organizationId),
              ),
            ));
      }
      const row=await commitLegacyOutboundStatus(ctx,current,{
          status,
          meetingAt,
          customerId,
          contactName,
          contactEmail,
          contactPhone,
          handledBy: actorRef(ctx.user),
          updatedAt: now,
        },access,{requestId,note:(meetingNote||String(data.note??'').trim()).slice(0,1500),nextCallAt:data.nextCallAt,now,customerId,isCustomer:data.type==='addCustomer'||status==='Lagt til som kunde',pending});
      if(row.customerId)[customer]=await db.select().from(companies).where(and(eq(companies.organizationId,ctx.organizationId),eq(companies.id,row.customerId))).limit(1);
      return await actorJson(ctx,{ entry: row, company: customer });
    }
    if(data.type !== "import" && data.type !== "generate" && data.type !== "enrichEmployees")throw new AccessError(400,"Ukjent handling.");
    const country = await countryFor(ctx,data.country);
    if(data.type==="enrichEmployees"){
      // Upload only verifiable company-registration-number matches into an owned saved list.
      // Small requests also work within the Cloudflare D1 free-tier subrequest limit.
      const list=await requireList(ctx,data.listId,true);
      if(list.country!==country)throw new AccessError(400,"Velg ringelisten fra riktig land.");
      if(!Array.isArray(data.rows)||data.rows.length<1||data.rows.length>25)throw new AccessError(400,"Oppdater 1–25 bedrifter per forespørsel.");
      const incoming=new Map<string,number>();
      for(const row of data.rows as Record<string,unknown>[]){
        const id=normalizeRegistryId(row.orgNumber),n=row.employees;
        if(!id||id.length>64||!Number.isInteger(n)||Number(n)<0||Number(n)>1000000)throw new AccessError(400,"Oppgi et gyldig registreringsnummer og et helt ansattall mellom 0 og 1 000 000.");
        incoming.set(id,Number(n));
      }
      const ownership=await outboundEntryScope(ctx);
      if(ownership){const [other]=await db.select({id:callListEntries.id}).from(callListEntries).where(and(eq(callListEntries.organizationId,ctx.organizationId),eq(callListEntries.listId,list.id),inArray(sql`UPPER(REPLACE(${callListEntries.orgNumber}, ' ', ''))`,[...incoming.keys()]),sql`not (${ownership})`)).limit(1);if(other)throw new AccessError(403,'Du kan bare oppdatere leads som er tildelt deg.');}
      const candidates=await db.select({id:callListEntries.id,orgNumber:callListEntries.orgNumber})
        .from(callListEntries).where(and(eq(callListEntries.organizationId,ctx.organizationId),eq(callListEntries.listId,list.id),inArray(sql`UPPER(REPLACE(${callListEntries.orgNumber}, ' ', ''))`,[...incoming.keys()]))).limit(1000);
      const updates=candidates.filter(row=>incoming.has(normalizeRegistryId(row.orgNumber))).map(row=>db.update(callListEntries)
        .set({employees:incoming.get(normalizeRegistryId(row.orgNumber))!,updatedAt:now})
        .where(and(eq(callListEntries.id,row.id),eq(callListEntries.organizationId,ctx.organizationId),eq(callListEntries.listId,list.id))));
      if(updates.length)await db.batch(updates as [typeof updates[number],...typeof updates[number][]]);
      return await actorJson(ctx,{updated:updates.length,unmatched:incoming.size-new Set(candidates.map(row=>normalizeRegistryId(row.orgNumber))).size});
    }
    if (data.type === "import") {
      if(!Array.isArray(data.rows)||data.rows.length>100)throw new AccessError(400,"Importer maks 100 bedrifter per forespørsel. Store filer deles opp automatisk.");
      const rows = Array.isArray(data.rows)
        ? (data.rows as Record<string, unknown>[])
            .slice(0, 100)
            .map((row) =>
              values(row, ctx.organizationId, "Importert ringeliste", now,country),
            )
            .filter((row) => row.name)
        : [];
      if(!rows.length)throw new AccessError(400,"Importfilen inneholder ingen bedrifter.");
      const list=data.listId?await requireList(ctx,data.listId,true):await createList(ctx,country,data.listName??"Importert ringeliste",now);
      if(list.country!==country)throw new AccessError(400,"Listen og importen må ha samme land.");
      let importedRows=rows;
      if(country==='FR'){
        const previous=data.listId?await db.select({orgNumber:callListEntries.orgNumber}).from(callListEntries).where(and(eq(callListEntries.organizationId,ctx.organizationId),eq(callListEntries.listId,list.id))):[];
        const seen=new Set(previous.map(row=>normalizeRegistryId(row.orgNumber,country)).filter(Boolean));
        importedRows=rows.filter(row=>{if(!row.orgNumber)return true;if(seen.has(row.orgNumber))return false;seen.add(row.orgNumber);return true;});
      }
      const inserted = importedRows.length?await insertListRows(list,importedRows,!data.listId):[];
      return await actorJson(ctx,
        { entries: await visibleQueueRows(ctx,inserted), added: inserted.length, list },
        { status: 201 },
      );
    }
    if(country !== "NO"){
      const excludedIds=new Set<string>();
      if(country==='FR'){
        const [listed,customers]=await Promise.all([
          db.select({orgNumber:callListEntries.orgNumber}).from(callListEntries).where(and(eq(callListEntries.organizationId,ctx.organizationId),eq(callListEntries.country,country))),
          db.select({orgNumber:companies.orgNumber}).from(companies).where(and(eq(companies.organizationId,ctx.organizationId),eq(companies.country,country))),
        ]);
        for(const row of [...listed,...customers])if(row.orgNumber)excludedIds.add(normalizeRegistryId(row.orgNumber,country));
      }
      const frenchPage=country==='FR'?await searchFranceRegisterPage(data,excludedIds):undefined;
      const candidates=(frenchPage?.rows??await searchInternationalRegister(country,data,excludedIds)).filter(row=>row.name&&row.orgNumber);
      if(!candidates.length&&frenchPage?.hasMore)return await actorJson(ctx,{entries:[],added:0,nextPage:frenchPage.nextPage,hasMore:true,message:'Ingen nye bedrifter på disse sidene. Flere registersider er tilgjengelige.'});
      if(!candidates.length)throw new AccessError(404,"Fant ingen bedrifter. Prøv andre søkeord.");
      const list=await createList(ctx,country,data.listName,now);
      const inserted=await insertListRows(list,candidates.map(row=>values(row as unknown as Record<string,unknown>,ctx.organizationId,registerSource(country),now,country)));
      return await actorJson(ctx,{entries:await visibleQueueRows(ctx,inserted),added:inserted.length,list,...(frenchPage?{nextPage:frenchPage.nextPage,hasMore:frenchPage.hasMore}:{})});
    }
    const parsed=parseCallListFilters(data);
    if(!parsed.success)throw new AccessError(400,parsed.error.issues[0].message);
    const filters=parsed.data;
    const {count,organizationForms:forms,requirePhone,requireEmail}=filters;
    const options=await getCallListOptions();
    let municipalities:string[];
    try{municipalities=expandLocations(filters.locationCodes,options.municipalities);}catch(error){throw new AccessError(400,(error as Error).message);}
    if(filters.industryCodes.some(c=>!options.industries.some(x=>x.value===c))||forms.some(c=>!options.organizationForms.some(x=>x.value===c)))throw new AccessError(400,'Velg gyldige bransjer og organisasjonsformer fra listen.');
    const existing = await db
        .select({ orgNumber: callListEntries.orgNumber })
        .from(callListEntries)
        .where(
          and(
            eq(callListEntries.organizationId, ctx.organizationId),
            eq(callListEntries.country,"NO"),
            ne(callListEntries.status, "Ny"),
          ),
        ),
      seen = new Set(existing.map((row) => row.orgNumber)),
      found = new Map<string, BrregCompany>();
    const sortDirection = Math.random() > 0.5 ? "asc" : "desc";
    const makeUrl = (page: number) => {
      const url = new URL("https://data.brreg.no/enhetsregisteret/api/enheter");
      url.searchParams.set("organisasjonsform", forms.join(","));
      if(municipalities.length)url.searchParams.set('forretningsadresse.kommunenummer',municipalities.join(','));
      if(filters.industryCodes.length)url.searchParams.set('naeringskode',filters.industryCodes.join(','));
      url.searchParams.set('fraAntallAnsatte',String(filters.minEmployees));
      url.searchParams.set('tilAntallAnsatte',String(filters.maxEmployees));
      url.searchParams.set('konkurs','false');
      url.searchParams.set('underAvvikling','false');
      url.searchParams.set('underKonkursbehandling','false');
      if(filters.establishedFrom)url.searchParams.set('fraStiftelsesdato',filters.establishedFrom);
      if(filters.establishedTo)url.searchParams.set('tilStiftelsesdato',filters.establishedTo);
      url.searchParams.set("size", "100");
      url.searchParams.set("page", String(page));
      url.searchParams.set("sort", `organisasjonsnummer,${sortDirection}`);
      return url;
    };
    const load = async (page: number) => {
      const response = await fetch(makeUrl(page), {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        console.error(
          "Brreg call-list search failed",
          response.status,
          await response.text(),
        );
        throw new AccessError(
          502,
          "Brønnøysundregistrene svarte ikke som forventet. Prøv igjen om litt.",
          "BRREG_ERROR",
        );
      }
      return response.json() as Promise<{
        _embedded?: { enheter?: BrregCompany[] };
        page?: { totalPages?: number };
      }>;
    };
    const first = await load(0),
      validPageCount = Math.max(1, Math.min(100, first.page?.totalPages ?? 1)),
      pageJobs = [0,...shuffle(Array.from({length:validPageCount-1},(_,i)=>i+1)).slice(0,24)];
    for (
      let index = 0;
      index < pageJobs.length && found.size < count;
      index += 4
    ) {
      const payloads = await Promise.all(
        pageJobs
          .slice(index, index + 4)
          .map((page) => (page === 0 ? first : load(page))),
      );
      for (const payload of payloads)
        for (const company of shuffle(payload._embedded?.enheter ?? [])) {
          const org = company.organisasjonsnummer ?? "",
            phone = company.telefon ?? company.mobil ?? "",
            email = company.epostadresse ?? "";
          if (
            org &&
            company.navn &&
            !seen.has(org) &&
            !found.has(org) &&
            matchesCallListCompany(company,filters,municipalities) &&
            !company.konkurs &&
            !company.underAvvikling &&
            !company.underKonkursbehandling &&
            (!requirePhone || phone) &&
            (!requireEmail || email)
          )
            found.set(org, company);
          if (found.size >= count) break;
        }
    }
    const candidates = shuffle([...found.values()])
      .slice(0, count)
      .map((company) =>
        values(
          {
            orgNumber: company.organisasjonsnummer,
            name: company.navn,
            industry: company.naeringskode1?.beskrivelse,
            city:
              company.forretningsadresse?.kommune ??
              company.forretningsadresse?.poststed ??
              company.postadresse?.kommune,
            employees: company.antallAnsatte,
            phone: company.telefon ?? company.mobil,
            email: company.epostadresse,
            website: company.hjemmeside,
          },
          ctx.organizationId,
          "Brønnøysundregistrene",
          now,
        ),
      );
    if (!candidates.length)
      return await actorJson(ctx,
        {
          error:
            "Fant ingen nye bedrifter med disse filtrene. Prøv et større område eller færre krav.",
        },
        { status: 404 },
      );
    const list=await createList(ctx,country,data.listName,now);
    const inserted=await insertListRows(list,candidates);
    return await actorJson(ctx,{
      list,
      entries: shuffle(await visibleQueueRows(ctx,inserted)),
      added: inserted.length,
    });
  } catch (e) {
    return accessResponse(e);
  }
}


