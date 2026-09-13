import { and, asc, eq, gt, gte, lte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { socialConnections, socialDeliveries } from "@/db/schema";
import { AccessError, accessResponse } from "@/lib/tenant";
import { socialAccess, tokenContext, unseal } from "@/lib/social-meta";
import { unsealLinkedIn } from "@/lib/social-linkedin";
import { fetchPostInsights, missingMetric } from "@/lib/social-insights";
import { SOCIAL_CHANNELS } from "@/lib/social-channels";

// Bounded pages avoid Worker subrequest limits. The client consumes every page.
// Only persisted publications in this tenant are accepted; never client-supplied post/account IDs.
export async function GET(request: Request) {
  try {
    const ctx = await socialAccess(request), params = new URL(request.url).searchParams;
    const cursor = Number(params.get("cursor") ?? 0);
    const until = params.get("until") ?? new Date().toISOString(), end = Date.parse(until);
    if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isFinite(end) || end > Date.now() + 60000 || end < Date.now() - 3600000)
      throw new AccessError(400, "Oppdater statistikken for å starte en ny innhenting.");
    const since = new Date(end - 30 * 86400000).toISOString();
    const rows = await getDb().select({id:socialDeliveries.id,platform:socialDeliveries.platform,accountId:socialDeliveries.accountId,remoteId:socialDeliveries.remoteId})
      .from(socialDeliveries).where(and(eq(socialDeliveries.organizationId, ctx.organizationId), eq(socialDeliveries.status, "published"),
        inArray(socialDeliveries.platform, [...SOCIAL_CHANNELS]), gt(socialDeliveries.id, cursor), gte(socialDeliveries.createdAt, since), lte(socialDeliveries.createdAt, new Date(end).toISOString())))
      .orderBy(asc(socialDeliveries.id)).limit(7);
    const connections = await getDb().select().from(socialConnections).where(eq(socialConnections.organizationId, ctx.organizationId));
    const tokens = new Map<number, Promise<string>>();
    const entries = await Promise.all(rows.slice(0, 6).map(async row => {
      const account = connections.find(c => c.platform === row.platform && c.accountId === row.accountId);
      const empty = (reason: "reconnect" | "unavailable") => ({ id:row.id, platform:row.platform, views:missingMetric(reason), engagement:missingMetric(reason) });
      if (!account || account.expiresAt <= Date.now()) return empty("reconnect");
      if (!row.remoteId) return empty("unavailable");
      try {
        if (!tokens.has(account.id)) tokens.set(account.id, (row.platform === "LinkedIn" ? unsealLinkedIn<string> : unseal<string>)(account.token, tokenContext(ctx.organizationId, row.platform, row.accountId)));
        const token = await tokens.get(account.id)!;
        return { id:row.id, platform:row.platform, ...await fetchPostInsights(row.platform, row.accountId, row.remoteId, token) };
      } catch { return empty("reconnect"); }
    }));
    return Response.json({entries, since, until:new Date(end).toISOString(), nextCursor:rows.length > 6 ? rows[5].id : null}, {headers:{"Cache-Control":"private, no-store"}});
  } catch (error) { return accessResponse(error); }
}
