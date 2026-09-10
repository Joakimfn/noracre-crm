import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { moduleLicenses, organizationModules } from "@/db/schema";
import { AccessError } from "@/lib/tenant";

export const canManageModules = (role: string) =>
  role === "Administrator" || role === "Superadmin";

export async function requireModuleAccess(organizationId: number, membershipId: number, moduleKey: string) {
  const db = getDb();
  const [modules, licenses] = await Promise.all([
    db.select().from(organizationModules).where(and(
      eq(organizationModules.organizationId, organizationId),
      eq(organizationModules.moduleKey, moduleKey),
      eq(organizationModules.active, true),
    )).limit(1),
    db.select().from(moduleLicenses).where(and(
      eq(moduleLicenses.organizationId, organizationId),
      eq(moduleLicenses.membershipId, membershipId),
      eq(moduleLicenses.moduleKey, moduleKey),
      eq(moduleLicenses.active, true),
    )).limit(1),
  ]);
  if (!modules.length || !licenses.length)
    throw new AccessError(403, "Administratoren må tildele deg tilgang til modulen.", "MODULE_REQUIRED");
}
