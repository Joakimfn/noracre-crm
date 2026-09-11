import { SOCIAL_CHANNELS } from "@/lib/social-channels";
import { requireModuleAccess } from "@/lib/module-access";
import { env } from "cloudflare:workers";
import { validateImage } from "@/lib/safe-image";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  marketingPostImages,
  marketingPosts,
  moduleLicenses,
} from "@/db/schema";
import { AccessError, accessResponse, requireTenant } from "@/lib/tenant";

const bucket = () => env.BUCKET as R2Bucket;

const requireMarketing = (organizationId: number, membershipId: number) => requireModuleAccess(organizationId, membershipId, "markedsforing");

export async function GET(request: Request) {
  try {
    const ctx = await requireTenant(request);
    await requireMarketing(ctx.organizationId, ctx.membershipId);
    const posts = await getDb()
      .select()
      .from(marketingPosts)
      .where(eq(marketingPosts.organizationId, ctx.organizationId))
      .orderBy(desc(marketingPosts.id))
      .limit(100);
    const imageRows = await getDb()
      .select({
        id: marketingPostImages.id,
        postId: marketingPostImages.postId,
        filename: marketingPostImages.filename,
        contentType: marketingPostImages.contentType,
        size: marketingPostImages.size,
      })
      .from(marketingPostImages)
      .where(eq(marketingPostImages.organizationId, ctx.organizationId))
      .orderBy(marketingPostImages.id);
    const imagesByPost = new Map<number, typeof imageRows>();
    imageRows.forEach((image) => {
      const current = imagesByPost.get(image.postId) ?? [];
      current.push(image);
      imagesByPost.set(image.postId, current);
    });
    return Response.json({
      posts: posts.map((post) => ({
        ...post,
        images: imagesByPost.get(post.id) ?? [],
      })),
      connections: [],
      stats: {
        impressions: 0,
        engagement: 0,
        clicks: 0,
        published: posts.filter((post) => post.status === "Publisert").length,
      },
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
      return Response.json(
        { error: "Skriv innholdet som skal publiseres." },
        { status: 400 },
      );
    if (platforms.some((platform) => !SOCIAL_CHANNELS.includes(platform as typeof SOCIAL_CHANNELS[number])))
      return Response.json({ error: "Velg en av de tilgjengelige kanalene." }, { status: 400 });
    platforms = [...new Set(platforms)];
    if (!platforms.length)
      return Response.json({ error: "Velg minst én kanal." }, { status: 400 });
    if (images.length > 6)
      return Response.json(
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
      return Response.json(
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
        createdBy: ctx.user.displayName,
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
    return Response.json(
      { post: { ...post, images: createdImages } },
      { status: 201 },
    );
  } catch (error) {
    return accessResponse(error);
  }
}
