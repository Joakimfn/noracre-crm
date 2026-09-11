import Link from "next/link";

export default function Personvern() {
  return (
    <main className="legal-page">
      <article>
        <Link href="/om">← Om Noracre CRM</Link>
        <p className="eyebrow">SIST OPPDATERT 11. SEPTEMBER 2026</p>
        <h1>Personvernerklæring</h1>
        <p>
          Noracre CRM behandler opplysninger som er nødvendige for å levere
          tjenesten: brukernes navn og e-post, samt kundeopplysninger,
          kontaktpersoner, notater, vedlegg og aktivitetshistorikk som
          virksomheten selv registrerer.
        </p>
        <h2>Formål og behandlingsansvar</h2>
        <p>
          Virksomheten som bruker Noracre CRM er behandlingsansvarlig for
          opplysningene den legger inn. Leverandøren behandler opplysningene som
          databehandler for å drifte, sikre, feilsøke og støtte tjenesten. Se
          også <Link href="/databehandleravtale">databehandleravtalen</Link>.
        </p>
        <h2>Lagring og tilgang</h2>
        <p>
          Opplysningene lagres adskilt per kundeorganisasjon. Tilgang
          kontrolleres på serveren etter aktiv bruker, organisasjon og rolle.
          Supporttilgang er tidsbegrenset og krever kundens godkjenning.
          Administrative handlinger loggføres.
        </p>
        <h2>Google-konto og e-postsending</h2>
        <p>Google-tilkoblingen er valgfri. Når du kobler til, får Noracre tilgang til identiteten og e-postadressen til kontoen du godkjenner, samt tilgangsnøkler som brukes til å sende e-post gjennom Gmail API. Tilgangene er openid, email og gmail.send. Noracre mottar ikke Google-passordet ditt.</p>
        <p>Tilgangen brukes til å vise hvilken konto som er tilkoblet og sende de meldingene du bekrefter i CRM-et. Ved sending behandler vi avsender, mottakere, emne, meldingstekst og valgte vedlegg og overfører dem til Google for levering. Google leverer meldingen til mottakerne og lagrer den i Sendt-mappen. Masseutsendinger bruker blindkopi for mottakerne.</p>
        <p>Integrasjonen leser ikke innboksen, eksisterende meldinger, Google-kontakter eller kalenderen. CRM-opplysninger du selv registrerer, er adskilt fra denne tilgangen. Vi lagrer tilkoblet e-postadresse, leverandør, tidspunkt for oppdatering og krypterte tilgangsnøkler knyttet til brukeren og bedriften. For å unngå doble sendinger lagres også en avledet identifikator, sendestatus og tidspunkt; denne sendeloggen inneholder ikke meldingstekst eller vedlegg.</p>
        <h2>Bruk og deling av Google-data</h2>
        <p>Google-data brukes bare til å levere og sikre e-postfunksjonen brukeren har valgt. De selges ikke, brukes ikke til annonsering eller profilering, og brukes ikke til å trene generelle AI- eller maskinlæringsmodeller. Tilgangen gir ikke Noracre rett til å bruke innholdet til andre formål.</p>
        <p>Noracres bruk og overføring til andre apper av opplysninger mottatt fra Google API-er skal følge <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, inkludert kravene til Limited Use. Eventuell menneskelig tilgang begrenses til det som er nødvendig med brukerens godkjenning, for sikkerhet eller for å oppfylle lovpålagte plikter.</p>
        <h2>Leverandører og sikkerhet</h2>
        <p>Cloudflare kjører CRM-et og lagrer CRM-data, vedlegg og krypterte e-posttilkoblinger. Supabase håndterer innlogging. Resend brukes til systemepost, som invitasjoner. Kundemeldinger fra din tilkoblede Google-konto sendes gjennom Google, ikke Resend. Microsoft behandler tilsvarende kontoinformasjon og meldinger når en Microsoft-tilkobling er aktivert og brukes. GitHub brukes til kildekoden og er ikke lagringssted for e-posttilgangsnøkler.</p>
        <p>Opplysninger sendes over HTTPS. E-posttilgangsnøkler krypteres på serveren og knyttes til den enkelte brukeren og kundeorganisasjonen. Driftsleverandører behandler opplysninger for å levere sine tjenester. Mottakere og deres e-postleverandører får opplysningene som inngår i e-posten du sender.</p>
        <h2>Koble fra, lagring og sletting</h2>
        <p>Velg «Koble fra» under «Din e-postkonto» i innstillingene for å fjerne den lagrede kontotilkoblingen og tilgangsnøklene fra Noracres aktive database. Du kan også trekke tilbake Noracres tilgang under tredjepartstilkoblinger i Google-kontoen din. Frakobling sletter ikke allerede sendte meldinger hos Google eller mottakerne, og sletter ikke kundedata eller vedlegg du har lagret separat i CRM-et.</p>
        <p>CRM-data beholdes mens bedriften bruker tjenesten og til de slettes. Deaktivering av en bruker eller bedrift er ikke det samme som sletting. Kontakt oss for sletting av konto, CRM-data eller gjenværende tekniske sendelogger. Oppgi hvilken konto eller bedrift henvendelsen gjelder, slik at vi kan kontrollere tilgangen før sletting. Vi opplyser om omfang og tidspunkt, og om eventuelle opplysninger som må beholdes etter loven.</p>
        <h2>Dine rettigheter</h2>
        <p>
          Registrerte kan be den aktuelle kundevirksomheten om innsyn, retting,
          sletting, begrensning eller dataportabilitet. Leverandøren bistår
          kunden når det er nødvendig.
        </p>
        <h2>Kontakt</h2>
        <p>Kontakt for Noracre CRM: Joakim Ferdinand Nygård, <a href="mailto:jfn@noracre.no">jfn@noracre.no</a>. Du kan bruke adressen til spørsmål, innsynsforespørsler og forespørsler om sletting. Du kan også klage til Datatilsynet dersom du mener opplysningene dine behandles i strid med personvernreglene.</p>
      </article>
    </main>
  );
}
