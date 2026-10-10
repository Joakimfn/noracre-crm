"use client";
import {UiText,useUiTranslation} from '@/lib/i18n/ui';

import {useCrmApi} from "@/lib/crm-api";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { moduleCatalog, type ModuleKey } from "@/lib/module-catalog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Company = { isPartner: boolean; id: number; name: string; status: string; crmPrice: number | null; ringPrice: number | null; marketingPrice: number | null; scheduledDisableAt: string };
type Draft = { organizationId: number; name: string; email: string; phone: string; role: string; moduleKeys: ModuleKey[] };
const emptyDraft: Draft = { organizationId: 0, name: "", email: "", phone: "", role: "Bruker", moduleKeys: [] };
const totalPrice = (company: Company, draft: Draft) => (company.crmPrice ?? 0) + moduleCatalog.filter(module => draft.moduleKeys.includes(module.key)).reduce((sum, module) => sum + (company[module.priceKey] ?? 0), 0);

export function CompanyUserCreate({ organizationId, refreshKey, onCreated }: {
  organizationId: number; refreshKey: number; onCreated: () => void;
}) {
 const {ui}=useUiTranslation();
 const apiFetch=useCrmApi();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [review, setReview] = useState<{ draft: Draft; company: Company } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{name:string;companyName:string;email:string;invitationSent:boolean;modules:string[]}|null>(null);
  const [reload, setReload] = useState(0);
  const locked = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch("/api/superadmin", { headers: { "x-organization-id": String(organizationId) } })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Kunne ikke hente bedriftene.");
        if (!cancelled) { setCompanies(data.organizations); setError(""); }
      }).catch(error => { if (!cancelled) setError(error.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId, refreshKey, reload, apiFetch]);
  const activeCompanies = companies.filter(company => company.status === "Aktiv" && (!company.scheduledDisableAt || company.scheduledDisableAt > new Date().toISOString()));
  const selected = activeCompanies.find(company => company.id === draft.organizationId);
  async function create() {
    if (!review || locked.current) return;
    locked.current = true;
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await apiFetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-organization-id": String(organizationId) },
        body: JSON.stringify({ type: "member", ...review.draft, acceptedPrice: review.company.crmPrice,
          acceptedModulePrices: Object.fromEntries(moduleCatalog.filter(module => review.draft.moduleKeys.includes(module.key)).map(module => [module.key, review.company[module.priceKey]])),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Kunne ikke opprette brukeren.");
      setResult({name:review.draft.name,companyName:review.company.name,email:review.draft.email,invitationSent:Boolean(data.invitationSent),
        modules:moduleCatalog.filter(module => review.draft.moduleKeys.includes(module.key)).map(module => module.name)});
      setDraft({ ...emptyDraft, organizationId: review.draft.organizationId });
      setReview(null);
      onCreated();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sendingen kunne ikke bekreftes. Kontroller brukerlisten før du prøver igjen.");
    } finally { locked.current = false; setBusy(false); }
  }
  return <>
    <p><UiText text="Opprett tilgang for en bruker i en eksisterende bedrift. Nye brukere velger selv passord via innloggingssiden." /></p>
    <form className="organization-form" onSubmit={event => {
      event.preventDefault();
      if (selected && selected.crmPrice != null) { setError(""); setResult(null); setReview({ draft: { ...draft, name: draft.name.trim(), email: draft.email.trim().toLowerCase() }, company: selected }); }
    }}>
      <Label htmlFor="customer-user-company"><UiText text="Bedrift" /></Label>
      <Select value={draft.organizationId ? String(draft.organizationId) : ""} onValueChange={value => setDraft({ ...draft, organizationId: Number(value), role: "Bruker", moduleKeys: [] })} disabled={loading || busy}>
        <SelectTrigger id="customer-user-company"><SelectValue placeholder={loading ? ui("Henter bedrifter …") : ui("Velg bedrift")} /></SelectTrigger>
        <SelectContent>{activeCompanies.map(company => <SelectItem key={company.id} value={String(company.id)}>{company.name}</SelectItem>)}</SelectContent>
      </Select>
      <Label htmlFor="customer-user-name"><UiText text="Navn" /></Label>
      <Input id="customer-user-name" required maxLength={160} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
      <Label htmlFor="customer-user-email"><UiText text="E-post" /></Label>
      <Input id="customer-user-email" type="email" required maxLength={254} value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} />
      <Label htmlFor="customer-user-phone"><UiText text="Telefon (valgfritt)" /></Label>
      <Input id="customer-user-phone" type="tel" maxLength={50} value={draft.phone} onChange={event => setDraft({ ...draft, phone: event.target.value })} />
      <Label htmlFor="customer-user-role"><UiText text="Rolle" /></Label>
      <Select value={draft.role} onValueChange={role => setDraft({ ...draft, role })}>
        <SelectTrigger id="customer-user-role"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="Bruker"><UiText text="Bruker" /></SelectItem><SelectItem value="Administrator"><UiText text="Administrator" /></SelectItem>{selected?.isPartner&&<SelectItem value="Partner"><UiText text="Partner" /></SelectItem>}</SelectContent>
      </Select>
      <fieldset className="company-user-modules" disabled={!selected || loading || busy}>
        <legend><UiText text="Tilleggsmoduler (valgfritt)" /></legend>
        {moduleCatalog.map(module => <label key={module.key}>
          <input type="checkbox" checked={draft.moduleKeys.includes(module.key)} disabled={!selected || selected[module.priceKey] == null}
            onChange={event => setDraft({ ...draft, moduleKeys: event.target.checked ? [...draft.moduleKeys, module.key] : draft.moduleKeys.filter(key => key !== module.key) })} />
          <span><strong>{ui(module.name)}</strong><small>{!selected ? ui("Velg bedrift først") : selected[module.priceKey] == null ? ui("Avtal pris under Drift for å aktivere") : ui("{0} kr per måned",{"0":selected[module.priceKey]})}</small></span>
        </label>)}
      </fieldset>
      <p className="form-hint">{selected ? selected.crmPrice == null ? ui("Avtal CRM-pris under Drift før brukeren opprettes.") : ui("CRM: {0} kr. Totalt for denne brukeren: {1} kr per måned eks. mva.",{"0":selected.crmPrice,"1":totalPrice(selected, draft)}) : ui("Velg bedriften brukeren skal ha tilgang til.")}</p>
      <Button type="submit" disabled={loading || busy || !selected || selected.crmPrice == null || !draft.name.trim() || !draft.email.trim()}><UiText text="Opprett bedriftsbruker" /></Button>
      {error && !review && <p role="alert">{ui(error)}</p>}
      {!loading && !companies.length && <Button type="button" variant="outline" onClick={() => setReload(value => value + 1)}><UiText text="Hent bedrifter på nytt" /></Button>}
      {result && <p role="status">{ui(result.invitationSent
        ? "{0} er opprettet i {1}. Invitasjonen er sendt til {2}."
        : "{0} er opprettet i {1}, men invitasjonen kunne ikke sendes. Del https://crm.noracre.no manuelt. Brukeren må registrere seg med {2}.",
        {"0":result.name,"1":result.companyName,"2":result.email})}
        {result.modules.length ? " "+ui("Tildelte moduler: {0}.",{"0":result.modules.map(module=>ui(module)).join(", ")}) : ""}</p>}
    </form>
    <Dialog open={Boolean(review)} onOpenChange={open => { if (!open && !busy) setReview(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle><UiText text="Opprett bruker i " />{review?.company.name}?</DialogTitle><DialogDescription>{review?.draft.name} · {review?.draft.email} · {ui(review?.draft.role)}</DialogDescription></DialogHeader>
        <p><UiText text="Tilgang: CRM" />{review && moduleCatalog.filter(module => review.draft.moduleKeys.includes(module.key)).map(module => ` + ${ui(module.name)}`).join("")}.</p>
        <p><UiText text="Bedriftens abonnement øker med " />{review ? totalPrice(review.company, review.draft) : 0}<UiText text=" kr per måned eks. mva. En invitasjon sendes til e-postadressen over." /></p>
        {error && <p role="alert">{ui(error)}</p>}
        <Button disabled={busy} onClick={create}>{busy ? ui("Oppretter …") : ui("Opprett bruker og send invitasjon")}</Button>
      </DialogContent>
    </Dialog>
  </>;
}

