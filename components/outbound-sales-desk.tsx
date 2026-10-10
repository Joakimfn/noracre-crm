"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {ArrowLeft, ArrowRight, BarChart3, BookOpen, CalendarClock, CheckCircle, ExternalLink, History, LockKeyhole, Phone, RefreshCw, Search, Settings, ShieldAlert, Target, Users} from "lucide-react";
import {toast} from "sonner";
import {useCrmApi, useDemoMode} from "@/lib/crm-api";
import {useI18n} from "@/lib/i18n/react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {marketDefaults, normalizeOutboundRules, defaultOutboundRules, outboundPlaybook} from "@/lib/outbound-markets";
import {currencyScale, dateTimeInZone, dateTimeToUtc, meetingConversionRate, liveOutboundEligibility, outboundQueue, parseMinorAmount, safeOutboundWebsite} from "@/lib/outbound-workspace";
import {homeCountries} from "@/lib/home-countries";
import "./outbound-sales-desk.css";

type Rules = ReturnType<typeof normalizeOutboundRules>;
type PlaybookOverrides = Record<string, {phoneScript?: string; emailSubject?: string; emailBody?: string; productInfo?: string}>;
type Config = {playbooks?: PlaybookOverrides; commissionMonths?: number; enabled: boolean; currency: string; timezone: string; commissionBps: number; pitch: string; country?: string; marketRules?: Rules};
type LeadState = {assignedMembershipId: number; attempts: number; pipeline: string; nextCallAt: string; lastOutcome: string; lastNote: string; contactName: string; contactPhone: string; doNotContact: boolean; contactPermission?: boolean; contactPermissionNote?: string};
type Lead = {
  id: number; name: string; country: string; orgNumber: string; city: string; industry: string;
  employees: number | null; employeeRange: string; phone: string; website: string; email: string;
  address?: string; postalCode?: string; employeeRangeYear?: string; revenue?: number | null; customerId?: number; status: string; assignedMembershipId: number; suppressed: boolean; state: LeadState | null;
  eligible?: boolean; eligibility?: {eligible: boolean; reason: string};
};
type Deal = {id: number; entryId: number; pipeline: string; membershipId: number; monthlyAmountMinor: number; currency: string; commissionBps: number; note: string; commissionMonths?: number; commissionAgreedAt?: string; customerCompanyId?: number; customerOrganizationId?: number; subscriptionActivatedAt?: string; subscriptionCancelledAt?: string};
type Payment = {id: number; entryId: number; membershipId: number; paidAmountMinor: number; currency: string; commissionBps: number; paymentReference: string; createdAt?: string; receivedAt?: string; commissionAmountMinor?: number; refundPaymentId?: number};
type CallLog = {id: number; entryId: number; membershipId: number; membershipName?: string; name?: string; outcome: string; note: string; nextCallAt: string; createdAt: string};
type Member = {id: number; name: string; active: boolean; canCall?: boolean};
type Metrics = {attempts: number; uniqueCalled: number; conversations: number; meetings: number; meetingRate?: number; conversationRate: number; stages: Record<string, number>; attendedDemos?: number; trials?: number; payingCustomers?: number};
type WorkspaceData = {
  settings: Config; rows: Lead[]; hasMore: boolean; nextOffset?: number; metrics: Metrics | null;
  deals: Deal[]; payments: Payment[]; members: Member[]; canManage: boolean; actorMembershipId?: number; organizationName?: string; customers?: {id: number; name: string}[];
  paymentTotals?: {membershipId: number; currency: string; paidMinor: number; commissionMinor: number}[];
  byMember?: {membershipId: number; name: string; attempts: number; conversations: number; meetings: number; won: number; attendedDemos?: number; trials?: number; payingCustomers?: number; commissionsByCurrency: Record<string, number>}[];
};
type Lease = {token: string; entryId: number; expiresAt: string};
type ServerQueue = "ready" | "due" | "all";
type Tab = "dial" | "pipeline" | "report" | "kit" | "settings";

