import { actorJson, actorRef } from "@/lib/actor-names";
import { SOCIAL_CHANNELS } from "@/lib/social-channels";
import { requireModuleAccess } from "@/lib/module-access";
import { env } from "cloudflare:workers";
import { validateImage } from "@/lib/safe-image";
import { and, desc, eq, ne, sql, inArray, count } from "drizzle-orm";
import { getDb } from "@/db";
import {
  marketingPostImages,
  marketingPosts,
  socialDeliveries,
  moduleLicenses,
} from "@/db/schema";
import { AccessError, accessResponse, requireTenant } from "@/lib/tenant";

const bucket = () => env.BUCKET as R2Bucket;

const requireMarketing = (organizationId: number, membershipId: number) => requireModuleAccess(organizationId, membershipId, "markedsforing");

export async function GET(request: Request) {
  try {
    const ctx = await requireTenant(request);
    await requireMarketing(ctx.organizationId, ctx.membershipId);
    const db = getDb(), params = new URL(request.url).searchParams;
    const view = params.get("view"), paginated = view === "upcoming" || view === "history";
    const scope = and(eq(marketingPosts.organizationId, ctx.organizationId), ne(marketingPosts.status, "Slettet"));
    const totals = await db.select({status:marketingPosts.status, total:count()}).from(marketingPosts).where(scope).groupBy(marketingPosts.status);
    const published = totals.find(row=>row.status === "Publisert")?.total ?? 0;
    const upcoming = totals.filter(row=>row.status !== "Publisert").reduce((sum,row)=>sum+row.total,0);
    // Literal substring search, including % and _. Norwegian letters are case folded too.
    const query = (params.get("q") ?? "").trim().toLocaleLowerCase("nb-NO");
    const filter = and(scope, paginated ? (view === "history" ? eq(marketingPosts.status,"Publisert") : ne(marketingPosts.status,"Publisert")) : undefined,
      paginated && query ? sql`instr(lower(replace(replace(replace(${marketingPosts.content}, 'Æ', 'æ'), 'Ø', 'ø'), 'Å', 'å')), ${query}) > 0` : undefined);
    const [{total}] = await db.select({total:count()}).from(marketingPosts).where(filter);
    const pageSize = 5, pages = Math.max(1, Math.ceil(total/pageSize));
    const requestedPage = Number(params.get("page"));
    const page = Math.min(pages, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
    const posts = await db.select().from(marketingPosts).where(filter)
      .orderBy(...(view === "upcoming" ? [sql`case when ${marketingPosts.scheduledAt} = '' then 1 else 0 end`, marketingPosts.scheduledAt, desc(marketingPosts.id)] : [desc(marketingPosts.id)]))
      .limit(paginated ? pageSize : 100).offset(paginated ? (page-1)*pageSize : 0);
    const postIds = posts.map(post=>post.id);
    const imageRows = await getDb()
      .select({
        id: marketingPostImages.id,
        postId: marketingPostImages.postId,
        filename: marketingPostImages.filename,
        contentType: marketingPostImages.contentType,
        size: marketingPostImages.size,
      })
      .from(marketingPostImages)
      .where(and(eq(marketingPostImages.organizationId, ctx.organizationId),inArray(marketingPostImages.postId,postIds)))
      .orderBy(marketingPostImages.id);
    const imagesByPost = new Map<number, typeof imageRows>();
    imageRows.forEach((image) => {
      const current = imagesByPost.get(image.postId) ?? [];
      current.push(image);
      imagesByPost.set(image.postId, current);
    });
    const deliveries = await getDb().select({postId:socialDeliveries.postId,platform:socialDeliveries.platform,status:socialDeliveries.status,error:socialDeliveries.error})
      .from(socialDeliveries).where(and(eq(socialDeliveries.organizationId, ctx.organizationId),inArray(socialDeliveries.postId,postIds)));
    return await actorJson(ctx,{
      posts: posts.map((post) => ({
        ...post,
        deliveries: deliveries.filter(d => d.postId === post.id),
        images: imagesByPost.get(post.id) ?? [],
      })),
      pagination: {page, pageSize, pages, total},
      counts: {upcoming, history:published},
      connections: [],
      stats: { published },
    });
  } catch (error) {
    return accessResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireTenant(request);
    await requireMarketing(ctx.organizationId, ctx.membershipId);
    const form = await request.formData();
    const content = String(form.get("content") ?? "").trim();
    const scheduledAt = String(form.get("scheduledAt") ?? "");
    let platforms: string[] = [];
    try {
      const parsed = JSON.parse(String(form.get("platforms") ?? "[]"));
      platforms = Array.isArray(parsed)
        ? parsed.map(String).filter(Boolean)
        : [];
    } catch {
      platforms = [];
    }
    const images = form
      .getAll("images")
      .filter((image): image is File => image instanceof File);
    if (!content)
      return await actorJson(ctx,
        { error: "Skriv innholdet som skal publiseres." },
        { status: 400 },
      );
    if (platforms.some((platform) => !SOCIAL_CHANNELS.includes(platform as typeof SOCIAL_CHANNELS[number])))
      return await actorJson(ctx,{ error: "Velg en av de tilgjengelige kanalene." }, { status: 400 });
    platforms = [...new Set(platforms)];
    if (!platforms.length)
      return await actorJson(ctx,{ error: "Velg minst én kanal." }, { status: 400 });
    if (images.length > 6)
      return await actorJson(ctx,
        { error: "Du kan legge til opptil seks bilder per innlegg." },
        { status: 400 },
      );
    if (
      images.some(
        (image) =>
          image.size === 0 ||
          image.size > 10 * 1024 * 1024 ||
          !image.type.startsWith("image/"),
      )
    )
      return await actorJson(ctx,
        { error: "Bildene må være bildefiler på maksimalt 10 MB hver." },
        { status: 400 },
      );

    if (images.reduce((sum, image) => sum + image.size, 0) > 20 * 1024 * 1024)
      throw new AccessError(400, "Bildene kan være maks 20 MB samlet.");
    for (const image of images) await validateImage(image, 10 * 1024 * 1024);
    const now = new Date().toISOString();
    const [post] = await getDb()
      .insert(marketingPosts)
      .values({
        organizationId: ctx.organizationId,
        content,
        platforms: JSON.stringify(platforms),
        scheduledAt,
        status: "Kladd",
        createdBy: actorRef(ctx.user),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const uploadedKeys: string[] = [];
    const createdImages: {
      id: number;
      postId: number;
      filename: string;
      contentType: string;
      size: number;
    }[] = [];
    try {
      for (const image of images) {
        const objectKey = `marketing/${ctx.organizationId}/${post.id}/${crypto.randomUUID()}`;
        const contentType = image.type || "application/octet-stream";
        await bucket().put(objectKey, await image.arrayBuffer(), {
          httpMetadata: { contentType },
        });
        uploadedKeys.push(objectKey);
        const [created] = await getDb()
          .insert(marketingPostImages)
          .values({
            organizationId: ctx.organizationId,
            postId: post.id,
            objectKey,
            filename: (image.name || "bilde").slice(0, 180),
            contentType,
            size: image.size,
            createdAt: now,
          })
          .returning();
        createdImages.push({
          id: created.id,
          postId: created.postId,
          filename: created.filename,
          contentType: created.contentType,
          size: created.size,
        });
      }
    } catch (error) {
      await Promise.allSettled(uploadedKeys.map((key) => bucket().delete(key)));
      await getDb()
        .delete(marketingPostImages)
        .where(
          and(
            eq(marketingPostImages.organizationId, ctx.organizationId),
            eq(marketingPostImages.postId, post.id),
          ),
        );
      await getDb()
        .delete(marketingPosts)
        .where(eq(marketingPosts.id, post.id));
      throw error;
    }
    return await actorJson(ctx,
      { post: { ...post, images: createdImages } },
      { status: 201 },
    );
  } catch (error) {
    return accessResponse(error);
  }
}


// Remove from the CRM plan only; external publications and their delivery history remain intact.
export async function DELETE(request:Request){
 try {
  const ctx=await requireTenant(request);await requireMarketing(ctx.organizationId,ctx.membershipId);
  const body=await request.json();if(body.confirm!==true)throw new AccessError(400,"Bekreft sletting først.");
  const [post]=await getDb().update(marketingPosts).set({status:"Slettet",updatedAt:new Date().toISOString()}).where(and(eq(marketingPosts.organizationId,ctx.organizationId),eq(marketingPosts.id,Number(body.id)),ne(marketingPosts.status,"Publiserer"),ne(marketingPosts.status,"Slettet"))).returning({id:marketingPosts.id});
  if(!post)throw new AccessError(409,"Innlegget finnes ikke eller publiseres nå. Oppdater innholdsplanen.");
  return await actorJson(ctx,{deletedId:post.id});
 }catch(error){return accessResponse(error);}
}
