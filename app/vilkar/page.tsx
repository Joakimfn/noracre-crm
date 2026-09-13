import Link from "next/link";

export default function Vilkar() {
  return (
    <main className="legal-page">
      <article>
        <Link href="/">← Tilbake til Noracre CRM</Link>
        <p className="eyebrow">SIST OPPDATERT 13. SEPTEMBER 2026</p>
        <h1>Bruksvilkår for Noracre CRM</h1>
        <p>
          Noracre CRM leveres av Joakim Ferdinand Nygård under navnet Noracre.
          Vilkårene gjelder mellom leverandøren og virksomheten
          som bestiller tjenesten. Tjenesten er beregnet for næringsdrivende.
          Personen som godkjenner vilkårene bekrefter at vedkommende kan binde
          virksomheten.
        </p>
        <p>
          Kundens opplysninger og avtalte tjenester fremgår av det aksepterte
          tilbudet eller ordrebekreftelsen. Skriftlig avtalte særvilkår går
          foran disse bruksvilkårene ved motstrid. Kontakt Noracre på{" "}
          <a href="mailto:jfn@noracre.no">jfn@noracre.no</a>.
        </p>
        <h2>Tjenesten</h2>
        <p>
          Noracre CRM leveres som en løpende nettjeneste og utvikles
          fortløpende. Funksjoner kan endres når det er nødvendig for sikkerhet,
          drift, lovkrav eller produktutvikling. Vesentlige negative endringer
          varsles så langt det er praktisk mulig.
        </p>
        <h2>Pris og betaling</h2>
        <p>
          Pris avtales individuelt med hver kundevirksomhet. Avtalt månedspris
          per aktiv CRM-bruker og per brukerlisens for tilleggsmoduler vises
          før aktivering. Nye brukere og modullisenser krever prisbekreftelse
          fra en administrator. Eventuelle etableringsgebyrer må avtales
          særskilt. Prisendringer følger avtalen med virksomheten.
          Merverdiavgift kommer i tillegg når det er relevant.
        </p>
        <p>
          Faktureringsperiode, betalingsfrist, eventuell bindingstid og
          oppsigelsesfrist fremgår av det skriftlige tilbudet som kunden
          godkjenner før oppstart. Oppsigelse sendes skriftlig til Noracre.
        </p>
        <h2>Kundens ansvar</h2>
        <p>
          Kunden er behandlingsansvarlig for personopplysninger og annet innhold
          kunden legger inn. Kunden må ha lovlig behandlingsgrunnlag, begrense
          tilgangen til personer med tjenstlig behov, holde brukerkontoer
          oppdatert og ikke registrere særlige kategorier personopplysninger med
          mindre dette er uttrykkelig avtalt. Innlogging skal ikke deles.
        </p>
        <h2>Tilgjengelighet, datatap og sikkerhet</h2>
        <p>
          Leverandøren bruker rimelige tekniske og organisatoriske tiltak for å
          beskytte konfidensialitet, integritet og tilgjengelighet. Ingen
          nettjeneste kan garanteres helt uten nedetid, feil,
          sikkerhetshendelser eller datatap. Kunden skal derfor eksportere en
          egen kopi av forretningskritiske data med jevne mellomrom.
        </p>
        <p>
          Planlagt vedlikehold, feil hos underleverandører, internett- og
          strømbrudd, angrep, force majeure og andre forhold utenfor
          leverandørens rimelige kontroll kan påvirke tjenesten. Leverandøren
          skal arbeide for å begrense konsekvensene og gjenopprette tjenesten så
          raskt som rimelig.
        </p>
        <h2>Ansvarsbegrensning</h2>
        <p>
          Så langt ufravikelig lov tillater det, er leverandøren ikke ansvarlig
          for indirekte tap, følgeskader, tapt fortjeneste, tapte inntekter,
          tapte avtaler, omdømmetap eller kostnader til å rekonstruere data.
          Leverandørens samlede ansvar i en tolvmånedersperiode er begrenset til
          abonnementet kunden faktisk har betalt de siste tre månedene før
          kravet oppstod.
        </p>
        <p>
          Begrensningen gjelder ikke ansvar som ikke lovlig kan begrenses, eller
          tap som skyldes forsett eller grov uaktsomhet. Kunden må varsle
          skriftlig om et krav uten ugrunnet opphold.
        </p>
        <h2>Personvern og databehandling</h2>
        <p>
          Når leverandøren behandler personopplysninger på kundens vegne,
          gjelder <Link href="/databehandleravtale">databehandleravtalen</Link>{" "}
          som del av avtalen. Kunden er behandlingsansvarlig og leverandøren er
          databehandler. Sikkerhetshendelser håndteres etter gjeldende
          personvernregler.
        </p>
        <h2>Suspensjon og avslutning</h2>
        <p>
          Tilgang kan suspenderes ved manglende betaling, sikkerhetsrisiko,
          ulovlig bruk eller vesentlig mislighold. Ved oppsigelse får kunden
          anledning til å eksportere egne data. Etter deaktivering beholdes data
          normalt i 90 dager før sletting, med mindre lov eller skriftlig avtale
          krever noe annet.
        </p>
        <h2>Lovvalg og tvister</h2>
        <p>
          Avtalen reguleres av norsk rett. Partene skal først forsøke å løse
          tvister gjennom dialog. Dersom dette ikke lykkes, behandles saken av
          leverandørens alminnelige verneting, med mindre ufravikelig lov krever
          noe annet.
        </p>
        <h2>Kontakt</h2>
        <p>Spørsmål om avtalen, fakturering eller oppsigelse sendes til{" "}
          <a href="mailto:jfn@noracre.no">jfn@noracre.no</a>.
        </p>
      </article>
    </main>
  );
}
