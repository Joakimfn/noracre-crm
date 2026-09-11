import {sql} from "drizzle-orm";
import {getDb} from "@/db";
// Each subquery runs in the same statement so simultaneous task writes cannot
// overwrite the summary using an older, separately read list of tasks.
export async function syncNextFollowup(organizationId:number,companyId:number){
 await getDb().run(sql`UPDATE companies SET
 next_action=COALESCE((SELECT note FROM activities WHERE organization_id=${organizationId} AND company_id=${companyId} AND completed_at='' AND due_at<>'' ORDER BY due_at,id LIMIT 1),''),
 next_action_date=COALESCE((SELECT due_at FROM activities WHERE organization_id=${organizationId} AND company_id=${companyId} AND completed_at='' AND due_at<>'' ORDER BY due_at,id LIMIT 1),''),
 next_contact_id=(SELECT contact_id FROM activities WHERE organization_id=${organizationId} AND company_id=${companyId} AND completed_at='' AND due_at<>'' ORDER BY due_at,id LIMIT 1)
 WHERE id=${companyId} AND organization_id=${organizationId}`);
}
