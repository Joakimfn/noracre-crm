import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from '@/db';
import { companies, memberships, organizations, outboundCompanyOwnership, userProfiles } from '@/db/schema';
import { AccessError, type requireTenant } from '@/lib/tenant';
import { canManageModules } from '@/lib/module-access';
import { outboundRegistryExpression } from './outbound-identity';

type Context = Awaited<ReturnType<typeof requireTenant>>;
export async function outboundCompanyScope(ctx: Context): Promise<SQL | undefined> {
  if (canManageModules(ctx.role) || ctx.role === 'Support') return undefined;
  const [org] = await getDb().select({ enabled: organizations.outboundEnabled }).from(organizations).where(eq(organizations.id, ctx.organizationId)).limit(1);
  if (!org?.enabled) return undefined;
  const registry = outboundRegistryExpression(companies.orgNumber, companies.country);
  const ownerKey = sql`${outboundCompanyOwnership.organizationId} = ${ctx.organizationId} and ${outboundCompanyOwnership.country} = ${companies.country} and ${outboundCompanyOwnership.orgNumber} = ${registry}`;
  // A membership identity is stable when the seller changes their display name.
  const identityPrefix = 'crm-actor:v1:' + JSON.stringify([ctx.user.id]).slice(0, -1) + ',';
  const peers = await getDb().select({ name: memberships.name, email: memberships.email, userId: memberships.userId, displayName: userProfiles.displayName }).from(memberships).leftJoin(userProfiles,eq(userProfiles.userId,memberships.userId)).where(eq(memberships.organizationId, ctx.organizationId));
  const aliases = [ctx.user.displayName, ctx.user.email].filter(alias => !peers.some(peer => peer.userId !== ctx.user.id && [peer.name,peer.email,peer.displayName].some(value=>value?.trim().toLowerCase() === alias.trim().toLowerCase())));
  const personal = or(sql`substr(${companies.assignedTo},1,${identityPrefix.length}) = ${identityPrefix}`, aliases.length ? inArray(companies.assignedTo, aliases) : undefined);
  return or(
    sql`exists(select 1 from ${outboundCompanyOwnership} where ${ownerKey} and ${outboundCompanyOwnership.assignedMembershipId} = ${ctx.membershipId})`,
    and(sql`not exists(select 1 from ${outboundCompanyOwnership} where ${ownerKey})`, personal),
  );
}

export async function requireOutboundCompany(ctx: Context, companyId: number) {
  const scope = await outboundCompanyScope(ctx);
  if (!scope) return;
  const [company] = await getDb().select({ id: companies.id }).from(companies).where(and(eq(companies.organizationId, ctx.organizationId), eq(companies.id, companyId), scope)).limit(1);
  if (!company) throw new AccessError(404, 'Kunden finnes ikke eller er tildelt en annen selger.');
}

export async function outboundCompanyIds(ctx: Context) {
  const scope = await outboundCompanyScope(ctx);
  return scope ? {query: getDb().select({ id: companies.id }).from(companies).where(and(eq(companies.organizationId, ctx.organizationId), scope))} : undefined;
}

export async function requireOwnCompanyAssignment(ctx: Context, assignedTo: unknown) {
  if (!(await outboundCompanyScope(ctx))) return;
  if (assignedTo && assignedTo !== ctx.user.displayName && assignedTo !== ctx.user.email)
    throw new AccessError(403, 'Bare administrator kan tildele kunder til andre selgere.');
}

export async function requireOwnRegistryAssignment(ctx: Context, country: string, orgNumber: string) {
  if (!orgNumber || !(await outboundCompanyScope(ctx))) return;
  const [owner] = await getDb().select({ membershipId: outboundCompanyOwnership.assignedMembershipId }).from(outboundCompanyOwnership).where(and(eq(outboundCompanyOwnership.organizationId, ctx.organizationId), eq(outboundCompanyOwnership.country, country), eq(outboundCompanyOwnership.orgNumber, orgNumber))).limit(1);
  if (owner && owner.membershipId !== ctx.membershipId)
    throw new AccessError(403, 'Denne bedriften er allerede tildelt en annen selger.');
}
