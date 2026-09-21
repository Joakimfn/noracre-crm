import {canViewAdministration} from "@/lib/roles";
import { actorJson, actorRef } from "@/lib/actor-names";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { offerTemplates } from "@/db/schema";
import { AccessError, accessResponse, requireTenant } from "@/lib/tenant";

function requireAdmin(ctx: Awaited<ReturnType<typeof requireTenant>>) {
  if (!canViewAdministration(ctx.role))
    throw new AccessError(403, "Bare administrator kan endre tilbudsmaler.");
}

export async function GET(request: Request) {
  try {
    const ctx = await requireTenant(request);
    return await actorJson(ctx,{
      templates: await getDb()
        .select()
        .from(offerTemplates)
        .where(eq(offerTemplates.organizationId, ctx.organizationId))
        .orderBy(desc(offerTemplates.id)),
      workEmailConnected: false,
    });
  } catch (e) {
    return accessResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    const ctx = await requireTenant(request),
      data = (await request.json()) as Record<string, unknown>,
      now = new Date().toISOString(),
      name = String(data.name ?? "").trim();
    requireAdmin(ctx);
    if (!name)
      return await actorJson(ctx,{ error: "Malnavn må fylles ut." }, { status: 400 });
    const [template] = await getDb()
      .insert(offerTemplates)
      .values({
        organizationId: ctx.organizationId,
        name,
        subject: String(data.subject ?? ""),
        body: String(data.body ?? ""),
        createdBy: actorRef(ctx.user),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return await actorJson(ctx,{ template }, { status: 201 });
  } catch (e) {
    return accessResponse(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const ctx = await requireTenant(request),
      data = (await request.json()) as Record<string, unknown>,
      id = Number(data.id),
      name = String(data.name ?? "").trim();
    requireAdmin(ctx);
    if (!id || !name) return await actorJson(ctx,{ error: "Malnavn må fylles ut." }, { status: 400 });
    const [template] = await getDb().update(offerTemplates).set({
      name,
      subject: String(data.subject ?? ""),
      body: String(data.body ?? ""),
      updatedAt: new Date().toISOString(),
    }).where(and(eq(offerTemplates.id, id), eq(offerTemplates.organizationId, ctx.organizationId))).returning();
    return template ? actorJson(ctx,{ template }) : actorJson(ctx,{ error: "Malen finnes ikke." }, { status: 404 });
  } catch (e) {
    return accessResponse(e);
  }
}
export async function DELETE(request: Request) {
  try {
    const ctx = await requireTenant(request),
      id = Number(new URL(request.url).searchParams.get("id"));
    requireAdmin(ctx);
    await getDb()
      .delete(offerTemplates)
      .where(
        and(
          eq(offerTemplates.id, id),
          eq(offerTemplates.organizationId, ctx.organizationId),
        ),
      );
    return await actorJson(ctx,{ ok: true });
  } catch (e) {
    return accessResponse(e);
  }
}