const defaults: Config = {enabled: false, currency: "NOK", timezone: "Europe/Oslo", commissionBps: 0, pitch: ""};
const emptyData: WorkspaceData = {settings: defaults, rows: [], hasMore: false, metrics: null, deals: [], payments: [], members: [], canManage: false};
const outcomes = ["Ikke svar", "Sentralbord", "Feil nummer", "Beslutningstaker kontaktet", "Interessert", "Ikke interessert", "Møte booket", "Reservert mot kontakt"];
const stages = ["Prospekt", "Demo booket", "Demo gjennomført", "Prøveperiode", "Tilbud", "Kunde", "Tapt"];
const countries = homeCountries;
const translations = {
  en: {
    "Ikke svar": "No answer", "Sentralbord": "Switchboard", "Feil nummer": "Wrong number", "Beslutningstaker kontaktet": "Decision-maker reached",
    "Interessert": "Interested", "Ikke interessert": "Not relevant", "Møte booket": "Meeting booked", "Reservert mot kontakt": "Do not contact",
    "Prospekt": "Prospect", "Demo booket": "Demo booked", "Demo gjennomført": "Demo attended", "Prøveperiode": "Trial", "Tilbud": "Proposal", "Kunde": "Customer", "Tapt": "Lost",
  },
  fr: {
    "Ikke svar": "Sans réponse", "Sentralbord": "Standard", "Feil nummer": "Mauvais numéro", "Beslutningstaker kontaktet": "Décideur joint",
    "Interessert": "Intéressé", "Ikke interessert": "Non pertinent", "Møte booket": "Rendez-vous fixé", "Reservert mot kontakt": "Ne pas contacter",
    "Prospekt": "Prospect", "Demo booket": "Démo réservée", "Demo gjennomført": "Démo effectuée", "Prøveperiode": "Essai", "Tilbud": "Proposition", "Kunde": "Client", "Tapt": "Perdu",
  },
};
const languages={
  nb: {
    desk: "Outbound-salg", standard: "Vanlig ringeliste", start: "Aktiver outbound", enable: "Bedriften driver med outbound-salg", intro: "Én bedrift om gangen. Logg samtalen og velg neste oppfølging.", settingsHelp: "Hver bedrift kan velge denne arbeidsflaten.",
    dial: "Ringemodus", pipeline: "Pipeline", report: "Resultater", kit: "Salgsverktøy", setup: "Innstillinger", calls: "Ringeforsøk", talk: "Samtaler", meetings: "Møter booket", rate: "Møter / samtaler", demos: "Demo gjennomført", trials: "Prøveperiode aktivert", customers: "Betalende kunder",
    next: "Neste bedrift", back: "Forrige", save: "Lagre", noLeads: "Ingen tilgjengelige leads. Opprett eller importer en ringeliste, og tildel bedrifter til selgerne.", empty: "Ingen leads i denne køen.", import: "Opprett eller importer ringeliste", search: "Søk etter bedrift, bransje eller sted", ready: "Klare til å ringes", due: "Forfalte tilbakeringinger", allQueue: "Alle oppfølginger", scheduled: "Tilbakeringing", outcome: "Samtaleresultat", note: "Samtalenotat", contact: "Kontaktperson", number: "Telefon til beslutningstaker", google: "Finn kontakt på Google", website: "Nettside", call: "Ring", again: "Neste kontakt", callbackHelp: "Datoen gjelder den valgte tidssonen. Tomt felt gir 48 timers oppfølging ved ikke svar, sentralbord og positive samtaler.", action: "Logg og gå videre", owner: "Tildelt selger", assigned: "Tildel lead", choose: "Velg", all: "Alle selgere", done: "Reservert mot kontakt", paid: "Bekreftet innbetalt (ekskl. mva.)", income: "Avtalt månedsinntekt", commission: "Opptjent provisjon", payment: "Registrer bekreftet betaling", ref: "Faktura-/betalingsreferanse", verified: "Jeg har kontrollert at betalingen er mottatt", more: "Hent flere", week: "Aktiviteter siste 7 dager. Pipeline og betalinger viser samlet status.", saveStage: "Lagre salgsfase", currency: "Valuta", timezone: "Tidssone", commissionRate: "Provisjon (%)", saveSettings: "Lagre oppsett", info: "Kun bekreftede betalinger gir provisjon. Beløp holdes adskilt per valuta.", alert: "Bedriften skal ikke kontaktes.", loading: "Laster outbound …", retry: "Prøv igjen", saved: "Lagret", callSaved: "Samtalen er registrert", invalidAmount: "Oppgi et gyldig beløp med riktig antall desimaler for valutaen.", invalidDate: "Oppgi en gyldig dato i den valgte tidssonen. Klokkeslettet kan være hoppet over ved overgang til sommertid.", history: "Samtalehistorikk", noHistory: "Ingen samtaler registrert ennå.", historyLoading: "Laster historikk …", historyMore: "Eldre samtaler", staff: "ansatte", noStaff: "Ansatte ikke oppgitt", lastResult: "Siste resultat", unassigned: "Ikke tildelt", locking: "Reserverer bedriften …", lockReady: "Reservert for deg mens du arbeider", lockFailed: "Bedriften kan ikke ringes nå. Prøv igjen eller velg neste.", lockRetry: "Reserver igjen", anotherOwner: "Tildel bedriften til deg før du ringer.", distribute: "Fordel leads automatisk", distributeHelp: "Fordeler bedrifter jevnt mellom valgte selgere. Kopier av samme bedrift følger samme eier.", quantity: "Antall bedrifter", redistribute: "Fordel også allerede tildelte leads på nytt", distributionConfirm: "Dette flytter eierskapet til allerede tildelte leads.", chooseSellers: "Velg minst én selger.", noPayments: "Ingen bekreftede betalinger", country: "Marked", marketDefaults: "Bruk markedets valuta og tidssone", pitch: "Telefonmanus", emailTemplate: "E-postmal", emailSubject: "Emne", permission: "Kontaktregler", permissionHelp: "Bedriftens regler gjelder alle selgere. Reserverte bedrifter blokkeres alltid.", blockCountries: "Blokkerte landkoder", blockIndustries: "Blokkerte bransjer", blockRegions: "Blokkerte regioner", permissionRequired: "Krev registrert kontaktgrunnlag", contactHours: "Begrens kontakt til hverdager", from: "Fra", until: "Til", commas: "Skill flere verdier med komma.", rulesUnavailable: "Kontaktgrunnlag eller kontaktregler tillater ikke oppringing nå.", product: "Produktinformasjon", productText: "Noracre samler kundearbeid, ringelister og markedsføring i én arbeidsflate. Bruk demoen for å vise det faktiske produktet.", demo: "Åpne demo med eksempelbedrifter", faq: "Vanlige spørsmål", faqPrice: "Hva koster det?", faqPriceAnswer: "Bruk bedriftens avtalte pris. Prisavtaler godkjennes av administrator.", faqIntegrations: "Kan dere love en integrasjon?", faqIntegrationsAnswer: "Vis tilgjengelige funksjoner i demoen. Send forespørsler om nye integrasjoner til administrator før du lover noe.", objection: "Vi har allerede CRM", objectionAnswer: "Spør hvordan de jobber med prospekter og oppfølging i dag, og tilby å vise den relevante arbeidsflyten.", organizationPlaybook: "Bruk bedriftens eget manus og godkjente produktinformasjon for salget deres.", preview: "Forhåndsvis markedstilpasset mal", noOwner: "Selger", leads: "leads", callbackSave: "Lagre oppfølging", currentCurrency: "Avtalens valuta", paymentHistory: "Betalinger", noDeal: "Lagre kundetilknytning, aktivert abonnement og godkjent provisjonsavtale før du registrerer betaling.", createCustomer: "Opprett kundekort",
  },
  en: {
    desk: "Outbound sales", standard: "Standard call lists", start: "Enable outbound", enable: "Our company uses outbound sales", intro: "One company at a time. Log the call and plan the next action.", settingsHelp: "Each organization can opt into this workspace.",
    dial: "Calls", pipeline: "Pipeline", report: "Performance", kit: "Sales tools", setup: "Settings", calls: "Call attempts", talk: "Conversations", meetings: "Meetings booked", rate: "Meetings / conversations", demos: "Demos attended", trials: "Trials activated", customers: "Paying customers",
    next: "Next company", back: "Previous", save: "Save", noLeads: "No available leads. Create or import a call list and assign companies to your sellers.", empty: "No leads in this queue.", import: "Create or import a call list", search: "Search company, industry or location", ready: "Ready to call", due: "Due callbacks", allQueue: "All follow-ups", scheduled: "Callback", outcome: "Call outcome", note: "Call note", contact: "Contact person", number: "Decision-maker phone", google: "Find contact on Google", website: "Website", call: "Call", again: "Next contact", callbackHelp: "Dates use the selected time zone. Leaving this blank schedules follow-up in 48 hours for missed calls, switchboard and positive conversations.", action: "Log and continue", owner: "Assigned seller", assigned: "Assign lead", choose: "Choose", all: "All sellers", done: "Do not contact", paid: "Confirmed receipts (excluding tax)", income: "Contracted monthly revenue", commission: "Earned commission", payment: "Record confirmed payment", ref: "Invoice/payment reference", verified: "I verified that this payment was received", more: "Load more", week: "Activity in the last 7 days. Pipeline and payments show the current overall position.", saveStage: "Save stage", currency: "Currency", timezone: "Time zone", commissionRate: "Commission (%)", saveSettings: "Save settings", info: "Only confirmed payments earn commission. Currencies are reported separately.", alert: "Do not contact this company.", loading: "Loading outbound …", retry: "Retry", saved: "Saved", callSaved: "Call logged", invalidAmount: "Enter a valid amount using the decimal places supported by this currency.", invalidDate: "Enter a valid date in the selected time zone. This time may be skipped by a daylight-saving transition.", history: "Call history", noHistory: "No calls logged yet.", historyLoading: "Loading history …", historyMore: "Older calls", staff: "employees", noStaff: "Employee count not reported", lastResult: "Last outcome", unassigned: "Unassigned", locking: "Reserving this company …", lockReady: "Reserved for you while you work", lockFailed: "This company cannot be called now. Retry or choose the next company.", lockRetry: "Reserve again", anotherOwner: "Assign this company to yourself before calling.", distribute: "Distribute leads automatically", distributeHelp: "Distribute companies evenly among selected sellers. Duplicate companies keep the same owner.", quantity: "Number of companies", redistribute: "Include and reassign leads that already have an owner", distributionConfirm: "This changes the owner of previously assigned leads.", chooseSellers: "Choose at least one seller.", noPayments: "No confirmed payments", country: "Market", marketDefaults: "Use market currency and time zone", pitch: "Call script", emailTemplate: "Email template", emailSubject: "Subject", permission: "Contact rules", permissionHelp: "Organization rules apply to all sellers. Do-not-contact requests always block contact.", blockCountries: "Blocked country codes", blockIndustries: "Blocked industries", blockRegions: "Blocked regions", permissionRequired: "Require a recorded contact basis", contactHours: "Limit contact to weekdays", from: "From", until: "Until", commas: "Separate values with commas.", rulesUnavailable: "The contact basis or contact rules do not permit a call now.", product: "Product information", productText: "Noracre brings customer management, call lists and marketing into one workspace. Use the demo to show the actual product.", demo: "Open demo with sample companies", faq: "Common questions", faqPrice: "What does it cost?", faqPriceAnswer: "Use the organization's agreed price. An administrator approves pricing agreements.", faqIntegrations: "Can you promise an integration?", faqIntegrationsAnswer: "Show the available features in the demo. Refer new integration requests to an administrator before making a promise.", objection: "We already have a CRM", objectionAnswer: "Ask how they handle prospecting and follow-up today, and offer to show the relevant workflow.", organizationPlaybook: "Use your organization's own script and approved product information for your sales.", preview: "Preview market templates", noOwner: "Seller", leads: "leads", callbackSave: "Save follow-up", currentCurrency: "Contract currency", paymentHistory: "Payments", noDeal: "Save the customer link, activated subscription and approved commission agreement before recording a payment.", createCustomer: "Create customer record",
  },
  fr: {
    desk: "Ventes sortantes", standard: "Listes classiques", start: "Activer la prospection", enable: "Notre entreprise fait de la prospection", intro: "Une entreprise à la fois. Enregistrez l'appel et planifiez la suite.", settingsHelp: "Chaque organisation peut activer cet espace.",
    dial: "Appels", pipeline: "Pipeline", report: "Performances", kit: "Outils de vente", setup: "Paramètres", calls: "Tentatives d'appel", talk: "Conversations", meetings: "Rendez-vous fixés", rate: "Rendez-vous / conversations", demos: "Démos effectuées", trials: "Essais activés", customers: "Clients payants",
    next: "Entreprise suivante", back: "Précédent", save: "Enregistrer", noLeads: "Aucun prospect disponible. Créez ou importez une liste et attribuez les entreprises aux commerciaux.", empty: "Aucun prospect dans cette file.", import: "Créer ou importer une liste d’appels", search: "Rechercher entreprise, secteur ou ville", ready: "Prêts à appeler", due: "Rappels arrivés à échéance", allQueue: "Tous les suivis", scheduled: "Rappel", outcome: "Résultat d'appel", note: "Notes d'appel", contact: "Interlocuteur", number: "Téléphone du décideur", google: "Chercher le contact sur Google", website: "Site web", call: "Appeler", again: "Prochain contact", callbackHelp: "Les dates utilisent le fuseau choisi. Un champ vide planifie un suivi dans 48 h après un appel sans réponse, un standard ou une conversation positive.", action: "Enregistrer et continuer", owner: "Commercial assigné", assigned: "Attribuer le prospect", choose: "Choisir", all: "Tous les commerciaux", done: "Ne pas contacter", paid: "Encaissements confirmés (hors TVA)", income: "Revenu mensuel contractuel", commission: "Commission acquise", payment: "Confirmer un paiement reçu", ref: "Référence facture/paiement", verified: "J'ai vérifié que ce paiement a été reçu", more: "Charger plus", week: "Activités des 7 derniers jours. Le pipeline et les paiements présentent la situation globale actuelle.", saveStage: "Enregistrer l'étape", currency: "Devise", timezone: "Fuseau horaire", commissionRate: "Commission (%)", saveSettings: "Enregistrer les paramètres", info: "Seuls les paiements confirmés génèrent une commission. Les devises restent séparées.", alert: "Ne contactez pas cette entreprise.", loading: "Chargement de la prospection …", retry: "Réessayer", saved: "Enregistré", callSaved: "Appel enregistré", invalidAmount: "Saisissez un montant valide avec le nombre de décimales autorisé pour cette devise.", invalidDate: "Saisissez une date valide dans le fuseau choisi. Cette heure peut être ignorée lors du passage à l'heure d'été.", history: "Historique des appels", noHistory: "Aucun appel enregistré.", historyLoading: "Chargement de l'historique …", historyMore: "Appels précédents", staff: "salariés", noStaff: "Effectif non communiqué", lastResult: "Dernier résultat", unassigned: "Non attribué", locking: "Réservation de l'entreprise …", lockReady: "Réservée pour vous pendant votre travail", lockFailed: "Cette entreprise ne peut pas être appelée maintenant. Réessayez ou passez à la suivante.", lockRetry: "Réserver à nouveau", anotherOwner: "Attribuez-vous cette entreprise avant de l'appeler.", distribute: "Répartir automatiquement les prospects", distributeHelp: "Répartissez les entreprises entre les commerciaux choisis. Les doublons gardent le même propriétaire.", quantity: "Nombre d'entreprises", redistribute: "Inclure et réattribuer les prospects déjà assignés", distributionConfirm: "Cela change le propriétaire des prospects déjà assignés.", chooseSellers: "Choisissez au moins un commercial.", noPayments: "Aucun paiement confirmé", country: "Marché", marketDefaults: "Utiliser la devise et le fuseau du marché", pitch: "Script d'appel", emailTemplate: "Modèle d'e-mail", emailSubject: "Objet", permission: "Règles de contact", permissionHelp: "Les règles de l'organisation s'appliquent à tous. Une opposition bloque toujours le contact.", blockCountries: "Codes pays bloqués", blockIndustries: "Secteurs bloqués", blockRegions: "Régions bloquées", permissionRequired: "Exiger un motif de contact enregistré", contactHours: "Limiter le contact aux jours ouvrés", from: "De", until: "À", commas: "Séparez les valeurs par des virgules.", rulesUnavailable: "Le motif ou les règles de contact ne permettent pas d'appeler maintenant.", product: "Informations produit", productText: "Noracre réunit la relation client, les listes d'appels et le marketing dans un seul espace. La démo présente le produit réel.", demo: "Ouvrir la démo avec des entreprises fictives", faq: "Questions fréquentes", faqPrice: "Quel est le prix ?", faqPriceAnswer: "Utilisez le tarif convenu avec l'organisation. Un administrateur approuve les accords tarifaires.", faqIntegrations: "Pouvez-vous promettre une intégration ?", faqIntegrationsAnswer: "Montrez les fonctions disponibles dans la démo. Soumettez les demandes d'intégration à un administrateur avant toute promesse.", objection: "Nous avons déjà un CRM", objectionAnswer: "Demandez comment ils gèrent la prospection et les suivis, puis proposez de montrer le parcours pertinent.", organizationPlaybook: "Utilisez votre propre argumentaire et les informations produit approuvées pour vos ventes.", preview: "Aperçu des modèles par marché", noOwner: "Commercial", leads: "prospects", callbackSave: "Enregistrer le suivi", currentCurrency: "Devise du contrat", paymentHistory: "Paiements", noDeal: "Enregistrez le client, l’activation de l’abonnement et l’accord de commission avant de confirmer un paiement.", createCustomer: "Créer la fiche client",
  },
};

