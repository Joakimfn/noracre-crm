import Link from "next/link";

export default function Databehandleravtale() {
  return (
    <main className="legal-page">
      <article>
        <Link href="/vilkar">← Tilbake til vilkårene</Link>
        <p className="eyebrow">SIST OPPDATERT 9. SEPTEMBER 2026</p>
        <h1>Databehandleravtale</h1>
        <p>
          Denne avtalen er en del av avtalen om Noracre CRM. Kunden er
          behandlingsansvarlig og leverandøren er databehandler.
        </p>
        <h2>Formål og varighet</h2>
        <p>
          Leverandøren behandler opplysninger for å lagre, sikre, vise,
          eksportere og støtte kundens CRM-data så lenge kundeforholdet varer og
          i avtalt sletteperiode.
        </p>
        <h2>Opplysninger og registrerte</h2>
        <p>
          Behandlingen kan omfatte navn, kontaktopplysninger, arbeidssted,
          stilling, kundehistorikk, notater, vedlegg og brukerdata om kundens
          ansatte, kontaktpersoner, prospekter og kunder. Kunden skal ikke legge
          inn særlige kategorier personopplysninger uten særskilt skriftlig
          avtale.
        </p>
        <h2>Instrukser og taushet</h2>
        <p>
          Leverandøren behandler bare opplysningene etter kundens dokumenterte
          instrukser, med mindre lov krever annet. Personer med tilgang skal
          være underlagt taushetsplikt og ha tilgang etter tjenstlig behov.
        </p>
        <h2>Sikkerhet</h2>
        <p>
          Leverandøren skal bruke risikotilpassede tiltak, herunder
          organisasjonsisolering, serverkontrollert rolle- og tilgangsstyring,
          tidsbegrenset supporttilgang, logging av administrative handlinger,
          beskyttet transport, leverandørstyrt lagring og mulighet for eksport.
          Tiltakene gjennomgås når risiko eller teknologi endres.
        </p>
        <h2>Avvik</h2>
        <p>
          Leverandøren varsler kunden uten ugrunnet opphold etter å ha blitt
          kjent med et brudd på personopplysningssikkerheten og gir tilgjengelig
          informasjon som kunden trenger for risikovurdering, dokumentasjon og
          eventuell melding til Datatilsynet eller de registrerte.
        </p>
        <h2>Underdatabehandlere</h2>
        <p>
          Kunden gir generell godkjenning til nødvendige driftsleverandører.
          Kunden skal informeres før vesentlige nye underdatabehandlere tas i
          bruk og kan fremme saklig innsigelse. Underdatabehandlere skal
          pålegges tilsvarende personvernforpliktelser.
        </p>
        <h2>Bistand og kontroll</h2>
        <p>
          Leverandøren bistår rimelig med innsyn, retting, sletting,
          dataportabilitet, risikovurderinger og tilsyn. Kunden kan be om
          relevant dokumentasjon. Ekstraordinær bistand kan faktureres når den
          skyldes kundens forhold eller går utover ordinær drift.
        </p>
        <h2>Sletting og retur</h2>
        <p>
          Ved avslutning kan kunden eksportere data. Data slettes normalt 90
          dager etter deaktivering, med mindre kunden ber om tidligere sletting
          eller lov krever fortsatt lagring. Sikkerhetskopier fases ut etter
          leverandørens ordinære rotasjon.
        </p>
        <h2>Kontakt og utfylling</h2>
        <p>
          Leverandørens og kundens foretaksopplysninger, kontaktpersoner,
          konkrete underdatabehandlere og lagringsområder skal føres inn før
          avtalen tas i bruk kommersielt.
        </p>
      </article>
    </main>
  );
}
