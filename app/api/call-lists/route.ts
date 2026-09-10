import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  activities,
  callListEntries,
  companies,
  contacts,
  moduleLicenses,
  organizationModules,
} from "@/db/schema";
import { AccessError, accessResponse, requireTenant } from "@/lib/tenant";

type BrregCompany = {
  organisasjonsnummer?: string;
  navn?: string;
  antallAnsatte?: number;
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
async function requireModule(organizationId: number, membershipId: number) {
  const rows = await getDb()
    .select()
    .from(moduleLicenses)
    .where(
      and(
        eq(moduleLicenses.organizationId, organizationId),
        eq(moduleLicenses.membershipId, membershipId),
        eq(moduleLicenses.moduleKey, "ringelister"),
        eq(moduleLicenses.active, true),
      ),
    )
    .limit(1);
  if (!rows.length)
    throw new AccessError(
      403,
      "Ringelistemodulen er ikke aktivert.",
      "MODULE_REQUIRED",
    );
}
function values(
  row: Record<string, unknown>,
  organizationId: number,
  source: string,
  now: string,
) {
  return {
    organizationId,
    orgNumber: String(row.orgNumber ?? row.organisasjonsnummer ?? "").replace(
      /\s/g,
      "",
    ),
    name: String(row.name ?? row.navn ?? "").trim(),
    industry: String(row.industry ?? row.bransje ?? ""),
    city: String(row.city ?? row.sted ?? ""),
    employees: Number.isFinite(Number(row.employees))
      ? Number(row.employees)
      : null,
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
    if (!module?.active || !license.length)
      return Response.json({ active: false, pricePerUser: 49, entries: [] });
    const condition =
      view === "history"
        ? and(
            eq(callListEntries.organizationId, ctx.organizationId),
            ne(callListEntries.status, "Ny"),
          )
        : and(
            eq(callListEntries.organizationId, ctx.organizationId),
            eq(callListEntries.status, "Ny"),
          );
    const rows = await db
      .select()
      .from(callListEntries)
      .where(condition)
      .orderBy(desc(callListEntries.id))
      .limit(view === "history" ? 500 : 150);
    return Response.json({
      active: true,
      pricePerUser: module.pricePerUser,
      entries: view === "queue" ? shuffle(rows) : rows,
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
        return Response.json(
          { error: "Bedriften finnes ikke." },
          { status: 404 },
        );
      let customerId = current.customerId;
      const meetingAt =
        status === "Møte booket"
          ? String(data.meetingAt ?? "")
          : current.meetingAt;
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
        if (status === "Møte booket" && !meetingAt)
          return Response.json(
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
                  eq(companies.orgNumber, current.orgNumber),
                ),
              )
              .limit(1)
          : [];
        if (!customer)
          [customer] = await db
            .insert(companies)
            .values({
              organizationId: ctx.organizationId,
              name: current.name,
              orgNumber: current.orgNumber,
              phone: contactPhone || current.phone,
              email: contactEmail || current.email,
              industry: current.industry,
              city: current.city,
              employees: current.employees,
              stage:
                status === "Møte booket"
                  ? "Møte avtalt"
                  : status === "Tilbud sendt"
                    ? "Tilbud sendt"
                    : "Ny kunde",
              nextAction: status === "Møte booket" ? "Gjennomfør møte" : "",
              nextActionDate: meetingAt,
              source: current.source,
              assignedTo: ctx.user.displayName,
              createdAt: now,
              updatedAt: now,
            })
            .returning();
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
            const [person] = await db
              .insert(contacts)
              .values({
                organizationId: ctx.organizationId,
                companyId: customer.id,
                name: contactName,
                email: contactEmail,
                phone: contactPhone,
                isPrimary: true,
                createdAt: now,
              })
              .returning();
            contactId = person.id;
          }
        }
        if (status === "Møte booket") {
          await db
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
            );
          await db.insert(activities).values({
            organizationId: ctx.organizationId,
            companyId: customer.id,
            contactId,
            companyName: customer.name,
            kind: "Møte",
            note: "Møte booket fra ringelisten",
            dueAt: meetingAt,
            completedAt: "",
            createdBy: ctx.user.displayName,
            createdAt: now,
          });
        }
        if (status === "Tilbud sendt")
          await db
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
            );
      }
      const [row] = await db
        .update(callListEntries)
        .set({
          status,
          meetingAt,
          customerId,
          contactName,
          contactEmail,
          contactPhone,
          handledBy: ctx.user.displayName,
          updatedAt: now,
        })
        .where(
          and(
            eq(callListEntries.id, current.id),
            eq(callListEntries.organizationId, ctx.organizationId),
          ),
        )
        .returning();
      return Response.json({ entry: row, company: customer });
    }
    if (data.type === "import") {
      const rows = Array.isArray(data.rows)
        ? (data.rows as Record<string, unknown>[])
            .slice(0, 1000)
            .map((row) =>
              values(row, ctx.organizationId, "Importert ringeliste", now),
            )
            .filter((row) => row.name)
        : [];
      const inserted = [];
      for (let i = 0; i < rows.length; i += 5)
        inserted.push(
          ...(await db
            .insert(callListEntries)
            .values(rows.slice(i, i + 5))
            .returning()),
        );
      return Response.json(
        { entries: inserted, added: inserted.length },
        { status: 201 },
      );
    }
    const min = Math.max(1, Number(data.minEmployees) || 1),
      max = Math.max(min, Math.min(250, Number(data.maxEmployees) || 30)),
      municipalityCode = String(data.municipalityCode ?? "").trim(),
      industryCode = String(data.industryCode ?? "").trim(),
      requirePhone = data.requirePhone === true,
      requireEmail = data.requireEmail === true,
      count = Math.max(1, Math.min(100, Number(data.count) || 50)),
      forms = (
        Array.isArray(data.organizationForms) ? data.organizationForms : ["AS"]
      )
        .map(String)
        .filter((form) => /^[A-Z0-9]{2,8}$/.test(form))
        .slice(0, 100);
    if (!forms.length)
      return Response.json(
        { error: "Velg minst én organisasjonsform." },
        { status: 400 },
      );
    if (municipalityCode && !/^\d{4}$/.test(municipalityCode))
      return Response.json(
        { error: "Velg et gyldig sted fra listen." },
        { status: 400 },
      );
    if (industryCode && !/^\d{2}(\.\d{1,3})?$/.test(industryCode))
      return Response.json(
        { error: "Velg en gyldig bransje fra listen." },
        { status: 400 },
      );
    const existing = await db
        .select({ orgNumber: callListEntries.orgNumber })
        .from(callListEntries)
        .where(
          and(
            eq(callListEntries.organizationId, ctx.organizationId),
            ne(callListEntries.status, "Ny"),
          ),
        ),
      seen = new Set(existing.map((row) => row.orgNumber)),
      found = new Map<string, BrregCompany>();
    const sortDirection = Math.random() > 0.5 ? "asc" : "desc";
    const makeUrl = (page: number) => {
      const url = new URL("https://data.brreg.no/enhetsregisteret/api/enheter");
      url.searchParams.set("organisasjonsform", forms.join(","));
      if (municipalityCode)
        url.searchParams.set("kommunenummer", municipalityCode);
      if (industryCode) url.searchParams.set("naeringskode", industryCode);
      url.searchParams.set("size", "100");
      url.searchParams.set("page", String(page));
      url.searchParams.set("sort", `organisasjonsnummer,${sortDirection}`);
      return url;
    };
    const load = async (page: number) => {
      const response = await fetch(makeUrl(page), {
        headers: { accept: "application/json" },
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
      pageJobs = shuffle(
        Array.from({ length: validPageCount }, (_, index) => index),
      ).slice(0, 25);
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
            employees = company.antallAnsatte ?? 0,
            phone = company.telefon ?? company.mobil ?? "",
            email = company.epostadresse ?? "",
            sector = company.naeringskode1?.kode ?? "",
            place =
              company.forretningsadresse?.kommunenummer ??
              company.postadresse?.kommunenummer;
          if (
            org &&
            company.navn &&
            !seen.has(org) &&
            !found.has(org) &&
            employees >= min &&
            employees <= max &&
            !company.konkurs &&
            !company.underAvvikling &&
            !company.underKonkursbehandling &&
            (!municipalityCode || place === municipalityCode) &&
            (!industryCode || sector.startsWith(industryCode)) &&
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
      return Response.json(
        {
          error:
            "Fant ingen nye bedrifter med disse filtrene. Prøv et større område eller færre krav.",
        },
        { status: 404 },
      );
    await db
      .delete(callListEntries)
      .where(
        and(
          eq(callListEntries.organizationId, ctx.organizationId),
          eq(callListEntries.status, "Ny"),
        ),
      );
    const inserted = [];
    for (let i = 0; i < candidates.length; i += 5)
      inserted.push(
        ...(await db
          .insert(callListEntries)
          .values(candidates.slice(i, i + 5))
          .returning()),
      );
    return Response.json({
      entries: shuffle(inserted),
      added: inserted.length,
    });
  } catch (e) {
    return accessResponse(e);
  }
}
