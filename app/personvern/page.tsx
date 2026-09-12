import Link from "next/link";

export const metadata = {
  title: "Personvernerklæring / Privacy Policy | Noracre CRM",
  description: "Hvordan Noracre CRM får tilgang til, bruker, deler, beskytter og sletter Google-brukerdata.",
};

export default function Personvern() {
  return (
    <main className="legal-page">
      <article>
        <Link href="/om">← Om Noracre CRM</Link>
        <p className="eyebrow">SIST OPPDATERT 12. SEPTEMBER 2026</p>
        <h1>Personvernerklæring for Noracre CRM</h1>
        <p>Denne erklæringen gjelder Noracre CRM på crm.noracre.no, inkludert den valgfrie tilkoblingen til Google Workspace og Gmail. Kontakt for tjenesten er Joakim Ferdinand Nygård, <a href="mailto:jfn@noracre.no">jfn@noracre.no</a>.</p>
        <p><a href="#google-data">Behandling av Google-data</a> · <a href="#english" lang="en">English: Google user data privacy summary</a></p>
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
        <h2 id="google-data">1. Hvilke Google-data får Noracre CRM tilgang til?</h2>
        <p>Google-tilkoblingen er valgfri. Når du kobler til, får Noracre tilgang til identiteten og e-postadressen til kontoen du godkjenner, samt tilgangsnøkler som brukes til å sende e-post gjennom Gmail API. Tilgangene er openid, email og gmail.send. Noracre mottar ikke Google-passordet ditt.</p>
        <h2>2. Hva brukes Google-dataene til?</h2>
        <p>Tilgangen brukes til å vise hvilken konto som er tilkoblet og sende de meldingene du bekrefter i CRM-et. Ved sending behandler vi avsender, mottakere, emne, meldingstekst og valgte vedlegg og overfører dem til Google for levering. Google leverer meldingen til mottakerne og lagrer den i Sendt-mappen. Masseutsendinger bruker blindkopi for mottakerne.</p>
        <p>Integrasjonen leser ikke innboksen, eksisterende meldinger, Google-kontakter eller kalenderen. CRM-opplysninger du selv registrerer, er adskilt fra denne tilgangen. Vi lagrer tilkoblet e-postadresse, leverandør, tidspunkt for oppdatering og krypterte tilgangsnøkler knyttet til brukeren og bedriften. For å unngå doble sendinger lagres også en avledet identifikator, sendestatus og tidspunkt; denne sendeloggen inneholder ikke meldingstekst eller vedlegg.</p>
        <h2>Begrensninger i bruken av Google-data</h2>
        <p>Google-data brukes bare til å levere og sikre e-postfunksjonen brukeren har valgt. De selges ikke, brukes ikke til annonsering eller profilering, og brukes ikke til å trene generelle AI- eller maskinlæringsmodeller. Tilgangen gir ikke Noracre rett til å bruke innholdet til andre formål.</p>
        <p>Noracres bruk og overføring til andre apper av opplysninger mottatt fra Google API-er skal følge <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, inkludert kravene til Limited Use. Eventuell menneskelig tilgang begrenses til det som er nødvendig med brukerens godkjenning, for sikkerhet eller for å oppfylle lovpålagte plikter.</p>
        <h2>3. Hvem mottar Google-data og andre opplysninger?</h2>
        <p>Cloudflare kjører CRM-et og lagrer CRM-data, vedlegg og krypterte e-posttilkoblinger. Supabase håndterer innlogging. Resend brukes til systemepost, som invitasjoner. Kundemeldinger fra din tilkoblede Google-konto sendes gjennom Google, ikke Resend. Microsoft behandler tilsvarende kontoinformasjon og meldinger når en Microsoft-tilkobling er aktivert og brukes. GitHub brukes til kildekoden og er ikke lagringssted for e-posttilgangsnøkler.</p>
        <p>Google-data deles med Cloudflare for å kjøre funksjonen og lagre kontotilkoblingen, og med Google for å autentisere kontoen og levere e-post. De mottakerne du velger, og deres e-postleverandører, mottar meldingen og vedleggene. Google-tilgangsnøkler og kundemeldinger deles ikke med Resend eller GitHub. Utlevering utover tjenesteleveransen kan skje når loven krever det.</p>
        <h2>4. Hvordan beskyttes Google-data?</h2>
        <p>Opplysninger sendes over HTTPS. E-posttilgangsnøkler krypteres på serveren med AES-GCM og knyttes til den enkelte brukeren og kundeorganisasjonen. Serveren kontrollerer aktiv brukertilgang før kontotilkobling og sending. Andre kundeorganisasjoner får ikke tilgang til tilkoblingen. Tilgangsnøkler vises ikke i kontostatusen som sendes til nettleseren.</p>
        <h2>5. Hvor lenge lagres Google-data, og hvordan slettes de?</h2>
        <p>Den tilkoblede e-postadressen og de krypterte tilgangsnøklene lagres så lenge kontotilkoblingen beholdes. Noracre lagrer ikke et eget e-postarkiv over sendte meldinger. Meldingstekst og vedlegg behandles under sending; dokumenter som du selv har lagret i CRM-et, er separate kundedata. Tekniske sendelogger med avledet identifikator, status og tidspunkt beholdes for å hindre gjentatt sending. Disse har foreløpig ingen automatisk slettefrist og slettes ikke når du kobler fra kontoen; kontakt oss dersom du ønsker dem slettet.</p>
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
        <section id="english" lang="en" aria-labelledby="english-title">
          <h2 id="english-title">English: Google user data privacy summary</h2>
          <p>This summary describes the same Google data practices as the Norwegian policy above. It applies to Noracre CRM at crm.noracre.no. Service contact: Joakim Ferdinand Nygård, <a href="mailto:jfn@noracre.no">jfn@noracre.no</a>.</p>
          <p><strong>Data accessed.</strong> Connecting Google Workspace or Gmail is optional. Noracre CRM requests openid, email and https://www.googleapis.com/auth/gmail.send. We receive account identity information, the verified email address and OAuth access and refresh tokens. We do not receive your Google password or read your inbox, existing emails, contacts or calendar.</p>
          <p><strong>Data use.</strong> We identify the connected sender account and send messages you confirm in the CRM. We process the sender, recipients, subject, body and selected attachments and transmit them to Gmail for delivery. We store the connected email address, provider, update timestamp and encrypted tokens associated with your CRM membership and organization. Technical send records contain a derived identifier, status and timestamp, not message bodies or attachments.</p>
          <p><strong>Data sharing.</strong> Cloudflare processes the connection data and outgoing messages to run the service. Google authenticates the account and delivers messages to your selected recipients and their email providers. Resend handles separate system emails, such as invitations; Google OAuth tokens and customer messages are not shared with Resend or GitHub. Other disclosure may occur when required by law.</p>
          <p><strong>Data protection.</strong> Data is transmitted over HTTPS. OAuth tokens are encrypted on the server using AES-GCM and tied to the individual membership and organization. Server access checks require an active user and organization. Account status responses do not expose OAuth tokens to the browser.</p>
          <p><strong>Retention and deletion.</strong> The account address and encrypted tokens remain stored while the connection is retained. Choose “Koble fra” (Disconnect) under “Din e-postkonto” in Settings to delete the connection and tokens from the active database. You can also revoke access in your Google Account’s third-party connections. Noracre does not keep a separate archive of sent email. Technical send records currently have no automatic expiry and remain after disconnection. To request deletion of these records, your account or separately stored CRM data, email jfn@noracre.no and identify the account or organization. We verify your authority and explain the deletion scope, timing and any legally required retention. Disconnecting does not delete messages already held by Google or recipients, or documents separately saved in the CRM.</p>
          <p><strong>Limited Use.</strong> Google user data is used only to provide and secure the requested email feature. It is not sold or used for advertising, profiling, or developing, improving or training generalized or non-personalized AI or machine-learning models. Noracre CRM’s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including its Limited Use requirements.</p>
        </section>
      </article>
    </main>
  );
}
