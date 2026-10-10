import {LegalText} from "@/components/legal-text";
import {translateLegal} from "@/lib/legal-i18n";
import {resolveLocale} from "@/lib/i18n/config";
import {cookies} from "next/headers";
import Link from "next/link";

export default function Vilkar() {
  return (
    <main className="legal-page">
      <article>
        <Link href="/"><LegalText text={"← Tilbake til Noracre CRM"} /></Link>
        <p className="eyebrow"><LegalText text={"SIST OPPDATERT 13. SEPTEMBER 2026"} /></p>
        <h1><LegalText text={"Bruksvilkår for Noracre CRM"} /></h1>
        <p><LegalText text={"Noracre CRM leveres av Joakim Ferdinand Nygård under navnet Noracre. Vilkårene gjelder mellom leverandøren og virksomheten som bestiller tjenesten. Tjenesten er beregnet for næringsdrivende. Personen som godkjenner vilkårene bekrefter at vedkommende kan binde virksomheten."} /></p>
        <p><LegalText text={"Kundens opplysninger og avtalte tjenester fremgår av det aksepterte tilbudet eller ordrebekreftelsen. Skriftlig avtalte særvilkår går foran disse bruksvilkårene ved motstrid. Kontakt Noracre på"} />{" "}
          <a href="mailto:jfn@noracre.no"><LegalText text={"jfn@noracre.no"} /></a><LegalText text={"."} /></p>
        <h2><LegalText text={"Tjenesten"} /></h2>
        <p><LegalText text={"Noracre CRM leveres som en løpende nettjeneste og utvikles fortløpende. Funksjoner kan endres når det er nødvendig for sikkerhet, drift, lovkrav eller produktutvikling. Vesentlige negative endringer varsles så langt det er praktisk mulig."} /></p>
        <h2><LegalText text={"Pris og betaling"} /></h2>
        <p><LegalText text={"Pris avtales individuelt med hver kundevirksomhet. Avtalt månedspris per aktiv CRM-bruker og per brukerlisens for tilleggsmoduler vises før aktivering. Nye brukere og modullisenser krever prisbekreftelse fra en administrator. Eventuelle etableringsgebyrer må avtales særskilt. Prisendringer følger avtalen med virksomheten. Merverdiavgift kommer i tillegg når det er relevant."} /></p>
        <p><LegalText text={"Faktureringsperiode, betalingsfrist, eventuell bindingstid og oppsigelsesfrist fremgår av det skriftlige tilbudet som kunden godkjenner før oppstart. Oppsigelse sendes skriftlig til Noracre."} /></p>
        <h2><LegalText text={"Kundens ansvar"} /></h2>
        <p><LegalText text={"Kunden er behandlingsansvarlig for personopplysninger og annet innhold kunden legger inn. Kunden må ha lovlig behandlingsgrunnlag, begrense tilgangen til personer med tjenstlig behov, holde brukerkontoer oppdatert og ikke registrere særlige kategorier personopplysninger med mindre dette er uttrykkelig avtalt. Innlogging skal ikke deles."} /></p>
        <h2><LegalText text={"Tilgjengelighet, datatap og sikkerhet"} /></h2>
        <p><LegalText text={"Leverandøren bruker rimelige tekniske og organisatoriske tiltak for å beskytte konfidensialitet, integritet og tilgjengelighet. Ingen nettjeneste kan garanteres helt uten nedetid, feil, sikkerhetshendelser eller datatap. Kunden skal derfor eksportere en egen kopi av forretningskritiske data med jevne mellomrom."} /></p>
        <p><LegalText text={"Planlagt vedlikehold, feil hos underleverandører, internett- og strømbrudd, angrep, force majeure og andre forhold utenfor leverandørens rimelige kontroll kan påvirke tjenesten. Leverandøren skal arbeide for å begrense konsekvensene og gjenopprette tjenesten så raskt som rimelig."} /></p>
        <h2><LegalText text={"Ansvarsbegrensning"} /></h2>
        <p><LegalText text={"Så langt ufravikelig lov tillater det, er leverandøren ikke ansvarlig for indirekte tap, følgeskader, tapt fortjeneste, tapte inntekter, tapte avtaler, omdømmetap eller kostnader til å rekonstruere data. Leverandørens samlede ansvar i en tolvmånedersperiode er begrenset til abonnementet kunden faktisk har betalt de siste tre månedene før kravet oppstod."} /></p>
        <p><LegalText text={"Begrensningen gjelder ikke ansvar som ikke lovlig kan begrenses, eller tap som skyldes forsett eller grov uaktsomhet. Kunden må varsle skriftlig om et krav uten ugrunnet opphold."} /></p>
        <h2><LegalText text={"Personvern og databehandling"} /></h2>
        <p><LegalText text={"Når leverandøren behandler personopplysninger på kundens vegne, gjelder "} /><Link href="/databehandleravtale"><LegalText text={"databehandleravtalen"} /></Link>{" "}<LegalText text={"som del av avtalen. Kunden er behandlingsansvarlig og leverandøren er databehandler. Sikkerhetshendelser håndteres etter gjeldende personvernregler."} /></p>
        <h2><LegalText text={"Suspensjon og avslutning"} /></h2>
        <p><LegalText text={"Tilgang kan suspenderes ved manglende betaling, sikkerhetsrisiko, ulovlig bruk eller vesentlig mislighold. Ved oppsigelse får kunden anledning til å eksportere egne data. Etter deaktivering beholdes data normalt i 90 dager før sletting, med mindre lov eller skriftlig avtale krever noe annet."} /></p>
        <h2><LegalText text={"Lovvalg og tvister"} /></h2>
        <p><LegalText text={"Avtalen reguleres av norsk rett. Partene skal først forsøke å løse tvister gjennom dialog. Dersom dette ikke lykkes, behandles saken av leverandørens alminnelige verneting, med mindre ufravikelig lov krever noe annet."} /></p>
        <h2><LegalText text={"Kontakt"} /></h2>
        <p><LegalText text={"Spørsmål om avtalen, fakturering eller oppsigelse sendes til"} />{" "}
          <a href="mailto:jfn@noracre.no"><LegalText text={"jfn@noracre.no"} /></a><LegalText text={"."} /></p>
      </article>
    </main>
  );
}

export async function generateMetadata(){const locale=resolveLocale((await cookies()).get('noracre-language')?.value);return {title:translateLegal("Bruksvilkår for Noracre CRM",locale),description:translateLegal("Bruksvilkår for Noracre CRM.",locale)};}
