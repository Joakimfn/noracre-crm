import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { marketingPostImages, moduleLicenses } from "@/db/schema";
import { AccessError, accessResponse, requireTenant } from "@/lib/tenant";

const bucket = () => env.BUCKET as R2Bucket;

async function requireMarketing(organizationId: number, membershipId: number) {
  const rows = await getDb()
    .select({ id: moduleLicenses.id })
    .from(moduleLicenses)
    .where(
      and(
        eq(moduleLicenses.organizationId, organizationId),
        eq(moduleLicenses.membershipId, membershipId),
        eq(moduleLicenses.moduleKey, "markedsforing"),
        eq(moduleLicenses.active, true),
      ),
    )
    .limit(1);
  if (!rows.length)
    throw new AccessError(
      403,
      "Markedsføringsmodulen er ikke aktivert.",
      "MODULE_REQUIRED",
    );
}

export async function GET(request: Request) {
  try {
    const ctx = await requireTenant(request);
    await requireMarketing(ctx.organizationId, ctx.membershipId);
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id)
      return Response.json({ error: "Bildet mangler." }, { status: 400 });
    const [image] = await getDb()
      .select()
      .from(marketingPostImages)
      .where(
        and(
          eq(marketingPostImages.id, id),
          eq(marketingPostImages.organizationId, ctx.organizationId),
        ),
      )
      .limit(1);
    if (!image)
      return Response.json({ error: "Bildet finnes ikke." }, { status: 404 });
    const object = await bucket().get(image.objectKey);
    if (!object)
      return Response.json({ error: "Bildet finnes ikke." }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "content-type": image.contentType,
        "content-length": String(image.size),
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return accessResponse(error);
  }
}