const financeLabels = {
  nb: {terms: "Kunde og provisjonsavtale", customer: "CRM-kunde", activated: "Abonnement aktivert", cancelled: "Abonnement avsluttet", duration: "Provisjonsperiode (måneder)", agreed: "Jeg bekrefter at provisjonsvilkårene er avtalt", agreementHelp: "Vilkårene lagres for denne avtalen. Endringer i standardoppsettet endrer ikke tidligere avtaler.", received: "Faktisk betalingsdato", receiptHelp: "Registrer bare mottatt abonnementsbetaling uten merverdiavgift. Fakturaer og forventet inntekt gir ingen provisjon.", refund: "Registrer refusjon", originalPayment: "Opprinnelig betaling", refundAmount: "Refundert beløp (ekskl. mva.)", refundConfirmed: "Jeg bekrefter at beløpet faktisk er refundert", refunded: "Refusjon", demoFinance: "Finansielle registreringer er deaktivert i demoen.", basis: "Kontaktgrunnlag", basisConfirmed: "Kontaktgrunnlaget er kontrollert", basisNote: "Dokumentasjon eller kilde for kontaktgrunnlaget", basisSave: "Lagre kontaktgrunnlag", productNotes: "Godkjent produktinformasjon og FAQ", historyPayments: "Betalingshistorikk", confirmedCommission: "Provisjon for betalingen"},
  en: {terms: "Customer and commission agreement", customer: "CRM customer", activated: "Subscription activated", cancelled: "Subscription cancelled", duration: "Commission period (months)", agreed: "I confirm that these commission terms are agreed", agreementHelp: "Terms are saved for this agreement. Changes to defaults do not change previous agreements.", received: "Actual payment date", receiptHelp: "Record received subscription revenue excluding VAT. Invoices and expected revenue do not earn commission.", refund: "Record refund", originalPayment: "Original payment", refundAmount: "Refunded amount (excluding tax)", refundConfirmed: "I confirm that this amount was actually refunded", refunded: "Refund", demoFinance: "Financial recording is disabled in the demo.", basis: "Contact basis", basisConfirmed: "The contact basis has been verified", basisNote: "Evidence or source for the contact basis", basisSave: "Save contact basis", productNotes: "Approved product information and FAQ", historyPayments: "Payment history", confirmedCommission: "Commission on this payment"},
  fr: {terms: "Client et accord de commission", customer: "Client CRM", activated: "Abonnement activé", cancelled: "Abonnement résilié", duration: "Période de commission (mois)", agreed: "Je confirme que ces conditions de commission ont été convenues", agreementHelp: "Les conditions sont conservées pour cet accord. Les nouveaux paramètres ne modifient pas les accords antérieurs.", received: "Date du paiement effectif", receiptHelp: "Enregistrez uniquement les revenus d'abonnement reçus hors TVA. Une facture ou un revenu attendu ne génère aucune commission.", refund: "Enregistrer un remboursement", originalPayment: "Paiement initial", refundAmount: "Montant remboursé (hors TVA)", refundConfirmed: "Je confirme que ce montant a été effectivement remboursé", refunded: "Remboursement", demoFinance: "Les opérations financières sont désactivées dans la démo.", basis: "Motif de contact", basisConfirmed: "Le motif de contact a été vérifié", basisNote: "Justificatif ou source du motif de contact", basisSave: "Enregistrer le motif", productNotes: "Informations produit et FAQ approuvées", historyPayments: "Historique des paiements", confirmedCommission: "Commission sur ce paiement"},
};

