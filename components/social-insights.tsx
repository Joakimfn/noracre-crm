"use client";
import {useI18n} from '@/lib/i18n/react';
import {UiText,useUiTranslation} from '@/lib/i18n/ui';

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

const reasons: Record<InsightReason,string> = {
  permission:"Tilgang til statistikk mangler. Administratoren må koble til på nytt og godkjenne statistikktilgangen. Hvis det ikke hjelper, må Noracre fullføre tillatelsene hos kanalen.",
  reconnect:"Kontoen må kobles til på nytt. Innlegg fra en tidligere tilkoblet konto krever tilgang til den samme kontoen.",
  unavailable:"Kanalen har ikke gjort alle tall tilgjengelige. Nye innlegg kan bruke tid på å få statistikk.",
  temporary:"Kunne ikke hente alle tall fra kanalen. Prøv å oppdatere statistikken senere.",
};
export function SocialInsights({organizationId, connections, revision}:{organizationId:number;connections:SocialState;revision:number}) {
 const i18n=useI18n();
 const number=(value:number|null)=>value===null?'—':i18n.number(value);
 const {ui}=useUiTranslation();
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
  return <section className="social-insights" aria-label={ui("Statistikk for publiserte innlegg")} aria-busy={loading}>
    <div className="social-insights-heading"><div><h3><UiText text="Resultater" /></h3><p><UiText text="Innlegg publisert via CRM-et de siste 30 dagene. Tallene viser resultatene siden publisering." /></p></div><Button size="sm" variant="outline" disabled={loading} onClick={() => setRefresh(value => value + 1)}>{loading ? ui("Henter statistikk …") : ui("Oppdater statistikk")}</Button></div>
    <div className="metric-grid social-insights-metrics">
      {[{label:"Visninger",...views},{label:"Engasjement",...engagement}].map(item => <div className="metric" key={item.label}><span>{ui(item.label)}</span><strong>{loading || error ? "—" : number(item.value)}</strong><small>{loading ? ui("Henter fra kanalene …") : error ? ui("Kunne ikke hentes") : entries.length && item.available < entries.length ? ui("Delvis statistikk · {0} av {1} publiseringer",{"0":item.available,"1":entries.length}) : item.label === "Visninger" ? ui("Antall ganger innholdet er vist") : ui("Reaksjoner, kommentarer, delinger og lagringer")}</small></div>)}
      <div className="metric"><span><UiText text="Publiseringer" /></span><strong>{loading || error ? "—" : number(entries.length)}</strong><small><UiText text="Siste 30 dager · fordelt på kanaler" /></small></div>
    </div>
    {error && <p role="alert" className="form-hint">{ui(error)}</p>}
    {!loading && !error && <>
      {!entries.length ? <p className="form-hint"><UiText text="Ingen innlegg er publisert gjennom CRM-et de siste 30 dagene." /></p> : <details className="social-insights-details"><summary><UiText text="Se tall og status per kanal" /></summary><div className="social-insights-table"><table><thead><tr><th><UiText text="Kanal" /></th><th><UiText text="Publiseringer" /></th><th><UiText text="Visninger" /></th><th><UiText text="Engasjement" /></th></tr></thead><tbody>{SOCIAL_CHANNELS.map(platform => {
        const rows = entries.filter(entry => entry.platform === platform); if (!rows.length) return null;
        return <tr key={platform}><th scope="row">{platform}</th><td>{number(rows.length)}</td>{(["views","engagement"] as const).map(name => {const result=total(rows,name);return <td key={name}>{number(result.value)}{result.available < rows.length && <small>{number(result.available)}<UiText text=" av " />{number(rows.length)}<UiText text=" med tall" /></small>}</td>;})}</tr>;
      })}</tbody></table></div><p className="form-hint"><UiText text="Visninger er ikke unike personer. Kanalene teller ulikt. Facebook: reaksjoner, kommentarer og delinger. Instagram inkluderer også lagringer. LinkedIn viser organiske visninger og reaksjoner, kommentarer og delinger." /></p></details>}
      {problems.map(problem => {const [platform,reason] = problem.split("|");return <p className="form-hint social-insights-notice" key={problem}><strong>{platform}:</strong> {ui(reasons[reason as InsightReason])}</p>;})}
      <p className="form-hint social-insights-updated"><UiText text="Hentet " />{i18n.date(new Date(updated),{hour:'2-digit',minute:'2-digit'})}<UiText text=". Kanalene kan rapportere tall med forsinkelse." /></p>
    </>}
  </section>;
}

