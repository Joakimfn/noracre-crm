import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { organizations } from "@/db/schema";
import { AccessError } from "@/lib/tenant";

export const priceKeys = ["crmPrice", "ringPrice", "marketingPrice"] as const;
export type Pricing = { crmPrice: number | null; ringPrice: number | null; marketingPrice: number | null };
export function parsePricing(data: Record<string, unknown>): Pricing {
  return Object.fromEntries(priceKeys.map(key => {
    const value = data[key];
    if (value === "" || value == null) return [key, null];
    const amount = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000)
      throw new AccessError(400, "Pris må være et helt kronebeløp mellom 0 og 1 000 000.");
    return [key, amount];
  })) as Pricing;
}
export async function organizationPricing(id: number) {
  const [org] = await getDb().select().from(organizations).where(eq(organizations.id, id)).limit(1);
  if (!org) throw new AccessError(404, "Bedriften finnes ikke.");
  return {crmPrice: org.crmPrice, ringPrice: org.ringPrice, marketingPrice: org.marketingPrice};
}
export function confirmPrice(actual: number | null, accepted: unknown) {
  if (actual == null) throw new AccessError(409, "Pris er ikke avtalt. Kontakt Noracre før aktivering.");
  if (typeof accepted !== 'number' || accepted !== actual)
    throw new AccessError(409, "Prisen må bekreftes på nytt. Last inn siden på nytt for å se gjeldende avtalepris.");
  return actual;
}
