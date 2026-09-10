import { accessResponse, requireTenant } from "@/lib/tenant";

type KlassCode = { code: string; name: string; level?: string };
type OrganizationForm = {
  kode: string;
  beskrivelse: string;
  utgaatt?: string | boolean;
};
const fallbackForms: OrganizationForm[] = [
  ["ADOS", "Administrativ enhet - offentlig sektor"],
  ["ANNA", "Annen juridisk person"],
  ["ANS", "Ansvarlig selskap med solidarisk ansvar"],
  ["AS", "Aksjeselskap"],
  ["ASA", "Allmennaksjeselskap"],
  ["BA", "Selskap med begrenset ansvar"],
  ["BBL", "Boligbyggelag"],
  ["BO", "Andre bo"],
  ["BRL", "Borettslag"],
  ["DA", "Ansvarlig selskap med delt ansvar"],
  ["ENK", "Enkeltpersonforetak"],
  ["EOFG", "Europeisk økonomisk foretaksgruppe"],
  ["ESEK", "Eierseksjonssameie"],
  ["FKF", "Fylkeskommunalt foretak"],
  ["FLI", "Forening/lag/innretning"],
  ["FYLK", "Fylkeskommune"],
  ["GFS", "Gjensidig forsikringsselskap"],
  ["IKJP", "Andre ikke-juridiske personer"],
  ["IKS", "Interkommunalt selskap"],
  ["KBO", "Konkursbo"],
  ["KF", "Kommunalt foretak"],
  ["KIRK", "Den norske kirke"],
  ["KOMM", "Kommune"],
  ["KS", "Kommandittselskap"],
  ["KTRF", "Kontorfellesskap"],
  ["NUF", "Norskregistrert utenlandsk foretak"],
  ["OPMV", "Særskilt oppdelt enhet, jf. mval. § 2-2"],
  ["ORGL", "Organisasjonsledd"],
  ["PERS", "Andre enkeltpersoner som registreres i tilknyttet register"],
  ["PK", "Pensjonskasse"],
  ["PRE", "Partrederi"],
  ["SA", "Samvirkeforetak"],
  ["SAM", "Tingsrettslig sameie"],
  ["SE", "Europeisk selskap"],
  ["SF", "Statsforetak"],
  ["SPA", "Sparebank"],
  ["STAT", "Staten"],
  ["STI", "Stiftelse"],
  ["SÆR", "Annet foretak iflg. særskilt lov"],
  ["TVAM", "Tvangsregistrert for MVA"],
  ["UTLA", "Utenlandsk enhet"],
  ["VPFO", "Verdipapirfond"],
].map(([kode, beskrivelse]) => ({ kode, beskrivelse }));
let cache: {
  municipalities: { value: string; label: string }[];
  industries: { value: string; label: string }[];
  organizationForms: { value: string; label: string }[];
} | null = null;

async function codes(classification: number) {
  const response = await fetch(
    `https://data.ssb.no/api/klass/v1/classifications/${classification}/codesAt?date=${new Date().toISOString().slice(0, 10)}&language=nb`,
    { headers: { accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`SSB svarte ${response.status}`);
  return response.json() as Promise<{ codes: KlassCode[] }>;
}

export async function GET(request: Request) {
  try {
    await requireTenant(request);
    if (!cache) {
      const [placeResult, sectorResult, formResult] = await Promise.allSettled([
        codes(131),
        codes(6),
        fetch(
          "https://data.brreg.no/enhetsregisteret/api/organisasjonsformer/enheter?size=100",
          { headers: { accept: "application/json" } },
        ),
      ]);
      const places =
        placeResult.status === "fulfilled" ? placeResult.value : { codes: [] };
      const sectors =
        sectorResult.status === "fulfilled"
          ? sectorResult.value
          : { codes: [] };
      let forms: OrganizationForm[] = [];
      if (formResult.status === "fulfilled" && formResult.value.ok) {
        const formData = (await formResult.value.json()) as {
          _embedded?: { organisasjonsformer?: OrganizationForm[] };
        };
        forms = formData._embedded?.organisasjonsformer ?? [];
      }
      cache = {
        municipalities: places.codes
          .map((item) => ({ value: item.code, label: item.name }))
          .sort((a, b) => a.label.localeCompare(b.label, "nb")),
        industries: sectors.codes
          .filter((item) => Number(item.level) === 5)
          .map((item) => ({
            value: item.code,
            label: `${item.name} (${item.code})`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, "nb")),
        organizationForms: (forms.length ? forms : fallbackForms)
          .map((item) => ({
            value: item.kode,
            label: `${item.beskrivelse} (${item.kode})`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label, "nb")),
      };
    }
    return Response.json(cache, {
      headers: { "cache-control": "private, max-age=86400" },
    });
  } catch (error) {
    return accessResponse(error);
  }
}