type Labels = typeof languages.nb;
function money(minor: number, currency: string, locale: string) {
  try { return new Intl.NumberFormat(locale, {style: "currency", currency}).format(minor / currencyScale(currency)); }
  catch { return `${minor / currencyScale(currency)} ${currency}`; }
}
function dateLabel(value: string, locale: string, timeZone: string) {
  if (!value) return "";
  try { return new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeStyle: "short", timeZone}).format(new Date(value)); }
  catch { return value; }
}
function localized(value: string, lang: "nb" | "en" | "fr") {
  return lang === "nb" ? value : translations[lang][value as keyof typeof translations.en] ?? value;
}
function requestId() { return globalThis.crypto?.randomUUID?.() ?? `call-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export function OutboundSalesDesk({organizationId, selectedListId, legacyVisible = false, onShowLegacy, onEnabledChange, onDataChanged}: {
  organizationId: number; selectedListId: number | null; legacyVisible?: boolean; onShowLegacy: () => void; onEnabledChange: (active: boolean) => void; onDataChanged?: () => Promise<void>;
}) {
  const api = useCrmApi();
  const demoMode = useDemoMode();
  const {locale} = useI18n();
  const lang = locale === "fr" ? "fr" : locale === "en" ? "en" : "nb";
  const t = {...languages[lang], ...financeLabels[lang]};
  const [state, setState] = useState<WorkspaceData>(emptyData);
  const [loadedOrganization, setLoadedOrganization] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("dial");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [queueMode, setQueueMode] = useState<"ready" | "due" | "all">("ready");
  const [rep, setRep] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const [outcome, setOutcome] = useState("Ikke svar");
  const [note, setNote] = useState("");
  const [callback, setCallback] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState("Prospekt");
  const [monthly, setMonthly] = useState("");
  const [selectedRep, setSelectedRep] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentChecked, setPaymentChecked] = useState(false);
  const [customerCompanyId, setCustomerCompanyId] = useState(0);
  const [subscriptionActivatedAt, setSubscriptionActivatedAt] = useState("");
  const [subscriptionCancelledAt, setSubscriptionCancelledAt] = useState("");
  const [commissionBps, setCommissionBps] = useState(0);
  const [commissionMonths, setCommissionMonths] = useState(12);
  const [agreementConfirmed, setAgreementConfirmed] = useState(false);
  const [receivedAt, setReceivedAt] = useState("");
  const [refundId, setRefundId] = useState(0);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [refundReceivedAt, setRefundReceivedAt] = useState("");
  const [refundConfirmed, setRefundConfirmed] = useState(false);
  const [contactPermission, setContactPermission] = useState(false);
  const [permissionNote, setPermissionNote] = useState("");
  const [draftSettings, setDraftSettings] = useState<Config>(defaults);
  const [distribution, setDistribution] = useState({members: [] as number[], count: "50", reassign: false});
  const [market, setMarket] = useState("NO");
  const [history, setHistory] = useState<CallLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMore, setHistoryMore] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [lease, setLease] = useState<Lease | null>(null);
  const [leaseError, setLeaseError] = useState("");
  const [leaseVersion, setLeaseVersion] = useState(0);
  const [leasing, setLeasing] = useState(false);
  const generation = useRef(0);
  const enabledCallback = useRef(onEnabledChange);
  const leaseRef = useRef<Lease | null>(null);
  const pendingCall = useRef("");
  const selectedLeadRef = useRef<number | null>(null);
  const requestSequence = useRef(0);
  const loadedQueue = useRef<ServerQueue | null>(null);
  const requestedQueue: ServerQueue = legacyVisible || tab !== "dial" || queueMode === "all" ? "all" : queueMode === "due" ? "due" : "ready";
  const queueRequest = useRef<ServerQueue>(requestedQueue);
  queueRequest.current = requestedQueue;
  enabledCallback.current = onEnabledChange;
  const headers = useMemo(() => ({"x-organization-id": String(organizationId), "content-type": "application/json"}), [organizationId]);

  const refresh = useCallback(async (offset = 0, append = false) => {
    const currentGeneration = generation.current;
    const sequence = ++requestSequence.current;
    const serverQueue = queueRequest.current;
    const params = new URLSearchParams({offset: String(offset), queue: serverQueue});
    if (selectedListId) params.set("listId", String(selectedListId));
    const response = await api(`/api/outbound?${params}`, {headers});
    const data = await response.json() as WorkspaceData & {error?: string};
    if (!response.ok) throw new Error(data.error ?? "Could not load outbound data.");
    if (generation.current !== currentGeneration || sequence !== requestSequence.current || queueRequest.current !== serverQueue) return null;
    loadedQueue.current = serverQueue;
    setState(old => ({...emptyData, ...data, rows: append ? Array.from(new Map([...old.rows, ...data.rows].map(lead => [lead.id, lead])).values()) : data.rows}));
    if (!append) setDraftSettings(data.settings);
    setLoadedOrganization(organizationId);
    enabledCallback.current(Boolean(data.settings.enabled));
    return data;
  }, [api, organizationId, selectedListId, headers]);

  useEffect(() => {
    generation.current++; loadedQueue.current = null;
    setLoading(true); setBusy(false); setLoadedOrganization(null); setState(emptyData); setError(""); setActiveId(null); setSearch(""); setRep(0); setTab("dial");
    let live = true;
    void refresh().catch(cause => {if (live) setError(String(cause.message ?? cause));}).finally(() => {if (live) setLoading(false);});
    return () => {live = false; generation.current++;};
  }, [refresh]);
  useEffect(() => {
    if (loadedOrganization !== organizationId || loadedQueue.current === requestedQueue) return;
    let live = true;
    setLoading(true); setError("");
    void refresh().catch(cause => {if (live) setError(cause.message);}).finally(() => {if (live) setLoading(false);});
    return () => {live = false;};
  }, [requestedQueue, loadedOrganization, organizationId, refresh]);
  useEffect(() => {const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer);}, []);

  const rules = useMemo(() => normalizeOutboundRules(state.settings.marketRules), [state.settings.marketRules]);
  const eligibleRows = useMemo(() => state.rows.map(lead => ({...lead, eligible: liveOutboundEligibility(lead, rules, clock).eligible})), [state.rows, rules, clock, state.settings.timezone]);
  const queue = useMemo(() => outboundQueue(eligibleRows, {now: clock, query: search, membershipId: rep, mode: queueMode}), [eligibleRows, clock, search, rep, queueMode]);
  useEffect(() => {
    // A server-filtered empty queue can gain a due callback or enter contact hours.
    // Keep a raw paginated scan intact until its remaining pages have been loaded.
    if (loadedOrganization === organizationId && loadedQueue.current === requestedQueue && state.settings.enabled && tab === "dial" && requestedQueue !== "all" && !loading && !busy && !state.hasMore && queue.length === 0) {
      void refresh().catch(() => {});
    }
  }, [clock, refresh]);
  const selected = (tab === "dial" ? queue.find(lead => lead.id === activeId) ?? queue[0] : state.rows.find(lead => lead.id === activeId) ?? state.rows[0]) ?? null;
  selectedLeadRef.current = selected?.id ?? null;
  const chosenDeal = state.deals.find(deal => deal.entryId === selected?.id);
  const actorId = state.actorMembershipId ?? (!state.canManage ? state.members[0]?.id : 0) ?? 0;
  const ownedByAnother = !!selected?.assignedMembershipId && selected.assignedMembershipId !== actorId;
  const selectedEligibility = selected ? liveOutboundEligibility(selected, rules, clock) : {eligible: false, reason: ""};
  const permitted = !!selected && !selected.suppressed && selectedEligibility.eligible;
  const leaseReady = !!selected && lease?.entryId === selected.id && Date.parse(lease.expiresAt) > clock;

  function selectLead(lead: Lead) {
    setActiveId(lead.id); setSelectedRep(""); setOutcome("Ikke svar"); setNote(""); setCallback("");
    setContact(lead.state?.contactName ?? ""); setPhone(lead.state?.contactPhone ?? lead.phone ?? "");
    const deal = state.deals.find(item => item.entryId === lead.id);
    setStage(deal?.pipeline ?? lead.state?.pipeline ?? "Prospekt"); setMonthly(String((deal?.monthlyAmountMinor ?? 0) / currencyScale(deal?.currency ?? state.settings.currency)));
    setPaymentChecked(false); setPaymentRef(""); setPaidAmount(""); pendingCall.current = "";
    setCustomerCompanyId(deal?.customerCompanyId ?? 0);
    setSubscriptionActivatedAt(dateTimeInZone(deal?.subscriptionActivatedAt ?? "", state.settings.timezone));
    setSubscriptionCancelledAt(dateTimeInZone(deal?.subscriptionCancelledAt ?? "", state.settings.timezone));
    setCommissionBps(deal?.commissionBps ?? state.settings.commissionBps); setCommissionMonths(deal?.commissionMonths ?? state.settings.commissionMonths ?? 12); setAgreementConfirmed(false);
    setReceivedAt(dateTimeInZone(new Date().toISOString(), state.settings.timezone));
    setRefundId(0); setRefundAmount(""); setRefundReference(""); setRefundReceivedAt(dateTimeInZone(new Date().toISOString(), state.settings.timezone)); setRefundConfirmed(false);
    setContactPermission(lead.state?.contactPermission ?? false); setPermissionNote(lead.state?.contactPermissionNote ?? "");
  }
  useEffect(() => {if (selected && selected.id !== activeId) selectLead(selected);}, [selected?.id, activeId]);
  useEffect(() => {setMarket(selected?.country ?? state.settings.country ?? "NO");}, [selected?.country, state.settings.country]);

  useEffect(() => {
    let live = true;
    let currentLease: Lease | null = null;
    setLease(null); leaseRef.current = null; setLeaseError("");
    if (legacyVisible || tab !== "dial" || !state.settings.enabled || !selected || ownedByAnother || !permitted) {setLeasing(false); return;}
    const entryId = selected.id;
    const release = (value: Lease) => api("/api/outbound", {method: "POST", headers, body: JSON.stringify({type: "release", entryId, leaseToken: value.token})}).catch(() => {});
    const acquire = async () => {
      if (live) setLeasing(true);
      try {
        const response = await api("/api/outbound", {method: "POST", headers, body: JSON.stringify({type: "acquire", entryId, ...(currentLease ? {leaseToken: currentLease.token} : {})})});
        const data = await response.json() as {lease?: Lease; leaseToken?: string; expiresAt?: string; error?: string};
        if (!response.ok) throw new Error(data.error ?? t.lockFailed);
        const next = data.lease ?? {entryId, token: data.leaseToken ?? "", expiresAt: data.expiresAt ?? ""};
        if (!next.token || !next.expiresAt) throw new Error(t.lockFailed);
        if (!live) {void release(next); return;}
        currentLease = next; leaseRef.current = next; setLease(next); setLeaseError("");
      } catch (cause) {
        if (live) {setLease(null); leaseRef.current = null; setLeaseError(cause instanceof Error ? cause.message : t.lockFailed);}
      } finally {if (live) setLeasing(false);}
    };
    void acquire();
    const timer = setInterval(() => void acquire(), 45000);
    return () => {live = false; clearInterval(timer); if (currentLease) void release(currentLease);};
  }, [api, headers, selected?.id, tab, legacyVisible, state.settings.enabled, ownedByAnother, permitted, leaseVersion]);

  const fetchHistory = useCallback(async (entryId: number, offset = 0, append = false) => {
    const currentGeneration = generation.current;
    const response = await api(`/api/outbound?entryId=${entryId}&historyOffset=${offset}`, {headers});
    const data = await response.json() as {history?: CallLog[]; historyHasMore?: boolean; hasMore?: boolean; error?: string};
    if (!response.ok) throw new Error(data.error ?? "Could not load call history.");
    if (currentGeneration !== generation.current || selectedLeadRef.current !== entryId) return;
    setHistory(old => append ? [...old, ...(data.history ?? [])] : data.history ?? []);
    setHistoryMore(Boolean(data.historyHasMore ?? data.hasMore));
  }, [api, headers]);
  useEffect(() => {
    setHistory([]); setHistoryMore(false); setHistoryError("");
    if (!selected || legacyVisible) return;
    let live = true;
    const entryId = selected.id;
    setHistoryLoading(true);
    // The selection guard prevents a slow previous request from replacing the current lead's history.
    const currentGeneration = generation.current;
    void api(`/api/outbound?entryId=${entryId}&historyOffset=0`, {headers}).then(async response => {
      const data = await response.json() as {history?: CallLog[]; historyHasMore?: boolean; hasMore?: boolean; error?: string};
      if (!response.ok) throw new Error(data.error ?? "Could not load call history.");
      if (live && generation.current === currentGeneration) {setHistory(data.history ?? []); setHistoryMore(Boolean(data.historyHasMore ?? data.hasMore));}
    }).catch(cause => {if (live) setHistoryError(cause.message);}).finally(() => {if (live) setHistoryLoading(false);});
    return () => {live = false;};
  }, [api, headers, selected?.id, historyVersion, legacyVisible]);

  async function submit(body: Record<string, unknown>, success = t.saved) {
    const currentGeneration = generation.current;
    setBusy(true);
    try {
      const response = await api("/api/outbound", {method: "POST", headers, body: JSON.stringify(body)});
      const data = await response.json() as {error?: string; assigned?: number};
      if (!response.ok) throw new Error(data.error ?? "Could not save.");
      if (generation.current !== currentGeneration) return false;
      toast.success(success); await refresh(); setHistoryVersion(value => value + 1); return true;
    } catch (cause) {if (generation.current === currentGeneration) toast.error(cause instanceof Error ? cause.message : "Could not save."); return false;}
    finally {if (generation.current === currentGeneration) setBusy(false);}
  }
  function navigate(direction: number) {
    if (!queue.length || busy) return;
    const index = queue.findIndex(lead => lead.id === selected?.id);
    selectLead(queue[(index + direction + queue.length) % queue.length]);
  }
  function nextCallAt() {
    if (!callback) return "";
    const value = dateTimeToUtc(callback, state.settings.timezone);
    if (!value) throw new Error(t.invalidDate);
    return value;
  }
  async function logCall() {
    if (!selected || !leaseReady || !permitted || busy) return;
    let nextAt: string;
    try {nextAt = nextCallAt();} catch (cause) {toast.error((cause as Error).message); return;}
    const index = queue.findIndex(lead => lead.id === selected.id);
    const next = queue[(index + 1) % queue.length];
    const id = pendingCall.current || requestId(); pendingCall.current = id;
    const saved = await submit({type: "dial", entryId: selected.id, outcome, note, nextCallAt: nextAt, contactName: contact, contactPhone: phone, leaseToken: leaseRef.current?.token, requestId: id}, t.callSaved);
    if (saved) {
      pendingCall.current = ""; setNote(""); setCallback(""); setLease(null); leaseRef.current = null;
      setActiveId(next?.id !== selected.id ? next?.id ?? null : null); setLeaseVersion(value => value + 1);
    }
  }
  async function saveStage() {
    if (!selected) return;
    const amount = parseMinorAmount(monthly || "0", chosenDeal?.currency ?? state.settings.currency);
    if (amount === null) {toast.error(t.invalidAmount); return;}
    try {
      const unchangedActivation = subscriptionActivatedAt === dateTimeInZone(chosenDeal?.subscriptionActivatedAt ?? "", state.settings.timezone);
      const unchangedCancellation = subscriptionCancelledAt === dateTimeInZone(chosenDeal?.subscriptionCancelledAt ?? "", state.settings.timezone);
      const activated = unchangedActivation ? chosenDeal?.subscriptionActivatedAt ?? "" : subscriptionActivatedAt ? dateTimeToUtc(subscriptionActivatedAt, state.settings.timezone) : "";
      const cancelled = unchangedCancellation ? chosenDeal?.subscriptionCancelledAt ?? "" : subscriptionCancelledAt ? dateTimeToUtc(subscriptionCancelledAt, state.settings.timezone) : "";
      if ((subscriptionActivatedAt && !activated) || (subscriptionCancelledAt && !cancelled)) throw new Error(t.invalidDate);
      const saved = await submit({type: "stage", entryId: selected.id, pipeline: stage, monthlyAmountMinor: amount, note,
        ...(callback ? {nextCallAt: nextCallAt()} : {}),
        ...(state.canManage ? {...(customerCompanyId ? {customerCompanyId} : {}), ...(!unchangedActivation ? {subscriptionActivatedAt: activated} : {}), ...(!unchangedCancellation ? {subscriptionCancelledAt: cancelled} : {}),
          ...(agreementConfirmed ? {commissionBps, commissionMonths, commissionAgreedAt: new Date().toISOString()} : {})} : {}),
      });
      if (saved) setAgreementConfirmed(false);
    } catch (cause) {toast.error((cause as Error).message);}
  }
  async function createCustomer() {
    if (!selected || busy || customerCompanyId) return;
    const currentGeneration = generation.current; setBusy(true);
    try {
      const response = await api("/api/companies", {method: "POST", headers, body: JSON.stringify({name: selected.name, country: selected.country, orgNumber: selected.orgNumber, contactName: contact, phone, email: selected.email, industry: selected.industry, city: selected.city, address: selected.address ?? "", postalCode: selected.postalCode ?? "", employeeRange: selected.employeeRange, employeeRangeYear: selected.employeeRangeYear ?? "", employees: selected.employees, revenue: selected.revenue ?? null, source: "Ringeliste", stage: "Vunnet"})});
      const data = await response.json() as {company?: {id: number; name: string}; error?: string};
      if (!response.ok || !data.company || !Number.isSafeInteger(data.company.id) || data.company.id <= 0) throw new Error(data.error ?? "Could not create the customer.");
      if (generation.current !== currentGeneration) return;
      setCustomerCompanyId(data.company.id); setState(old => ({...old, customers: [...old.customers ?? [], data.company!]}));
      toast.success(t.saved); await refresh(); if (onDataChanged) await onDataChanged();
    } catch (cause) {if (generation.current === currentGeneration) toast.error((cause as Error).message);}
    finally {if (generation.current === currentGeneration) setBusy(false);}
  }
  async function savePayment() {
    if (!selected || !paymentChecked) return;
    const amount = parseMinorAmount(paidAmount, chosenDeal?.currency ?? state.settings.currency);
    if (amount === null || amount <= 0) {toast.error(t.invalidAmount); return;}
    const receiptDate = dateTimeToUtc(receivedAt, state.settings.timezone);
    if (!receiptDate) {toast.error(t.invalidDate); return;}
    const saved = await submit({type: "payment", entryId: selected.id, paidAmountMinor: amount, reference: paymentRef, receivedAt: receiptDate, confirmed: true});
    if (saved) {setPaymentRef(""); setPaidAmount(""); setPaymentChecked(false);}
  }
  async function saveRefund() {
    const amount = parseMinorAmount(refundAmount, state.payments.find(payment => payment.id === refundId)?.currency ?? state.settings.currency);
    const refundDate = dateTimeToUtc(refundReceivedAt, state.settings.timezone);
    if (!refundId || amount === null || amount <= 0 || !refundConfirmed) {toast.error(t.invalidAmount); return;}
    if (!refundDate) {toast.error(t.invalidDate); return;}
    const saved = await submit({type: "refund", paymentId: refundId, refundAmountMinor: amount, reference: refundReference, receivedAt: refundDate, confirmed: true});
    if (saved) {setRefundId(0); setRefundAmount(""); setRefundReference(""); setRefundConfirmed(false);}
  }
  async function saveSettings() {
    try {
      const validatedRules = normalizeOutboundRules(draftSettings.marketRules);
      await submit({type: "settings", ...draftSettings, marketRules: validatedRules});
    } catch (cause) {toast.error((cause as Error).message);}
  }
  function updatePlaybook(field: keyof PlaybookOverrides[string], value: string) {
    setDraftSettings({...draftSettings, playbooks: {...draftSettings.playbooks, [market]: {...draftPlaybook, [field]: value}}});
  }
  async function distribute() {
    if (!distribution.members.length) {toast.error(t.chooseSellers); return;}
    await submit({type: "assign", membershipIds: distribution.members, count: Number(distribution.count), mode: distribution.reassign ? "all" : "unassigned", ...(selectedListId ? {listId: selectedListId} : {})});
  }
  const activeMembers = state.members.filter(member => member.active && member.canCall !== false);
  const roleName = (id: number) => state.members.find(member => member.id === id)?.name ?? `${t.noOwner} ${id}`;
  const playbook = {productInfo: "", ...outboundPlaybook(market, lang), ...Object.fromEntries(Object.entries(state.settings.playbooks?.[market] ?? {}).filter(([, value]) => !!value?.trim()))};
  const draftPlaybook = draftSettings.playbooks?.[market] ?? {};
  const countryName = (code: string) => {try {return new Intl.DisplayNames([locale], {type: "region"}).of(code) ?? code;} catch {return code;}};
  const script = state.settings.playbooks?.[market]?.phoneScript || state.settings.pitch || playbook.phoneScript;
  const website = safeOutboundWebsite(selected?.website ?? "");
  const reportTotals = (state.paymentTotals ?? []).reduce((all, item) => {
    const total = all[item.currency] ?? {paid: 0, commission: 0};
    total.paid += Number(item.paidMinor); total.commission += Number(item.commissionMinor); all[item.currency] = total;
    return all;
  }, {} as Record<string, {paid: number; commission: number}>);
  const financeReady = !!chosenDeal && !!(chosenDeal.customerCompanyId || chosenDeal.customerOrganizationId) && !!chosenDeal.subscriptionActivatedAt && (chosenDeal.commissionBps === 0 || !!chosenDeal.commissionAgreedAt);
  const metrics = state.metrics;
  const meetingRate = metrics?.meetingRate ?? meetingConversionRate(metrics?.meetings ?? 0, metrics?.conversations ?? 0);

  if (error) return <div className="outbound-desk outbound-load"><p role="alert">{error}</p><Button onClick={() => {setError(""); setLoading(true); void refresh().catch(cause => setError(cause.message)).finally(() => setLoading(false));}}>{t.retry}</Button></div>;
  if (loading || loadedOrganization !== organizationId) return <div className="outbound-desk outbound-load" role="status"><RefreshCw size={18}/>{t.loading}</div>;

  if (legacyVisible) return <section className="outbound-desk outbound-compact"><div><strong>{t.desk}</strong><p>{t.settingsHelp}</p></div><Button variant="outline" onClick={onShowLegacy}>{state.settings.enabled ? t.dial : t.start}<ArrowRight size={14}/></Button></section>;

  return <section className="outbound-desk" aria-label={t.desk}>
    <header className="outbound-top">
      <div><span className="outbound-eyebrow"><Target size={15}/>{t.desk}</span><h2>{state.settings.enabled ? t.desk : t.start}</h2><p>{state.settings.enabled ? t.intro : t.settingsHelp}</p></div>
      <Button variant="outline" onClick={onShowLegacy}>{t.standard}<ExternalLink size={14}/></Button>
    </header>
    {!state.settings.enabled ? state.canManage ? <div className="outbound-optin">
      <p>{t.settingsHelp}</p><label><input type="checkbox" checked={draftSettings.enabled} onChange={event => setDraftSettings({...draftSettings, enabled: event.target.checked})}/>{t.enable}</label>
      <Button disabled={busy || !draftSettings.enabled} onClick={() => void saveSettings()}>{t.start}</Button>
    </div> : <p className="outbound-note">{t.settingsHelp}</p> : <>
      <nav className="outbound-tabs" aria-label={t.desk}>
        {([{id: "dial", name: t.dial, icon: Phone}, {id: "pipeline", name: t.pipeline, icon: Target}, {id: "report", name: t.report, icon: BarChart3}, {id: "kit", name: t.kit, icon: BookOpen}, ...(state.canManage ? [{id: "settings", name: t.setup, icon: Settings}] : [])] as {id: Tab; name: string; icon: typeof Phone}[]).map(item => <button key={item.id} type="button" className={tab === item.id ? "active" : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}><item.icon size={16}/>{item.name}</button>)}
      </nav>
      {tab === "dial" && <div className="outbound-layout">
        <aside className="outbound-queue">
          <div className="outbound-queue-head"><strong>{t.dial}</strong><span>{queue.length} {t.leads}</span></div>
          <label className="outbound-search"><Search size={16}/><Input aria-label={t.search} placeholder={t.search} value={search} onChange={event => setSearch(event.target.value)}/></label>
          <select aria-label={t.scheduled} value={queueMode} onChange={event => setQueueMode(event.target.value as typeof queueMode)}><option value="ready">{t.ready}</option><option value="due">{t.due}</option><option value="all">{t.allQueue}</option></select>
          {state.canManage && <select aria-label={t.owner} value={rep} onChange={event => setRep(Number(event.target.value))}><option value="0">{t.all}</option>{activeMembers.map(member => <option value={member.id} key={member.id}>{member.name}</option>)}</select>}
          <div className="outbound-queue-list">{queue.map(lead => <button key={lead.id} type="button" disabled={busy} className={selected?.id === lead.id ? "current" : ""} onClick={() => selectLead(lead)}>
            <strong>{lead.name}</strong><small>{lead.city || lead.country}{lead.employeeRange || lead.employees != null ? ` · ${lead.employeeRange || `${lead.employees} ${t.staff}`}` : ""}</small>
            {lead.state?.nextCallAt && <small className={Date.parse(lead.state.nextCallAt) <= clock ? "outbound-due" : ""}><CalendarClock size={12}/>{dateLabel(lead.state.nextCallAt, locale, state.settings.timezone)}</small>}
            {state.canManage && <small>{lead.assignedMembershipId ? roleName(lead.assignedMembershipId) : t.unassigned}</small>}
          </button>)}</div>
          {state.hasMore && <Button disabled={busy} variant="outline" onClick={() => void refresh(state.nextOffset ?? state.rows.length, true).catch(cause => toast.error(cause.message))}>{t.more}</Button>}
          {state.canManage && <details className="outbound-distribution"><summary>{t.distribute}</summary><p>{t.distributeHelp}</p>
            {activeMembers.map(member => <label className="outbound-check" key={member.id}><input type="checkbox" checked={distribution.members.includes(member.id)} onChange={event => setDistribution({...distribution, members: event.target.checked ? [...distribution.members, member.id] : distribution.members.filter(id => id !== member.id)})}/>{member.name}</label>)}
            <label>{t.quantity}<Input type="number" min="1" max="500" value={distribution.count} onChange={event => setDistribution({...distribution, count: event.target.value})}/></label>
            <label className="outbound-check"><input type="checkbox" checked={distribution.reassign} onChange={event => setDistribution({...distribution, reassign: event.target.checked})}/>{t.redistribute}</label>
            {distribution.reassign && <p className="outbound-warning">{t.distributionConfirm}</p>}
            <Button disabled={busy || !distribution.members.length || Number(distribution.count) < 1 || Number(distribution.count) > 500} variant="outline" onClick={() => void distribute()}>{t.distribute}</Button>
          </details>}
        </aside>
        <div className="outbound-current">
          {selected ? <>
            <div className="outbound-heading"><div><span className="outbound-eyebrow">{selected.country} · {selected.orgNumber}</span><h3>{selected.name}</h3><p>{selected.industry || "—"} · {selected.city || "—"} · {selected.employeeRange || (selected.employees != null ? `${selected.employees} ${t.staff}` : t.noStaff)}</p></div><span className="outbound-attempts">{selected.state?.attempts ?? 0} {t.calls.toLowerCase()}</span></div>
            <div className="outbound-prospect-tools"><a href={`https://www.google.com/search?q=${encodeURIComponent(`${selected.name} ${selected.city} ${selected.country} ${lang === "fr" ? "dirigeant téléphone" : lang === "nb" ? "daglig leder telefon" : "decision maker phone"}`)}`} target="_blank" rel="noopener noreferrer"><Search size={15}/>{t.google}<ExternalLink size={13}/></a>{website && <a href={website} target="_blank" rel="noopener noreferrer">{t.website}<ExternalLink size={13}/></a>}{phone && leaseReady && permitted && <a className="outbound-phone" href={`tel:${phone.replace(/[^+\d*#]/g, "")}`}><Phone size={15}/>{t.call} {phone}</a>}</div>
            <p className={`outbound-lock ${leaseError || ownedByAnother || !permitted ? "outbound-warning" : ""}`} role="status"><LockKeyhole size={14}/>{ownedByAnother ? t.anotherOwner : !permitted ? t.rulesUnavailable : leasing ? t.locking : leaseReady ? t.lockReady : leaseError || t.lockFailed}{!ownedByAnother && permitted && !leaseReady && !leasing && <button type="button" onClick={() => setLeaseVersion(value => value + 1)}>{t.lockRetry}</button>}</p>
            <div className="outbound-fields"><label>{t.contact}<Input maxLength={120} value={contact} onChange={event => setContact(event.target.value)}/></label><label>{t.number}<Input type="tel" maxLength={40} value={phone} onChange={event => setPhone(event.target.value)}/></label></div>
            <fieldset className="outbound-outcomes"><legend>{t.outcome}</legend><div>{outcomes.map(value => <button type="button" key={value} aria-pressed={outcome === value} className={outcome === value ? "selected" : ""} onClick={() => {setOutcome(value); pendingCall.current = ""; if (["Ikke interessert", "Reservert mot kontakt", "Feil nummer"].includes(value)) setCallback("");}}>{localized(value, lang)}</button>)}</div></fieldset>
            <label>{t.again} ({state.settings.timezone})<Input type="datetime-local" value={callback} disabled={["Ikke interessert", "Reservert mot kontakt", "Feil nummer"].includes(outcome)} onChange={event => {setCallback(event.target.value); pendingCall.current = "";}}/><small className="outbound-muted">{t.callbackHelp}</small></label>
            <label>{t.note}<Textarea rows={3} maxLength={1500} value={note} onChange={event => {setNote(event.target.value); pendingCall.current = "";}}/></label>
            {selected.state?.lastOutcome && <p className="outbound-muted">{t.lastResult}: {localized(selected.state.lastOutcome, lang)}{selected.state.lastNote ? ` · ${selected.state.lastNote}` : ""}</p>}
            <div className="outbound-controls"><Button variant="outline" disabled={busy || queue.length < 2} onClick={() => navigate(-1)}><ArrowLeft size={15}/>{t.back}</Button><Button disabled={busy || !permitted || !leaseReady || ownedByAnother} onClick={() => void logCall()}><CheckCircle size={16}/>{busy ? "…" : t.action}</Button><Button variant="outline" disabled={busy || queue.length < 2} onClick={() => navigate(1)}>{t.next}<ArrowRight size={15}/></Button></div>
            {state.canManage && <div className="outbound-assign"><label>{t.owner}<select value={selectedRep || String(selected.assignedMembershipId || "")} onChange={event => setSelectedRep(event.target.value)}><option value="">{t.choose}</option>{activeMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><Button disabled={busy || !Number(selectedRep || selected.assignedMembershipId)} variant="outline" onClick={() => void submit({type: "assign", entryIds: [selected.id], membershipId: Number(selectedRep || selected.assignedMembershipId)})}>{t.assigned}</Button></div>}
            <CallHistory logs={history} loading={historyLoading} error={historyError} hasMore={historyMore} labels={t} lang={lang} locale={locale} timeZone={state.settings.timezone} roleName={roleName} onMore={() => {setHistoryLoading(true); void fetchHistory(selected.id, history.length, true).catch(cause => setHistoryError(cause.message)).finally(() => setHistoryLoading(false));}}/>
          </> : <div className="outbound-empty"><p>{state.rows.length ? t.empty : t.noLeads}</p><Button variant="outline" onClick={onShowLegacy}>{t.import}<ArrowRight size={14}/></Button></div>}
        </div>
        <aside className="outbound-playbook"><strong>{t.pitch}</strong><p>{script}</p><p className="outbound-muted">{playbook.permissionGuidance}</p></aside>
      </div>}
      {tab === "pipeline" && <div className="outbound-pipeline">
        <div className="outbound-pipeline-board">{stages.map(value => <div key={value}><small>{localized(value, lang)}</small><strong>{metrics?.stages[value] ?? 0}</strong></div>)}</div>
        <div className="outbound-pipeline-form"><label>{t.search}<select value={selected?.id ?? ""} onChange={event => {const lead = state.rows.find(item => item.id === Number(event.target.value)); if (lead) selectLead(lead);}}><option value="">{t.choose}</option>{state.rows.map(lead => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></label>
          {selected ? <>
            <h3>{selected.name}</h3>
            <div className="outbound-permission"><h4>{t.basis}</h4><label className="outbound-check"><input type="checkbox" checked={contactPermission} onChange={event => setContactPermission(event.target.checked)}/>{t.basisConfirmed}</label><label>{t.basisNote}<Textarea rows={2} maxLength={1000} value={permissionNote} onChange={event => setPermissionNote(event.target.value)}/></label><Button disabled={busy || (contactPermission && permissionNote.trim().length < 3)} variant="outline" onClick={() => void submit({type: "permission", entryId: selected.id, permission: contactPermission, note: permissionNote})}>{t.basisSave}</Button></div>
            {!customerCompanyId && !chosenDeal?.customerCompanyId && <Button variant="outline" disabled={busy} onClick={() => void createCustomer()}>{t.createCustomer}</Button>}
            <label>{t.pipeline}<select value={stage} onChange={event => setStage(event.target.value)}>{stages.map(value => <option key={value} value={value}>{localized(value, lang)}</option>)}</select></label>
            <label>{t.income} ({chosenDeal?.currency ?? state.settings.currency})<Input inputMode="decimal" value={monthly} onChange={event => setMonthly(event.target.value)}/></label>
            <label>{t.again} ({state.settings.timezone})<Input type="datetime-local" value={callback} onChange={event => setCallback(event.target.value)}/><small className="outbound-muted">{selected.state?.nextCallAt ? dateLabel(selected.state.nextCallAt, locale, state.settings.timezone) : ""}</small></label>
            <label>{t.note}<Textarea rows={2} maxLength={1000} value={note} onChange={event => setNote(event.target.value)}/></label>{state.canManage && <fieldset className="outbound-finance-terms"><legend>{t.terms}</legend>
              <label>{t.customer}<select value={customerCompanyId} onChange={event => setCustomerCompanyId(Number(event.target.value))}><option value="0">{t.choose}</option>{(state.customers ?? []).map(customer => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
              <div className="outbound-fields"><label>{t.activated} ({state.settings.timezone})<Input type="datetime-local" value={subscriptionActivatedAt} onChange={event => setSubscriptionActivatedAt(event.target.value)}/></label><label>{t.cancelled} ({state.settings.timezone})<Input type="datetime-local" value={subscriptionCancelledAt} onChange={event => setSubscriptionCancelledAt(event.target.value)}/></label></div>
              <div className="outbound-fields"><label>{t.commissionRate}<Input type="number" min="0" max="100" step="0.1" value={commissionBps / 100} onChange={event => setCommissionBps(Math.round(Number(event.target.value) * 100))}/></label><label>{t.duration}<Input type="number" min="1" max="120" value={commissionMonths} onChange={event => setCommissionMonths(Number(event.target.value))}/></label></div>
              <label className="outbound-check"><input type="checkbox" checked={agreementConfirmed} onChange={event => setAgreementConfirmed(event.target.checked)}/>{t.agreed}</label><p className="outbound-muted">{t.agreementHelp}</p>
            </fieldset>}
            <Button disabled={busy} onClick={() => void saveStage()}>{t.saveStage}</Button>
            {state.canManage && chosenDeal?.pipeline === "Kunde" && <div className="outbound-payment"><h4>{t.payment}</h4><p>{t.receiptHelp}</p>{!financeReady && <p className="outbound-muted">{t.noDeal}</p>}{demoMode && <p className="outbound-muted">{t.demoFinance}</p>}<label>{t.received} ({state.settings.timezone})<Input type="datetime-local" value={receivedAt} onChange={event => setReceivedAt(event.target.value)}/></label><label>{t.ref}<Input value={paymentRef} maxLength={100} onChange={event => setPaymentRef(event.target.value)}/></label><label>{t.paid} ({chosenDeal.currency})<Input inputMode="decimal" value={paidAmount} onChange={event => setPaidAmount(event.target.value)}/></label><label className="outbound-check"><input type="checkbox" checked={paymentChecked} onChange={event => setPaymentChecked(event.target.checked)}/>{t.verified}</label><Button disabled={demoMode || busy || !financeReady || !paymentChecked || paymentRef.trim().length < 3} onClick={() => void savePayment()}>{t.payment}</Button></div>}
            {state.payments.some(payment => payment.entryId === selected.id) && <section className="outbound-payment-history"><h4>{t.historyPayments}</h4>{state.payments.filter(payment => payment.entryId === selected.id).map(payment => <article key={payment.id}><div><strong>{payment.paymentReference}</strong><span>{money(payment.paidAmountMinor, payment.currency, locale)}</span></div><p>{dateLabel(payment.receivedAt || payment.createdAt || "", locale, state.settings.timezone)} · {roleName(payment.membershipId)}</p><p>{t.confirmedCommission}: {money(payment.commissionAmountMinor ?? 0, payment.currency, locale)}{payment.refundPaymentId ? ` · ${t.refunded}` : ""}</p></article>)}</section>}
            {state.canManage && state.payments.some(payment => payment.entryId === selected.id && payment.paidAmountMinor > 0) && <div className="outbound-refund"><h4>{t.refund}</h4><label>{t.originalPayment}<select value={refundId} onChange={event => setRefundId(Number(event.target.value))}><option value="0">{t.choose}</option>{state.payments.filter(payment => payment.entryId === selected.id && payment.paidAmountMinor > 0).map(payment => <option key={payment.id} value={payment.id}>{payment.paymentReference} · {money(payment.paidAmountMinor, payment.currency, locale)}</option>)}</select></label><label>{t.refundAmount}<Input inputMode="decimal" value={refundAmount} onChange={event => setRefundAmount(event.target.value)}/></label><label>{t.ref}<Input maxLength={100} value={refundReference} onChange={event => setRefundReference(event.target.value)}/></label><label>{t.received} ({state.settings.timezone})<Input type="datetime-local" value={refundReceivedAt} onChange={event => setRefundReceivedAt(event.target.value)}/></label><label className="outbound-check"><input type="checkbox" checked={refundConfirmed} onChange={event => setRefundConfirmed(event.target.checked)}/>{t.refundConfirmed}</label>{demoMode && <p className="outbound-muted">{t.demoFinance}</p>}<Button disabled={demoMode || busy || !refundId || !refundConfirmed || refundReference.trim().length < 3} variant="outline" onClick={() => void saveRefund()}>{t.refund}</Button></div>}
            <CallHistory logs={history} loading={historyLoading} error={historyError} hasMore={historyMore} labels={t} lang={lang} locale={locale} timeZone={state.settings.timezone} roleName={roleName} onMore={() => {setHistoryLoading(true); void fetchHistory(selected.id, history.length, true).catch(cause => setHistoryError(cause.message)).finally(() => setHistoryLoading(false));}}/>
          </> : <p>{t.noLeads}</p>}
          {state.hasMore && <Button variant="outline" disabled={busy} onClick={() => void refresh(state.nextOffset ?? state.rows.length, true).catch(cause => toast.error(cause.message))}>{t.more}</Button>}
        </div>
      </div>}
      {tab === "report" && <div className="outbound-report"><p className="outbound-muted">{t.week}</p>
        <div className="outbound-metrics"><Metric icon={Phone} label={t.calls} value={metrics?.attempts ?? 0}/><Metric icon={Users} label={t.talk} value={metrics?.conversations ?? 0}/><Metric icon={CalendarClock} label={t.meetings} value={metrics?.meetings ?? 0}/><Metric icon={Target} label={t.rate} value={`${meetingRate}%`}/><Metric icon={CheckCircle} label={t.demos} value={metrics?.attendedDemos ?? metrics?.stages["Demo gjennomført"] ?? 0}/><Metric icon={Users} label={t.trials} value={metrics?.trials ?? metrics?.stages["Prøveperiode"] ?? 0}/><Metric icon={CheckCircle} label={t.customers} value={metrics?.payingCustomers ?? new Set(state.payments.filter(item => item.paidAmountMinor > 0).map(item => item.entryId)).size}/></div>
        <h3>{t.paid} / {t.commission}</h3><p className="outbound-muted">{t.info}</p>{Object.entries(reportTotals).length ? Object.entries(reportTotals).map(([currency, total]) => <div className="outbound-revenue" key={currency}><span>{currency} · {t.paid}</span><strong>{money(total.paid, currency, locale)}</strong><span>{t.commission}</span><strong>{money(total.commission, currency, locale)}</strong></div>) : <p>{t.noPayments}</p>}
        <h3>{t.owner}</h3><div className="outbound-rep-report">{(state.byMember ?? []).map(member => <div key={member.membershipId}><strong>{member.name}</strong><span>{member.attempts} {t.calls.toLowerCase()} · {member.conversations} {t.talk.toLowerCase()}</span><span>{member.meetings} {t.meetings.toLowerCase()} · {meetingConversionRate(member.meetings, member.conversations)}%</span><span>{Object.entries(member.commissionsByCurrency).map(([currency, amount]) => money(amount, currency, locale)).join(" / ") || "—"}</span></div>)}</div>
      </div>}
      {tab === "kit" && <div className="outbound-kit"><p>{t.organizationPlaybook}</p><h3>{t.preview}</h3><label>{t.country}<select value={market} onChange={event => setMarket(event.target.value)}>{countries.map(country => <option value={country} key={country}>{countryName(country)} ({country})</option>)}</select></label><h4>{t.pitch}</h4><p className="outbound-script">{script}</p><h4>{t.emailTemplate}</h4><p><strong>{t.emailSubject}:</strong> {playbook.emailSubject}</p><p className="outbound-script">{playbook.emailBody}</p><p className="outbound-muted">{playbook.permissionGuidance}</p><hr/><h3>{t.product}</h3>{playbook.productInfo ? <p className="outbound-script">{playbook.productInfo}</p> : <p>{t.productText}</p>}<a href="/portfolio" target="_blank" rel="noopener noreferrer">{t.demo}<ExternalLink size={14}/></a><h3>{t.faq}</h3>{[[t.faqPrice, t.faqPriceAnswer], [t.faqIntegrations, t.faqIntegrationsAnswer], [t.objection, t.objectionAnswer]].map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>}
      {tab === "settings" && state.canManage && <div className="outbound-settings">
        <label className="outbound-check"><input type="checkbox" checked={draftSettings.enabled} onChange={event => setDraftSettings({...draftSettings, enabled: event.target.checked})}/>{t.enable}</label>
        <div className="outbound-fields"><label>{t.currency}<Input maxLength={3} value={draftSettings.currency} onChange={event => setDraftSettings({...draftSettings, currency: event.target.value.toUpperCase()})}/></label><label>{t.timezone}<Input value={draftSettings.timezone} maxLength={64} onChange={event => setDraftSettings({...draftSettings, timezone: event.target.value})}/></label><label>{t.commissionRate}<Input type="number" min="0" max="100" step="0.1" value={draftSettings.commissionBps / 100} onChange={event => setDraftSettings({...draftSettings, commissionBps: Math.round(Number(event.target.value) * 100)})}/></label></div>
        <label>{t.duration}<Input type="number" min="1" max="120" value={draftSettings.commissionMonths ?? 12} onChange={event => setDraftSettings({...draftSettings, commissionMonths: Number(event.target.value)})}/></label>
        <p className="outbound-muted">{t.agreementHelp}</p>
        <div className="outbound-market-defaults"><label>{t.country}<select value={market} onChange={event => setMarket(event.target.value)}>{countries.map(country => <option key={country} value={country}>{countryName(country)} ({country})</option>)}</select></label><Button variant="outline" onClick={() => {const marketConfig = marketDefaults(market); setDraftSettings({...draftSettings, currency: marketConfig.currency, timezone: marketConfig.timeZone});}}>{t.marketDefaults}</Button></div>
        <label>{t.pitch}<Textarea rows={6} maxLength={8000} value={draftSettings.pitch} placeholder={playbook.phoneScript} onChange={event => setDraftSettings({...draftSettings, pitch: event.target.value})}/></label>
        <fieldset className="outbound-rules"><legend>{t.preview} · {market}</legend>
          <label>{t.pitch}<Textarea rows={4} maxLength={8000} placeholder={outboundPlaybook(market, lang).phoneScript} value={draftPlaybook.phoneScript ?? ""} onChange={event => updatePlaybook("phoneScript", event.target.value)}/></label>
          <label>{t.emailSubject}<Input maxLength={8000} placeholder={outboundPlaybook(market, lang).emailSubject} value={draftPlaybook.emailSubject ?? ""} onChange={event => updatePlaybook("emailSubject", event.target.value)}/></label>
          <label>{t.emailTemplate}<Textarea rows={5} maxLength={8000} placeholder={outboundPlaybook(market, lang).emailBody} value={draftPlaybook.emailBody ?? ""} onChange={event => updatePlaybook("emailBody", event.target.value)}/></label>
          <label>{t.productNotes}<Textarea rows={5} maxLength={8000} value={draftPlaybook.productInfo ?? ""} onChange={event => updatePlaybook("productInfo", event.target.value)}/></label>
        </fieldset>
        <ContactRulesForm value={draftSettings.marketRules ?? defaultOutboundRules()} onChange={marketRules => setDraftSettings({...draftSettings, marketRules})} labels={t}/>
        <p className="outbound-muted">{t.info}</p><Button disabled={busy} onClick={() => void saveSettings()}>{t.saveSettings}</Button>
      </div>}
    </>}
  </section>;
}

function Metric({icon: Icon, label, value}: {icon: typeof Phone; label: string; value: number | string}) {
  return <div><Icon/><span>{label}</span><strong>{value}</strong></div>;
}
function CallHistory({logs, loading, error, hasMore, labels: t, lang, locale, timeZone, roleName, onMore}: {
  logs: CallLog[]; loading: boolean; error: string; hasMore: boolean; labels: Labels; lang: "nb" | "en" | "fr"; locale: string; timeZone: string; roleName: (id: number) => string; onMore: () => void;
}) {
  return <section className="outbound-history" aria-label={t.history}><h4><History size={16}/>{t.history}</h4>{error && <p role="alert">{error}</p>}{!logs.length && <p className="outbound-muted">{loading ? t.historyLoading : t.noHistory}</p>}
    <ol>{logs.map(log => <li key={log.id}><div><strong>{localized(log.outcome, lang)}</strong><time dateTime={log.createdAt}>{dateLabel(log.createdAt, locale, timeZone)}</time></div><small>{log.membershipName || log.name || roleName(log.membershipId)}</small>{log.note && <p>{log.note}</p>}{log.nextCallAt && <small><CalendarClock size={12}/>{t.scheduled}: {dateLabel(log.nextCallAt, locale, timeZone)}</small>}</li>)}</ol>
    {hasMore && <Button variant="outline" disabled={loading} onClick={onMore}>{t.historyMore}</Button>}
  </section>;
}
function ContactRulesForm({value, onChange, labels: t}: {value: Rules; onChange: (value: Rules) => void; labels: Labels}) {
  const entries = (text: string) => text.split(",").map(value => value.trim()).filter(Boolean);
  return <fieldset className="outbound-rules"><legend>{t.permission}</legend><p className="outbound-muted">{t.permissionHelp}</p>
    <RuleTerms label={t.blockCountries} values={value.blockedCountries} maxLength={500} onCommit={text => onChange({...value, blockedCountries: entries(text.toUpperCase())})}/>
    <RuleTerms label={t.blockIndustries} values={value.blockedIndustries} maxLength={1000} onCommit={text => onChange({...value, blockedIndustries: entries(text)})}/>
    <RuleTerms label={t.blockRegions} values={value.blockedRegions} maxLength={1000} onCommit={text => onChange({...value, blockedRegions: entries(text)})}/><small>{t.commas}</small>
    <label className="outbound-check"><input type="checkbox" checked={value.requireContactPermission} onChange={event => onChange({...value, requireContactPermission: event.target.checked})}/>{t.permissionRequired}</label>
    <label className="outbound-check"><input type="checkbox" checked={!!value.contactHours} onChange={event => onChange({...value, contactHours: event.target.checked ? {weekdays: [1, 2, 3, 4, 5], start: "09:00", end: "17:00"} : null})}/>{t.contactHours}</label>
    {value.contactHours && <div className="outbound-fields"><label>{t.from}<Input type="time" value={value.contactHours.start} onChange={event => onChange({...value, contactHours: {...value.contactHours!, start: event.target.value}})}/></label><label>{t.until}<Input type="time" value={value.contactHours.end} onChange={event => onChange({...value, contactHours: {...value.contactHours!, end: event.target.value}})}/></label></div>}
  </fieldset>;
}

function RuleTerms({label, values, maxLength, onCommit}: {label: string; values: string[]; maxLength: number; onCommit: (value: string) => void}) {
  const [text, setText] = useState(values.join(", "));
  const committed = values.join(", ");
  useEffect(() => setText(committed), [committed]);
  return <label>{label}<Input value={text} maxLength={maxLength} onChange={event => setText(event.target.value)} onBlur={() => onCommit(text)}/></label>;
}
