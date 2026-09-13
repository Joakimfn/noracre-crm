import Link from "next/link";

export default function Databehandleravtale() {
  return (
    <main className="legal-page">
      <article>
        <Link href="/vilkar">← Tilbake til vilkårene</Link>
        <p className="eyebrow">SIST OPPDATERT 13. SEPTEMBER 2026</p>
        <h1>Databehandleravtale</h1>
        <p>
          Denne avtalen er en del av avtalen om Noracre CRM. Kunden er
          behandlingsansvarlig og Joakim Ferdinand Nygård, som leverer
          tjenesten under navnet Noracre, er databehandler. Kunden og kundens
          kontaktperson identifiseres i det aksepterte tilbudet eller
          ordrebekreftelsen.
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
          Taushetsplikten gjelder også etter avtalens opphør. Leverandøren
          varsler kunden dersom en instruks etter leverandørens vurdering
          strider mot personvernreglene. Lovpålagt behandling varsles på
          forhånd med mindre loven forbyr det.
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
          Kunden skal informeres før nye underdatabehandlere eller utskiftinger tas i
          bruk og kan fremme saklig innsigelse. Underdatabehandlere skal
          pålegges tilsvarende personvernforpliktelser.
        </p>
        <p>
          Cloudflare brukes til drift, database og fillagring. Supabase brukes
          til innlogging, og Resend til systemepost som invitasjoner.
          Valgfrie tilkoblinger til Google, Microsoft og sosiale kanaler
          behandler opplysninger når kunden aktiverer og bruker dem.
          Se <Link href="/personvern">personvernerklæringen</Link> for en
          beskrivelse av hvilke opplysninger som deles med hver tjeneste.
          Leverandøren er ansvarlig overfor kunden for underdatabehandlernes
          oppfyllelse av pliktene etter denne avtalen.
        </p>
        <h2>Behandlingssteder og overføringer</h2>
        <p>
          Tjenesten bruker internasjonale skyleverandører. Behandling og
          support kan innebære tilgang fra land utenfor EØS. Overføring på
          kundens vegne skal bare skje etter dokumentert instruks og med
          gyldig overføringsgrunnlag etter personvernforordningen kapittel V.
          Kunden kan be om oversikt over aktuelle behandlingssteder,
          underdatabehandlere og overføringsgrunnlag.
        </p>
        <h2>Bistand og kontroll</h2>
        <p>
          Leverandøren bistår rimelig med innsyn, retting, sletting,
          dataportabilitet, risikovurderinger og tilsyn. Kunden kan be om
          relevant dokumentasjon og gjennomføre eller få gjennomført
          nødvendige revisjoner og inspeksjoner etter nærmere avtale om
          gjennomføring og konfidensialitet. Leverandøren skal bidra til
          kontrollen. Ekstraordinær bistand kan faktureres når den
          skyldes kundens forhold eller går utover ordinær drift.
        </p>
        <h2>Sletting og retur</h2>
        <p>
          Ved avslutning kan kunden eksportere data. Data slettes normalt 90
          dager etter deaktivering, med mindre kunden ber om tidligere sletting
          eller lov krever fortsatt lagring. Sikkerhetskopier fases ut etter
          leverandørens ordinære rotasjon.
        </p>
        <h2>Kontakt og instrukser</h2>
        <p>
          Kundens autoriserte kontaktperson kan sende dokumenterte instrukser,
          spørsmål og forespørsler om innsyn, eksport eller sletting til{" "}
          <a href="mailto:jfn@noracre.no">jfn@noracre.no</a>.
          Avtalen og kundens bruk av de bestilte funksjonene utgjør kundens
          dokumenterte instruks. Andre formål krever særskilt skriftlig avtale.
        </p>
      </article>
    </main>
  );
}
