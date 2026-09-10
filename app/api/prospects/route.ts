import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { prospects } from "@/db/schema";
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
  naeringskode1?: { beskrivelse?: string };
  forretningsadresse?: { kommune?: string };
  postadresse?: { kommune?: string };
};

async function requireSuperadmin(request: Request) {
  const ctx = await requireTenant(request);
  if (!ctx.isSuperadmin)
    throw new AccessError(403, "Bare superadministratorer har tilgang.");
  return ctx;
}

export async function GET(request: Request) {
  try {
    await requireSuperadmin(request);
    const rows = await getDb()
      .select()
      .from(prospects)
      .orderBy(desc(prospects.id))
      .limit(50);
    return Response.json({ prospects: rows });
  } catch (error) {
    console.error("Prospect generation failed", error);
    return accessResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperadmin(request);
    const data = (await request.json()) as Record<string, unknown>,
      db = getDb(),
      now = new Date().toISOString();
    if (data.type === "status") {
      const status = [
        "Ny",
        "Ringte – ikke svar",
        "Kontaktet",
        "Møte booket",
        "Ikke aktuell",
      ].includes(String(data.status))
        ? String(data.status)
        : "Ny";
      const [row] = await db
        .update(prospects)
        .set({ status, updatedAt: now })
        .where(eq(prospects.id, Number(data.id)))
        .returning();
      return Response.json({ prospect: row });
    }
    const existing = await db
        .select({ orgNumber: prospects.orgNumber })
        .from(prospects),
      seen = new Set(existing.map((row) => row.orgNumber));
    const day = Math.floor(Date.now() / 86400000),
      pageCount = 12,
      firstPage = (day * 11) % (90 - pageCount),
      companies: BrregCompany[] = [],
      requirePhone = data.requirePhone === true,
      requireEmail = data.requireEmail === true;
    // A temporary failure on one Brreg page must not fail the whole ring list.
    const pages = await Promise.allSettled(
      Array.from({ length: pageCount }, async (_, offset) => {
        const url = new URL(
          "https://data.brreg.no/enhetsregisteret/api/enheter",
        );
        url.searchParams.set("organisasjonsform", "AS");
        url.searchParams.set("size", "100");
        url.searchParams.set("page", String(firstPage + offset));
        const response = await fetch(url, {
          headers: { accept: "application/json" },
        });
        if (!response.ok) throw new Error(`Brreg ${response.status}`);
        const payload = (await response.json()) as {
          _embedded?: { enheter?: BrregCompany[] };
        };
        return payload._embedded?.enheter ?? [];
      }),
    );
    for (const page of pages)
      if (page.status === "fulfilled") companies.push(...page.value);
    if (!companies.length)
      return Response.json(
        {
          error:
            "Brønnøysundregistrene svarte ikke akkurat nå. Prøv igjen om litt.",
        },
        { status: 502 },
      );
    const candidates = companies
      .filter((company) => {
        const phone = company.telefon ?? company.mobil ?? "",
          email = company.epostadresse ?? "";
        return (
          company.organisasjonsnummer &&
          company.navn &&
          !seen.has(company.organisasjonsnummer) &&
          (company.antallAnsatte ?? 0) >= 1 &&
          (company.antallAnsatte ?? 0) <= 30 &&
          !company.konkurs &&
          !company.underAvvikling &&
          !company.underKonkursbehandling &&
          (!requirePhone || phone) &&
          (!requireEmail || email)
        );
      })
      .slice(0, 50)
      .map((company) => ({
        orgNumber: company.organisasjonsnummer!,
        name: company.navn!,
        industry: company.naeringskode1?.beskrivelse ?? "",
        city:
          company.forretningsadresse?.kommune ??
          company.postadresse?.kommune ??
          "",
        employees: company.antallAnsatte ?? null,
        phone: company.telefon ?? company.mobil ?? "",
        email: company.epostadresse ?? "",
        website: company.hjemmeside ?? "",
        status: "Ny",
        source: "Brønnøysundregistrene",
        createdAt: now,
        updatedAt: now,
      }));
    // D1 has a per-statement binding limit, so records are inserted in small batches.
    for (let index = 0; index < candidates.length; index += 5) {
      await db
        .insert(prospects)
        .values(candidates.slice(index, index + 5))
        .onConflictDoNothing();
    }
    const rows = await db
      .select()
      .from(prospects)
      .orderBy(desc(prospects.id))
      .limit(50);
    return Response.json({ prospects: rows, added: candidates.length });
  } catch (error) {
    console.error("Prospect generation failed", error);
    return accessResponse(error);
  }
}
