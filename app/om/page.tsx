import {LegalText} from "@/components/legal-text";
import {translateLegal} from "@/lib/legal-i18n";
import {resolveLocale} from "@/lib/i18n/config";
import {cookies} from "next/headers";
import Link from "next/link";
export default function AboutNoracre() {
  return <main className="legal-page"><article>
    <img src="/noracre-logo-primary.svg" alt="Noracre" style={{width:200,maxWidth:"100%",height:"auto",marginBottom:24}}/>
    <h1><LegalText text={"Noracre CRM"} /></h1>
    <p><LegalText text={"Noracre er et CRM for bedrifter som vil samle kunder, kontaktpersoner og salgsoppfølging på ett sted. Medarbeidere kan registrere samtaler og møter, skrive notater, legge ved dokumenter og planlegge neste kontakt med kunden."} /></p>
    <p><Link href="/"><LegalText text={"Åpne CRM-et og logg inn →"} /></Link></p>
    <h2><LegalText text={"Oversikt over kunder og oppfølging"} /></h2>
    <p><LegalText text={"Kundekortet samler bedriftens kontaktpersoner, status, aktiviteter og historikk. Separate oppfølginger gjør at flere medarbeidere kan planlegge kontakt med samme bedrift. Tilgang til bedriftens opplysninger krever innlogging og en aktiv brukertilgang."} /></p>
    <h2><LegalText text={"Send e-post fra din Google-konto"} /></h2>
    <p><LegalText text={"Du kan koble til din egen Google Workspace- eller Gmail-konto i innstillingene. Etter at du har godkjent tilgangen hos Google, kan du sende kundemeldinger og tilbud med vedlegg fra denne kontoen inne i Noracre. Meldingen sendes gjennom Gmail og lagres i kontoens Sendt-mappe."} /></p>
    <p><LegalText text={"Noracre ber om tilgang til å identifisere e-postkontoen og sende e-post på dine vegne. Tilkoblingen henter ikke innboksen eller eksisterende e-posthistorikk. Du velger selv mottaker, innhold og vedlegg og bekrefter sendingen. Du kan koble fra kontoen i innstillingene."} /></p>
    <h2><LegalText text={"Microsoft 365"} /></h2>
    <p><LegalText text={"Noracre har også støtte i systemet for sending gjennom en tilkoblet Microsoft-konto. Tilkoblingen blir tilgjengelig når leverandøroppsettet er aktivert."} /></p>
    <h2><LegalText text={"Personvern og kontakt"} /></h2>
    <p><LegalText text={"Les hvordan opplysninger behandles i "} /><Link href="/personvern"><LegalText text={"personvernerklæringen"} /></Link><LegalText text={", "} /><Link href="/vilkar"><LegalText text={"bruksvilkårene"} /></Link><LegalText text={" og "} /><Link href="/databehandleravtale"><LegalText text={"databehandleravtalen"} /></Link><LegalText text={"."} /></p>
    <p><LegalText text={"Spørsmål om Noracre eller personvern: "} /><a href="mailto:jfn@noracre.no"><LegalText text={"jfn@noracre.no"} /></a><LegalText text={"."} /></p>
  </article></main>;
}

export async function generateMetadata(){const locale=resolveLocale((await cookies()).get('noracre-language')?.value);return {title:translateLegal("Om Noracre CRM",locale),description:translateLegal("Kunder, kontaktpersoner, oppfølging og e-post samlet i Noracre CRM.",locale)};}
