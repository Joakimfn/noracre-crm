import { accessResponse, requireTenant } from "@/lib/tenant";

export async function POST(request: Request) {
  try {
    await requireTenant(request);
    return Response.json({ error: "Koble brukerens egen Google- eller Microsoft-jobbkonto før direkte sending kan aktiveres." }, { status: 501 });
  } catch (error) {
    return accessResponse(error);
  }
}
