import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userProfiles } from "@/db/schema";
import { accessResponse, requireTenant } from "@/lib/tenant";
import { safeImageType, validateImage } from "@/lib/safe-image";

const bucket = () => env.BUCKET as R2Bucket;

export async function GET(request: Request) {
  try {
    const ctx = await requireTenant(request), params = new URL(request.url).searchParams;
    const [profile] = await getDb().select().from(userProfiles).where(eq(userProfiles.userId, ctx.user.id)).limit(1);
    if (params.get("avatar") === "1") {
      if (!profile?.avatarKey) return new Response(null, { status: 404 });
      if (!safeImageType(profile.avatarType)) return new Response(null, { status: 415 });
      const object = await bucket().get(profile.avatarKey);
      return object ? new Response(object.body, { headers: { "content-type": profile.avatarType, "cache-control": "private, max-age=300" } }) : new Response(null, { status: 404 });
    }
    return Response.json({ profile: profile ?? { displayName: ctx.user.displayName, contactEmail: ctx.user.email, theme: "light", avatarKey: "", avatarX: 50, avatarY: 50, avatarZoom: 100, browserNotifications: false } });
  } catch (error) { return accessResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireTenant(request), form = await request.formData(), now = new Date().toISOString(),
      displayName = String(form.get("displayName") ?? "").trim(), contactEmail = String(form.get("contactEmail") ?? "").trim().toLowerCase(),
      theme = ["system", "light", "dark"].includes(String(form.get("theme"))) ? String(form.get("theme")) : "light", avatar = form.get("avatar"),
      avatarX = Math.max(0, Math.min(100, Number(form.get("avatarX")) || 50)), avatarY = Math.max(0, Math.min(100, Number(form.get("avatarY")) || 50)), avatarZoom = Math.max(100, Math.min(250, Number(form.get("avatarZoom")) || 100)),
      browserNotifications = form.get("browserNotifications") === "true",
      db = getDb(), [existing] = await db.select().from(userProfiles).where(eq(userProfiles.userId, ctx.user.id)).limit(1);
    if (!displayName || !/^\S+@\S+\.\S+$/.test(contactEmail)) return Response.json({ error: "Fyll inn gyldig navn og e-post." }, { status: 400 });
    let avatarKey = existing?.avatarKey ?? "", avatarType = existing?.avatarType ?? "";
    if (avatar instanceof File && avatar.size) {
      await validateImage(avatar, 2 * 1024 * 1024);
      avatarKey = `profiles/${ctx.user.id}/${crypto.randomUUID()}`; avatarType = avatar.type;
      await bucket().put(avatarKey, await avatar.arrayBuffer(), { httpMetadata: { contentType: avatarType } });
    }
    const values = { userId: ctx.user.id, displayName, contactEmail, theme, avatarKey, avatarType, avatarX, avatarY, avatarZoom, browserNotifications, updatedAt: now };
    if (existing) await db.update(userProfiles).set(values).where(eq(userProfiles.userId, ctx.user.id)); else await db.insert(userProfiles).values(values);
    if (existing?.avatarKey && existing.avatarKey !== avatarKey) await bucket().delete(existing.avatarKey);
    return Response.json({ profile: values });
  } catch (error) { return accessResponse(error); }
}
