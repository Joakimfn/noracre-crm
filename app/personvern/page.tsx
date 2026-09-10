import Link from "next/link";

export default function Personvern() {
  return (
    <main className="legal-page">
      <article>
        <Link href="/">← Tilbake til Noracre CRM</Link>
        <p className="eyebrow">SIST OPPDATERT 9. SEPTEMBER 2026</p>
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
        <h2>Lagringstid</h2>
        <p>
          Aktive kunder lagrer opplysninger så lenge tjenesten brukes. Etter
          deaktivering beholdes data normalt i 90 dager slik at kunden kan
          eksportere dem, før sletting eller anonymisering. Lovpålagte
          opplysninger kan beholdes lenger.
        </p>
        <h2>Dine rettigheter</h2>
        <p>
          Registrerte kan be den aktuelle kundevirksomheten om innsyn, retting,
          sletting, begrensning eller dataportabilitet. Leverandøren bistår
          kunden når det er nødvendig.
        </p>
        <p className="legal-note">
          Før kommersiell lansering må leverandørens foretaksnavn,
          organisasjonsnummer, kontaktinformasjon, konkret liste over
          underdatabehandlere og lagringsområder fylles inn.
        </p>
      </article>
    </main>
  );
}
