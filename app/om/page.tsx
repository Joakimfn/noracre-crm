import Link from "next/link";
export const metadata = { title: "Om Noracre CRM", description: "Kunder, kontaktpersoner, oppfølging og e-post samlet i Noracre CRM." };
export default function AboutNoracre() {
  return <main className="legal-page"><article>
    <img src="/noracre-logo-primary.svg" alt="Noracre" style={{width:200,maxWidth:"100%",height:"auto",marginBottom:24}}/>
    <h1>Noracre CRM</h1>
    <p>Noracre er et CRM for bedrifter som vil samle kunder, kontaktpersoner og salgsoppfølging på ett sted. Medarbeidere kan registrere samtaler og møter, skrive notater, legge ved dokumenter og planlegge neste kontakt med kunden.</p>
    <p><Link href="/">Åpne CRM-et og logg inn →</Link></p>
    <h2>Oversikt over kunder og oppfølging</h2>
    <p>Kundekortet samler bedriftens kontaktpersoner, status, aktiviteter og historikk. Separate oppfølginger gjør at flere medarbeidere kan planlegge kontakt med samme bedrift. Tilgang til bedriftens opplysninger krever innlogging og en aktiv brukertilgang.</p>
    <h2>Send e-post fra din Google-konto</h2>
    <p>Du kan koble til din egen Google Workspace- eller Gmail-konto i innstillingene. Etter at du har godkjent tilgangen hos Google, kan du sende kundemeldinger og tilbud med vedlegg fra denne kontoen inne i Noracre. Meldingen sendes gjennom Gmail og lagres i kontoens Sendt-mappe.</p>
    <p>Noracre ber om tilgang til å identifisere e-postkontoen og sende e-post på dine vegne. Tilkoblingen henter ikke innboksen eller eksisterende e-posthistorikk. Du velger selv mottaker, innhold og vedlegg og bekrefter sendingen. Du kan koble fra kontoen i innstillingene.</p>
    <h2>Microsoft 365</h2>
    <p>Noracre har også støtte i systemet for sending gjennom en tilkoblet Microsoft-konto. Tilkoblingen blir tilgjengelig når leverandøroppsettet er aktivert.</p>
    <h2>Personvern og kontakt</h2>
    <p>Les hvordan opplysninger behandles i <Link href="/personvern">personvernerklæringen</Link>, <Link href="/vilkar">bruksvilkårene</Link> og <Link href="/databehandleravtale">databehandleravtalen</Link>.</p>
    <p>Spørsmål om Noracre eller personvern: <a href="mailto:jfn@noracre.no">jfn@noracre.no</a>.</p>
  </article></main>;
}
