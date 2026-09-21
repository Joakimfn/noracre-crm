"use client";
import {useCrmApi} from "@/lib/crm-api";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SOCIAL_CHANNELS } from "@/lib/social-channels";
import type { PostInsights, InsightReason } from "@/lib/social-insights";
import type { SocialState } from "@/components/social-connections";

type Entry = PostInsights & { id:number; platform:string };
function total(entries: Entry[], name: "views" | "engagement") {
  const values = entries.map(entry => entry[name].value).filter((value):value is number => value !== null);
  return { value:values.length || !entries.length ? values.reduce((sum, value) => sum + value, 0) : null, available:values.length };
}
const number = (value:number|null) => value === null ? "—" : value.toLocaleString("nb-NO");
const reasons: Record<InsightReason,string> = {
  permission:"Tilgang til statistikk mangler. Administratoren må koble til på nytt og godkjenne statistikktilgangen. Hvis det ikke hjelper, må Noracre fullføre tillatelsene hos kanalen.",
  reconnect:"Kontoen må kobles til på nytt. Innlegg fra en tidligere tilkoblet konto krever tilgang til den samme kontoen.",
  unavailable:"Kanalen har ikke gjort alle tall tilgjengelige. Nye innlegg kan bruke tid på å få statistikk.",
  temporary:"Kunne ikke hente alle tall fra kanalen. Prøv å oppdatere statistikken senere.",
};
export function SocialInsights({organizationId, connections, revision}:{organizationId:number;connections:SocialState;revision:number}) {
 const apiFetch=useCrmApi();

  const [entries, setEntries] = useState<Entry[]>([]), [loading,setLoading] = useState(true), [error,setError] = useState("");
  const [refresh,setRefresh] = useState(0), [updated,setUpdated] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);setError("");setEntries([]);setUpdated("");
    void (async () => {
      try {
        const all = new Map<number,Entry>(); let cursor = 0, until = "";
        do {
          const params = new URLSearchParams({cursor:String(cursor), ...(until ? {until} : {})});
          const response = await apiFetch(`/api/social/insights?${params}`, {headers:{"x-organization-id":String(organizationId)},signal:controller.signal});
          const data = await response.json();
          if (!response.ok) throw Error(data.error || "Kunne ikke hente statistikken.");
          if (controller.signal.aborted) return;
          for (const entry of data.entries as Entry[]) all.set(entry.id,entry);
          until = data.until;
          if (data.nextCursor !== null && (!Number.isSafeInteger(data.nextCursor) || data.nextCursor <= cursor)) throw Error("Kunne ikke hente hele statistikken.");
          cursor = data.nextCursor ?? 0;
        } while (cursor && !controller.signal.aborted);
        if (!controller.signal.aborted) {setEntries([...all.values()]);setUpdated(new Date().toISOString());}
      } catch (e) {if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Kunne ikke hente statistikken.");}
      finally {if (!controller.signal.aborted) setLoading(false);}
    })();
    return () => controller.abort();
  }, [organizationId, connections, revision, refresh]);
  const views = total(entries,"views"), engagement = total(entries,"engagement");
  const problems = [...new Set(entries.flatMap(entry => [entry.views.reason,entry.engagement.reason].filter(Boolean).map(reason => `${entry.platform}|${reason}`)))];
  return <section className="social-insights" aria-label="Statistikk for publiserte innlegg" aria-busy={loading}>
    <div className="social-insights-heading"><div><h3>Resultater</h3><p>Innlegg publisert via CRM-et de siste 30 dagene. Tallene viser resultatene siden publisering.</p></div><Button size="sm" variant="outline" disabled={loading} onClick={() => setRefresh(value => value + 1)}>{loading ? "Henter statistikk …" : "Oppdater statistikk"}</Button></div>
    <div className="metric-grid social-insights-metrics">
      {[{label:"Visninger",...views},{label:"Engasjement",...engagement}].map(item => <div className="metric" key={item.label}><span>{item.label}</span><strong>{loading || error ? "—" : number(item.value)}</strong><small>{loading ? "Henter fra kanalene …" : error ? "Kunne ikke hentes" : entries.length && item.available < entries.length ? `Delvis statistikk · ${item.available} av ${entries.length} publiseringer` : item.label === "Visninger" ? "Antall ganger innholdet er vist" : "Reaksjoner, kommentarer, delinger og lagringer"}</small></div>)}
      <div className="metric"><span>Publiseringer</span><strong>{loading || error ? "—" : number(entries.length)}</strong><small>Siste 30 dager · fordelt på kanaler</small></div>
    </div>
    {error && <p role="alert" className="form-hint">{error}</p>}
    {!loading && !error && <>
      {!entries.length ? <p className="form-hint">Ingen innlegg er publisert gjennom CRM-et de siste 30 dagene.</p> : <details className="social-insights-details"><summary>Se tall og status per kanal</summary><div className="social-insights-table"><table><thead><tr><th>Kanal</th><th>Publiseringer</th><th>Visninger</th><th>Engasjement</th></tr></thead><tbody>{SOCIAL_CHANNELS.map(platform => {
        const rows = entries.filter(entry => entry.platform === platform); if (!rows.length) return null;
        return <tr key={platform}><th scope="row">{platform}</th><td>{rows.length}</td>{(["views","engagement"] as const).map(name => {const result=total(rows,name);return <td key={name}>{number(result.value)}{result.available < rows.length && <small>{result.available} av {rows.length} med tall</small>}</td>;})}</tr>;
      })}</tbody></table></div><p className="form-hint">Visninger er ikke unike personer. Kanalene teller ulikt. Facebook: reaksjoner, kommentarer og delinger. Instagram inkluderer også lagringer. LinkedIn viser organiske visninger og reaksjoner, kommentarer og delinger.</p></details>}
      {problems.map(problem => {const [platform,reason] = problem.split("|");return <p className="form-hint social-insights-notice" key={problem}><strong>{platform}:</strong> {reasons[reason as InsightReason]}</p>;})}
      <p className="form-hint social-insights-updated">Hentet {new Date(updated).toLocaleTimeString("nb-NO",{hour:"2-digit",minute:"2-digit"})}. Kanalene kan rapportere tall med forsinkelse.</p>
    </>}
  </section>;
}
