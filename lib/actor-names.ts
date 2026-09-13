import type { BatchItem } from "drizzle-orm/batch";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { activities, attachments, auditLogs, callListEntries, companies, marketingPosts, memberships, offerTemplates, supportRequests, teamMembers, userProfiles } from "@/db/schema";

// Versioned identity references fit the existing attribution columns. API responses
// always resolve them to display names; the snapshot remains if the account is removed.
const prefix = "crm-actor:v1:";
const fields = new Set(["createdBy", "uploadedBy", "actor", "handledBy", "assignedTo", "requestedBy"]);
export function actorRef(user: {id:string;displayName:string}) {return prefix + JSON.stringify([user.id,user.displayName]);}
function readRef(value:string): [string,string]|null {
  if(!value.startsWith(prefix))return null;
  try {const ref=JSON.parse(value.slice(prefix.length));return Array.isArray(ref)&&ref.length===2&&ref.every(v=>typeof v==='string') ? [ref[0],ref[1]] : null;}catch{return null;}
}
const key=(s:string)=>s.trim().toLocaleLowerCase("nb-NO");
async function directory(orgIds:number[]) {
  return getDb().select({userId:memberships.userId,organizationId:memberships.organizationId,name:memberships.name,email:memberships.email,displayName:userProfiles.displayName})
    .from(memberships).leftJoin(userProfiles,eq(userProfiles.userId,memberships.userId)).where(inArray(memberships.organizationId,orgIds));
}
function matches(rows:Awaited<ReturnType<typeof directory>>,name:string) {
  return rows.filter(row=>[row.name,row.email,row.displayName].some(alias=>alias&&key(alias)===key(name)));
}
export async function resolveActorNames<T>(organizationId:number,data:T):Promise<T> {
  const orgs=new Set([organizationId]), ids=new Set<string>();let hasActors=false;
  function collect(value:unknown){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(collect);return;}const obj=value as Record<string,unknown>;if(typeof obj.organizationId==='number')orgs.add(obj.organizationId);for(const [k,v] of Object.entries(obj)){if(fields.has(k)&&typeof v==='string'&&v){hasActors=true;const ref=readRef(v);if(ref?.[0])ids.add(ref[0]);}else collect(v);}}
  collect(data);if(!hasActors)return data;
  const rows=await directory([...orgs]);
  const profiles=ids.size ? await getDb().select({userId:userProfiles.userId,name:userProfiles.displayName}).from(userProfiles).where(inArray(userProfiles.userId,[...ids])) : [];
  function walk(value:unknown,org:number):unknown {
    if(Array.isArray(value))return value.map(v=>walk(v,org));if(!value||typeof value!=='object')return value;
    const obj=value as Record<string,unknown>;org=typeof obj.organizationId==='number'?obj.organizationId:org;
    return Object.fromEntries(Object.entries(obj).map(([k,v])=>{
      if(!fields.has(k)||typeof v!=='string')return [k,walk(v,org)];
      const ref=readRef(v), local=rows.filter(r=>r.organizationId===org);
      if(ref){const member=local.find(r=>r.userId===ref[0]);return [k,profiles.find(p=>p.userId===ref[0])?.name?.trim()||member?.displayName?.trim()||member?.name||ref[1]];}
      const candidates=matches(local,v),ids=new Set(candidates.map(c=>c.userId));
      return [k,ids.size===1 ? candidates[0].displayName?.trim()||candidates[0].name||v : v];
    }));
  }
  return walk(data,organizationId) as T;
}
export async function actorJson(ctx:{organizationId:number},data:unknown,init?:ResponseInit) {
  return Response.json(await resolveActorNames(ctx.organizationId,data),init);
}
export async function assignmentRef(organizationId:number,name:string,existing?:string) {
  // A round trip must not discard the identity when two users share a display name.
  if(existing && (await resolveActorNames(organizationId,{assignedTo:existing})).assignedTo===name)return existing;
  const rows=matches(await directory([organizationId]),name);
  if(new Set(rows.map(r=>r.userId)).size===1)return actorRef({id:rows[0].userId,displayName:rows[0].displayName||rows[0].name});
  // Do not accept caller-supplied internal identity references.
  return readRef(name) ? readRef(name)![1] : name;
}

export async function renameProfile(user:{id:string;email:string;displayName:string},values:typeof userProfiles.$inferInsert,existing:typeof userProfiles.$inferSelect|undefined) {
  const db=getDb();
  const mine=await db.select().from(memberships).where(eq(memberships.userId,user.id));
  const statements: [BatchItem<"sqlite">,...BatchItem<"sqlite">[]] = [db.insert(userProfiles).values(values).onConflictDoUpdate({target:userProfiles.userId,set:values})];
  for(const member of mine){
    const peers=await directory([member.organizationId]);
    const knownAliases=[...new Set([member.name,member.email,user.email,user.displayName,existing?.displayName??''].filter(Boolean))];
    const aliases=knownAliases.filter(alias=>!peers.some(peer=>peer.userId!==user.id&&[peer.name,peer.email,peer.displayName].some(value=>value&&key(value)===key(alias))));
    const ambiguous=knownAliases.filter(alias=>!aliases.includes(alias));
    // Old rows only contain text. Adopt unambiguous matches; never guess between namesakes.
    const reference=actorRef({id:user.id,displayName:values.displayName||user.displayName});
    for(const [table,column] of [[activities,activities.createdBy],[attachments,attachments.uploadedBy],[auditLogs,auditLogs.actor],[callListEntries,callListEntries.handledBy],[companies,companies.assignedTo],[marketingPosts,marketingPosts.createdBy],[offerTemplates,offerTemplates.createdBy],[supportRequests,supportRequests.requestedBy]] as const){

      const property = column.name==='created_by'?'createdBy':column.name==='uploaded_by'?'uploadedBy':column.name==='handled_by'?'handledBy':column.name==='assigned_to'?'assignedTo':column.name==='requested_by'?'requestedBy':'actor';
      // Every query is constrained to this authenticated user's own organization and exact old labels.
      if(aliases.length)statements.push(db.update(table).set({[property]:reference}).where(and(eq(table.organizationId,member.organizationId),inArray(column,aliases))));
      // Freeze unidentified legacy labels so a later rename by a namesake cannot adopt them.
      for(const alias of ambiguous)statements.push(db.update(table).set({[property]:actorRef({id:"",displayName:alias})}).where(and(eq(table.organizationId,member.organizationId),eq(column,alias))));
    }
    statements.push(db.update(teamMembers).set({name:values.displayName||user.displayName}).where(and(eq(teamMembers.organizationId,member.organizationId),eq(teamMembers.email,member.email))));
  }
  statements.push(db.update(memberships).set({name:values.displayName||user.displayName}).where(eq(memberships.userId,user.id)));
  // D1 batch is atomic: a profile cannot be saved halfway through updating its references.
  await db.batch(statements);
}
