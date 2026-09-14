"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { moduleCatalog, type ModuleKey } from "@/lib/module-catalog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Company = { id: number; name: string; status: string; crmPrice: number | null; ringPrice: number | null; marketingPrice: number | null; scheduledDisableAt: string };
type Draft = { organizationId: number; name: string; email: string; phone: string; role: string; moduleKeys: ModuleKey[] };
const emptyDraft: Draft = { organizationId: 0, name: "", email: "", phone: "", role: "Bruker", moduleKeys: [] };
const totalPrice = (company: Company, draft: Draft) => (company.crmPrice ?? 0) + moduleCatalog.filter(module => draft.moduleKeys.includes(module.key)).reduce((sum, module) => sum + (company[module.priceKey] ?? 0), 0);

export function CompanyUserCreate({ organizationId, refreshKey, onCreated }: {
  organizationId: number; refreshKey: number; onCreated: () => void;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [review, setReview] = useState<{ draft: Draft; company: Company } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
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
  }, [organizationId, refreshKey, reload]);
  const activeCompanies = companies.filter(company => company.status === "Aktiv" && (!company.scheduledDisableAt || company.scheduledDisableAt > new Date().toISOString()));
  const selected = activeCompanies.find(company => company.id === draft.organizationId);
  async function create() {
    if (!review || locked.current) return;
    locked.current = true;
    setBusy(true); setError(""); setResult("");
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
      const modulesText = review.draft.moduleKeys.length ? ` Tildelte moduler: ${moduleCatalog.filter(module => review.draft.moduleKeys.includes(module.key)).map(module => module.name).join(", ")}.` : "";
      setResult((data.invitationSent
        ? `${review.draft.name} er opprettet i ${review.company.name}. Invitasjonen er sendt til ${review.draft.email}.`
        : `${review.draft.name} er opprettet i ${review.company.name}, men invitasjonen kunne ikke sendes. Del https://crm.noracre.no manuelt. Brukeren må registrere seg med ${review.draft.email}.`) + modulesText);
      setDraft({ ...emptyDraft, organizationId: review.draft.organizationId });
      setReview(null);
      onCreated();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sendingen kunne ikke bekreftes. Kontroller brukerlisten før du prøver igjen.");
    } finally { locked.current = false; setBusy(false); }
  }
  return <>
    <p>Opprett tilgang for en bruker i en eksisterende bedrift. Nye brukere velger selv passord via innloggingssiden.</p>
    <form className="organization-form" onSubmit={event => {
      event.preventDefault();
      if (selected && selected.crmPrice != null) { setError(""); setResult(""); setReview({ draft: { ...draft, name: draft.name.trim(), email: draft.email.trim().toLowerCase() }, company: selected }); }
    }}>
      <Label htmlFor="customer-user-company">Bedrift</Label>
      <Select value={draft.organizationId ? String(draft.organizationId) : ""} onValueChange={value => setDraft({ ...draft, organizationId: Number(value), moduleKeys: [] })} disabled={loading || busy}>
        <SelectTrigger id="customer-user-company"><SelectValue placeholder={loading ? "Henter bedrifter …" : "Velg bedrift"} /></SelectTrigger>
        <SelectContent>{activeCompanies.map(company => <SelectItem key={company.id} value={String(company.id)}>{company.name}</SelectItem>)}</SelectContent>
      </Select>
      <Label htmlFor="customer-user-name">Navn</Label>
      <Input id="customer-user-name" required maxLength={160} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} />
      <Label htmlFor="customer-user-email">E-post</Label>
      <Input id="customer-user-email" type="email" required maxLength={254} value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} />
      <Label htmlFor="customer-user-phone">Telefon (valgfritt)</Label>
      <Input id="customer-user-phone" type="tel" maxLength={50} value={draft.phone} onChange={event => setDraft({ ...draft, phone: event.target.value })} />
      <Label htmlFor="customer-user-role">Rolle</Label>
      <Select value={draft.role} onValueChange={role => setDraft({ ...draft, role })}>
        <SelectTrigger id="customer-user-role"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="Bruker">Bruker</SelectItem><SelectItem value="Administrator">Administrator</SelectItem></SelectContent>
      </Select>
      <fieldset className="company-user-modules" disabled={!selected || loading || busy}>
        <legend>Tilleggsmoduler (valgfritt)</legend>
        {moduleCatalog.map(module => <label key={module.key}>
          <input type="checkbox" checked={draft.moduleKeys.includes(module.key)} disabled={!selected || selected[module.priceKey] == null}
            onChange={event => setDraft({ ...draft, moduleKeys: event.target.checked ? [...draft.moduleKeys, module.key] : draft.moduleKeys.filter(key => key !== module.key) })} />
          <span><strong>{module.name}</strong><small>{!selected ? "Velg bedrift først" : selected[module.priceKey] == null ? "Avtal pris under Drift for å aktivere" : `${selected[module.priceKey]} kr per måned`}</small></span>
        </label>)}
      </fieldset>
      <p className="form-hint">{selected ? selected.crmPrice == null ? "Avtal CRM-pris under Drift før brukeren opprettes." : `CRM: ${selected.crmPrice} kr. Totalt for denne brukeren: ${totalPrice(selected, draft)} kr per måned eks. mva.` : "Velg bedriften brukeren skal ha tilgang til."}</p>
      <Button type="submit" disabled={loading || busy || !selected || selected.crmPrice == null || !draft.name.trim() || !draft.email.trim()}>Opprett bedriftsbruker</Button>
      {error && !review && <p role="alert">{error}</p>}
      {!loading && !companies.length && <Button type="button" variant="outline" onClick={() => setReload(value => value + 1)}>Hent bedrifter på nytt</Button>}
      {result && <p role="status">{result}</p>}
    </form>
    <Dialog open={Boolean(review)} onOpenChange={open => { if (!open && !busy) setReview(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Opprett bruker i {review?.company.name}?</DialogTitle><DialogDescription>{review?.draft.name} · {review?.draft.email} · {review?.draft.role}</DialogDescription></DialogHeader>
        <p>Tilgang: CRM{review && moduleCatalog.filter(module => review.draft.moduleKeys.includes(module.key)).map(module => ` + ${module.name}`).join("")}.</p>
        <p>Bedriftens abonnement øker med {review ? totalPrice(review.company, review.draft) : 0} kr per måned eks. mva. En invitasjon sendes til e-postadressen over.</p>
        {error && <p role="alert">{error}</p>}
        <Button disabled={busy} onClick={create}>{busy ? "Oppretter …" : "Opprett bruker og send invitasjon"}</Button>
      </DialogContent>
    </Dialog>
  </>;
}
