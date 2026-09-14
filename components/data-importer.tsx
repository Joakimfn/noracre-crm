"use client";
import {useMemo,useRef,useState} from 'react';
import * as XLSX from 'xlsx';
import {apiFetch} from '@/lib/api-client';
import {fieldsForMode,guessColumns,mapImportRow,importRowProblem,type ImportMode} from '@/lib/data-import';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';

type Totals={customers:number;contacts:number;activities:number;skipped:number;processed:number};
const empty:Totals={customers:0,contacts:0,activities:0,skipped:0,processed:0};
export function DataImporter({organizationId,onImported}:{organizationId:number;onImported:()=>Promise<void>}){
 const [book,setBook]=useState<XLSX.WorkBook|null>(null),[sheet,setSheet]=useState(''),[fileName,setFileName]=useState(''),[mode,setMode]=useState<ImportMode>('customers'),[source,setSource]=useState('Import'),[mapping,setMapping]=useState<Record<string,number>>({}),[headerRow,setHeaderRow]=useState(1),[error,setError]=useState(''),[busy,setBusy]=useState(false),[started,setStarted]=useState(false),[done,setDone]=useState(false),[totals,setTotals]=useState<Totals>(empty);
 const run=useRef({id:'',next:0}),lock=useRef(false);
 const matrix=useMemo(()=>book&&sheet?XLSX.utils.sheet_to_json<string[]>(book.Sheets[sheet],{header:1,defval:'',raw:false,blankrows:true}).map(row=>row.map(String)):[],[book,sheet]);
 const headers=matrix[headerRow-1]??[],rows=matrix.slice(headerRow).map((cells,index)=>({cells,line:headerRow+index+1})).filter(row=>row.cells.some(c=>c.trim())),mapped=rows.map(row=>mapImportRow(row.cells,mapping));
 const issues=mapped.map((row,index)=>({line:rows[index].line,message:importRowProblem(row,mode)})).filter(x=>x.message);
 function configure(nextSheet:string,nextMode:ImportMode,nextHeader:number,nextBook=book){setSheet(nextSheet);setMode(nextMode);setHeaderRow(nextHeader);const cells=nextBook?XLSX.utils.sheet_to_json<string[]>(nextBook.Sheets[nextSheet],{header:1,defval:'',raw:false,blankrows:true}):[];setMapping(guessColumns((cells[nextHeader-1]??[]).map(String),nextMode));setError('');}
 async function read(file:File|undefined){if(!file)return;setError('');setBook(null);setFileName('');try{if(file.size>5*1024*1024)throw Error('Filen kan være maks 5 MB.');const next=XLSX.read(await file.arrayBuffer(),{cellDates:true,dateNF:'yyyy-mm-dd"T"hh:mm:ss'});if(!next.SheetNames.length)throw Error('Filen inneholder ingen regneark.');setBook(next);setFileName(file.name);configure(next.SheetNames[0],mode,1,next);}catch(e){setError(e instanceof Error?e.message:'Kunne ikke lese filen.');}}
 async function start(){if(lock.current||!rows.length||issues.length||rows.length>5000)return;lock.current=true;setBusy(true);setStarted(true);setError('');if(!run.current.id)run.current={id:crypto.randomUUID(),next:0};try{
  for(let index=run.current.next;index<mapped.length;index+=50){const response=await apiFetch('/api/import',{method:'POST',headers:{'content-type':'application/json','x-organization-id':String(organizationId)},body:JSON.stringify({mode,source,rows:mapped.slice(index,index+50),requestId:`${run.current.id}-${index}`})});const result=await response.json();if(!response.ok)throw Error(`Importdel som starter på filrad ${rows[index].line}: ${result.error||'Kunne ikke importere.'}`);setTotals(prev=>Object.fromEntries(Object.keys(empty).map(k=>[k,prev[k as keyof Totals]+result[k]])) as Totals);run.current.next=index+50;}
  setDone(true);await onImported();
 }catch(e){setError(e instanceof Error?e.message:'Importen ble avbrutt. Du kan fortsette trygt.');}finally{setBusy(false);lock.current=false;}}
 function reset(){setBook(null);setFileName('');setStarted(false);setDone(false);setTotals(empty);setError('');run.current={id:'',next:0};}
 return <div className="data-importer"><p>Ta med kunder, kontaktpersoner og aktivitetshistorikk fra CSV, Excel eller eksportfiler fra andre CRM-systemer.</p>
 <fieldset disabled={started||busy} className="import-setup"><label>Hva vil du importere?<select value={mode} onChange={e=>configure(sheet,e.target.value as ImportMode,headerRow)}><option value="customers">Kunder, med kontaktperson og neste oppfølging</option><option value="contacts">Flere kontaktpersoner til eksisterende kunder</option><option value="activities">Aktivitetshistorikk og oppfølginger</option></select></label><label>Navn på tidligere system / datakilde<Input value={source} maxLength={100} onChange={e=>setSource(e.target.value)}/></label>
 <label className="upload-box"><strong>{fileName||'Velg eksportfil eller regneark'}</strong><span>.csv, .xlsx, .xls eller .ods · maks 5 MB og 5 000 rader</span><input type="file" accept=".csv,.xlsx,.xls,.ods" onChange={e=>void read(e.target.files?.[0])}/></label>
 {book&&<><label>Regneark<select value={sheet} onChange={e=>configure(e.target.value,mode,1)}>{book.SheetNames.map(name=><option key={name}>{name}</option>)}</select></label><label>Rad med kolonneoverskrifter<Input type="number" min={1} max={Math.max(matrix.length,1)} value={headerRow} onChange={e=>configure(sheet,mode,Math.max(1,Number(e.target.value)))}/></label><div className="import-mapping">{fieldsForMode(mode).map(field=><label key={field.key}>{field.label}<select value={mapping[field.key]??-1} onChange={e=>setMapping({...mapping,[field.key]:Number(e.target.value)})}><option value={-1}>Ikke importer dette feltet</option>{headers.map((title,index)=><option key={index} value={index}>{title||`Kolonne ${index+1}`} ({XLSX.utils.encode_col(index)})</option>)}</select></label>)}</div></>}
 </fieldset>
 {book&&!done&&<><h4>Forhåndsvisning · {rows.length} rader</h4><p>Kontroller at kolonnene er koblet riktig før du starter.</p><div className="import-table"><table><thead><tr><th>Filrad</th>{fieldsForMode(mode).filter(f=>(mapping[f.key]??-1)>=0).map(f=><th key={f.key}>{f.label}</th>)}</tr></thead><tbody>{mapped.slice(0,5).map((row,index)=><tr key={index}><td>{rows[index].line}</td>{fieldsForMode(mode).filter(f=>(mapping[f.key]??-1)>=0).map(f=><td key={f.key}>{row[f.key]||'—'}</td>)}</tr>)}</tbody></table></div>{issues.length>0&&<p role="alert">{issues.length} rader mangler påkrevde felt. {issues.slice(0,3).map(x=>`Rad ${x.line}: ${x.message}`).join('. ')}.</p>}{rows.length>5000&&<p role="alert">Del filen i deler med maks 5 000 rader.</p>}</>}
 {started&&<p role="status">{totals.processed} av {rows.length} rader behandlet. {totals.customers} kunder, {totals.contacts} kontaktpersoner og {totals.activities} aktiviteter opprettet. {totals.skipped} rader uten nye data.</p>}
 {error&&<p role="alert">{error}</p>}
 {!done&&book&&<Button disabled={busy||!rows.length||!!issues.length||rows.length>5000} onClick={()=>void start()}>{busy?'Importerer …':started?'Fortsett import':'Importer data'}</Button>}
 {done&&<p role="status">Importen er fullført.</p>}
 {started&&!busy&&<Button variant="outline" onClick={reset}>{done?'Importer en ny fil':'Avslutt denne importen'}</Button>}
 <small>Importer kundene først, deretter eventuelle filer med kontakter og historikk. Knytt dem sammen med bedriftsnavn, organisasjonsnummer eller kunde-ID, og bruk samme datakilde. Eksisterende opplysninger overskrives ikke. Vedlegg importeres separat. La denne siden stå åpen mens importen pågår.</small>
 </div>;
}
