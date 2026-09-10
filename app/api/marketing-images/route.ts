import { requireModuleAccess } from "@/lib/module-access";
import { env } from "cloudflare:workers";
import { safeImageType } from "@/lib/safe-image";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { marketingPostImages, moduleLicenses } from "@/db/schema";
import { AccessError, accessResponse, requireTenant } from "@/lib/tenant";

const bucket = () => env.BUCKET as R2Bucket;

const requireMarketing = (organizationId: number, membershipId: number) => requireModuleAccess(organizationId, membershipId, "markedsforing");

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
    if (!safeImageType(image.contentType)) return new Response(null, { status: 415 });
    const object = await bucket().get(image.objectKey);
    if (!object)
      return Response.json({ error: "Bildet finnes ikke." }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "content-type": image.contentType,
        "content-length": String(image.size),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return accessResponse(error);
  }
}
