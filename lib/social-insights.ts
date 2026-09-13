import { graph, MetaError } from "@/lib/social-meta";
import { linkedinJson, LinkedInError } from "@/lib/social-linkedin";

export type InsightReason = "permission" | "reconnect" | "unavailable" | "temporary";
export type InsightMetric = { value: number | null; reason: InsightReason | null };
export type PostInsights = { views: InsightMetric; engagement: InsightMetric };
export const missingMetric = (reason: InsightReason): InsightMetric => ({ value: null, reason });
const validCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const metric = (value: unknown): InsightMetric => validCount(value) ? { value, reason: null } : missingMetric("unavailable");
export function insightFailure(error: unknown): InsightReason {
  if (error instanceof MetaError) return error.expired ? "reconnect" : [10, 200].includes(error.providerCode ?? 0) ? "permission" : error.providerCode === 100 ? "unavailable" : "temporary";
  if (error instanceof LinkedInError) return error.expired ? "reconnect" : error.providerStatus === 403 ? "permission" : error.providerStatus === 404 ? "unavailable" : "temporary";
  return "temporary";
}
type InsightsResponse = { data?: { name?: string; values?: { value?: unknown }[]; total_value?: { value?: unknown } }[] };
// An empty response means the provider has no data, not that the post has zero views.
export function readInsight(data: InsightsResponse, name: string): InsightMetric {
  const row = data.data?.find(item => item.name === name);
  return metric(row?.total_value?.value ?? (row?.values?.length === 1 ? row.values[0].value : undefined));
}
async function safeMetric(read: () => Promise<InsightMetric>): Promise<InsightMetric> {
  try { return await read(); } catch (error) { return missingMetric(insightFailure(error)); }
}
export async function fetchPostInsights(platform: string, accountId: string, remoteId: string, token: string): Promise<PostInsights> {
  if (platform === "LinkedIn") {
    if (!/^\d+$/.test(accountId) || !/^urn:li:(share|ugcPost):\d+$/.test(remoteId)) return { views: missingMetric("unavailable"), engagement: missingMetric("unavailable") };
    try {
      const kind = remoteId.startsWith("urn:li:share:") ? "shares" : "ugcPosts";
      const query = `q=organizationalEntity&organizationalEntity=${encodeURIComponent(`urn:li:organization:${accountId}`)}&${kind}=List(${encodeURIComponent(remoteId)})`;
      const data = await linkedinJson<{elements?: {share?:string;ugcPost?:string;totalShareStatistics?:{impressionCount?:number;likeCount?:number;commentCount?:number;shareCount?:number}}[]}>(`organizationalEntityShareStatistics?${query}`, token);
      const stats = data.elements?.find(row => (row.share ?? row.ugcPost) === remoteId)?.totalShareStatistics;
      const counts = [stats?.likeCount, stats?.commentCount, stats?.shareCount];
      // LinkedIn may report negative net likes after an unlike on a sponsored post.
      const engagement = counts.every(value => typeof value === "number" && Number.isSafeInteger(value))
        ? { value: counts.reduce<number>((sum, value) => sum + value!, 0), reason: null } : missingMetric("unavailable");
      return { views: metric(stats?.impressionCount), engagement };
    } catch (error) { const reason = insightFailure(error); return { views: missingMetric(reason), engagement: missingMetric(reason) }; }
  }
  if (!["Facebook", "Instagram"].includes(platform) || !/^\d+(?:_\d+)?$/.test(remoteId)) return { views: missingMetric("unavailable"), engagement: missingMetric("unavailable") };
  const viewsName = platform === "Instagram" ? "views" : "post_media_view";
  const [views, engagement] = await Promise.all([
    safeMetric(async () => readInsight(await graph<InsightsResponse>(`${remoteId}/insights`, token, {metric:viewsName, ...(platform === "Facebook" ? {period:"lifetime"} : {})}), viewsName)),
    safeMetric(async () => {
      if (platform === "Instagram") return readInsight(await graph<InsightsResponse>(`${remoteId}/insights`, token, {metric:"total_interactions"}), "total_interactions");
      const data = await graph<{id?:string;reactions?:{summary?:{total_count?:number}};comments?:{summary?:{total_count?:number}};shares?:{count?:number}}>(remoteId, token, {fields:"id,reactions.limit(0).summary(true),comments.limit(0).summary(true),shares"});
      const counts = [data.reactions?.summary?.total_count, data.comments?.summary?.total_count, data.shares === undefined ? 0 : data.shares.count];
      return data.id === remoteId && counts.every(validCount) ? metric(counts.reduce<number>((sum, value) => sum + value!, 0)) : missingMetric("unavailable");
    }),
  ]);
  return { views, engagement };
}
