// Small, bounded batches run independently of browser requests.
export async function applyScheduledDeactivations(db:D1Database,now=new Date().toISOString()){
 await db.batch([
  db.prepare("UPDATE team_members SET active=0 WHERE EXISTS (SELECT 1 FROM memberships m WHERE m.organization_id=team_members.organization_id AND m.email=team_members.email AND m.scheduled_disable_at<>'' AND m.scheduled_disable_at<=?)").bind(now),
  db.prepare("UPDATE memberships SET active=0,scheduled_disable_at='' WHERE scheduled_disable_at<>'' AND scheduled_disable_at<=?").bind(now),
  db.prepare("UPDATE organizations SET status='Deaktivert',deactivated_at=scheduled_disable_at,retain_until=strftime('%Y-%m-%dT%H:%M:%fZ',scheduled_disable_at,'+90 days'),scheduled_disable_at='' WHERE scheduled_disable_at<>'' AND scheduled_disable_at<=?").bind(now),
 ]);
}
export function osloSchedule(date:Date){
 const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const get=(key:string)=>parts.find(p=>p.type===key)!.value;
 return {day:`${get('year')}-${get('month')}-${get('day')}`,ready:`${get('hour')}:${get('minute')}`>='03:30'};
}
export async function refreshBrregBatch(db:D1Database,date=new Date(),fetcher:typeof fetch=fetch){
 const now=date.toISOString(),schedule=osloSchedule(date);
 if(!schedule.ready)return;
 await db.prepare("INSERT OR IGNORE INTO background_jobs (key) VALUES ('brreg')").run();
 await db.prepare("UPDATE background_jobs SET day=?,cursor=0,completed_at='',failures=0 WHERE key='brreg' AND day<>? AND (lease_until='' OR lease_until<?) AND (day='' OR completed_at<>'')").bind(schedule.day,schedule.day,now).run();
 const lease=new Date(date.getTime()+120000).toISOString();
 const claimed=await db.prepare("UPDATE background_jobs SET lease_until=? WHERE key='brreg' AND completed_at='' AND (lease_until='' OR lease_until<?) RETURNING cursor").bind(lease,now).first<{cursor:number}>();
 if(!claimed)return;
 try{
  const rows=await db.prepare("SELECT c.id,c.org_number FROM companies c JOIN organizations o ON o.id=c.organization_id WHERE c.id>? AND c.customer_type='Bedrift' AND length(c.org_number)=9 AND o.status='Aktiv' ORDER BY c.id LIMIT 10").bind(claimed.cursor).all<{id:number;org_number:string}>();
  let failures=0;
  for(const row of rows.results){
   if(!/^\d{9}$/.test(row.org_number))continue;
   try{
    const r=await fetcher(`https://data.brreg.no/enhetsregisteret/api/enheter/${row.org_number}`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000)});
    if(!r.ok)throw Error(`Brreg HTTP ${r.status}`);
    const data=await r.json() as {organisasjonsnummer?:string;navn?:string;naeringskode1?:{beskrivelse?:string};forretningsadresse?:{poststed?:string};antallAnsatte?:number};
    if(data.organisasjonsnummer!==row.org_number||!data.navn)throw Error('Invalid Brreg response');
    await db.prepare("UPDATE companies SET name=?,industry=COALESCE(?,industry),city=COALESCE(?,city),employees=COALESCE(?,employees),synced_at=? WHERE id=? AND org_number=?")
     .bind(data.navn,data.naeringskode1?.beskrivelse??null,data.forretningsadresse?.poststed??null,data.antallAnsatte??null,now,row.id,row.org_number).run();
   }catch{failures++;console.error('Brreg update failed for company',row.id);}
  }
  await db.prepare("UPDATE background_jobs SET cursor=?,completed_at=?,failures=failures+?,lease_until='' WHERE key='brreg' AND lease_until=?")
   .bind(rows.results.at(-1)?.id??claimed.cursor,rows.results.length<10?now:'',failures,lease).run();
 }catch(error){await db.prepare("UPDATE background_jobs SET lease_until='' WHERE key='brreg' AND lease_until=?").bind(lease).run();throw error;}
}
