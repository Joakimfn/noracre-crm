import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const companies = sqliteTable(
  "companies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").notNull().default(1),
    customerType: text("customer_type").notNull().default("Bedrift"),
    name: text("name").notNull(),
    orgNumber: text("org_number").notNull().default(""),
    contactName: text("contact_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    stage: text("stage").notNull().default("Ny kunde"),
    nextAction: text("next_action").notNull().default(""),
    nextActionDate: text("next_action_date").notNull().default(""),
    nextContactId: integer("next_contact_id"),
    note: text("note").notNull().default(""),
    industry: text("industry").notNull().default(""),
    city: text("city").notNull().default(""),
    employees: integer("employees"),
    revenue: integer("revenue"),
    source: text("source").notNull().default("Manuelt"),
    assignedTo: text("assigned_to").notNull().default("Joakim"),
    lastContactAt: text("last_contact_at").notNull().default(""),
    syncedAt: text("synced_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(""),
  },
  (t) => [
    index("idx_companies_org_next_action").on(
      t.organizationId,
      t.nextActionDate,
    ),
    index("idx_companies_org_stage").on(t.organizationId, t.stage),
  ],
);

export const activities = sqliteTable(
  "activities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").notNull().default(1),
    companyId: integer("company_id").notNull(),
    contactId: integer("contact_id"),
    companyName: text("company_name").notNull().default(""),
    kind: text("kind").notNull(),
    note: text("note").notNull().default(""),
    dueAt: text("due_at").notNull().default(""),
    completedAt: text("completed_at").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    createdAt: text("created_at").notNull().default(""),
  },
  (t) => [
    index("idx_activities_org_company").on(t.organizationId, t.companyId),
    index("idx_activities_org_due").on(t.organizationId, t.dueAt),
  ],
);

export const teamMembers = sqliteTable("team_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").notNull().default(1),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  role: text("role").notNull().default("Bruker"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(""),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").notNull().default(1),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull().default(""),
});

export const organizations = sqliteTable("organizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  orgNumber: text("org_number").notNull().default(""),
  address: text("address").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  city: text("city").notNull().default(""),
  industry: text("industry").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  status: text("status").notNull().default("Aktiv"),
  deactivatedAt: text("deactivated_at").notNull().default(""),
  retainUntil: text("retain_until").notNull().default(""),
  createdAt: text("created_at").notNull(),
});
export const memberships = sqliteTable(
  "memberships",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").notNull(),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    name: text("name").notNull(),
    role: text("role").notNull().default("Bruker"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    acceptedTermsAt: text("accepted_terms_at").notNull().default(""),
    acceptedTermsVersion: text("accepted_terms_version").notNull().default(""),
    completedOnboardingAt: text("completed_onboarding_at")
      .notNull()
      .default(""),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_memberships_user_org").on(t.userId, t.organizationId)],
);
export const contacts = sqliteTable(
  "contacts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").notNull(),
    companyId: integer("company_id").notNull(),
    name: text("name").notNull(),
    title: text("title").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("idx_contacts_org_company").on(t.organizationId, t.companyId)],
);
export const supportSessions = sqliteTable("support_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").notNull(),
  supportUserId: text("support_user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at").notNull().default(""),
  createdAt: text("created_at").notNull(),
});
export const attachments = sqliteTable(
  "attachments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").notNull(),
    companyId: integer("company_id").notNull(),
    objectKey: text("object_key").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type")
      .notNull()
      .default("application/octet-stream"),
    size: integer("size").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_attachments_org_company").on(t.organizationId, t.companyId),
  ],
);
export const supportRequests = sqliteTable(
  "support_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").notNull(),
    requestedBy: text("requested_by").notNull(),
    status: text("status").notNull().default("Venter"),
    createdAt: text("created_at").notNull(),
    resolvedAt: text("resolved_at").notNull().default(""),
  },
  (t) => [
    index("idx_support_requests_org_status").on(t.organizationId, t.status),
  ],
);

export const prospects = sqliteTable(
  "prospects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orgNumber: text("org_number").notNull(),
    name: text("name").notNull(),
    industry: text("industry").notNull().default(""),
    city: text("city").notNull().default(""),
    employees: integer("employees"),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    website: text("website").notNull().default(""),
    status: text("status").notNull().default("Ny"),
    source: text("source").notNull().default("Brønnøysundregistrene"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_prospects_org_number").on(t.orgNumber),
    index("idx_prospects_status_created").on(t.status, t.createdAt),
  ],
);

export const organizationModules = sqliteTable(
  "organization_modules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").notNull(),
    moduleKey: text("module_key").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    pricePerUser: integer("price_per_user").notNull().default(49),
    activatedAt: text("activated_at").notNull(),
    deactivatedAt: text("deactivated_at").notNull().default(""),
  },
  (t) => [
    uniqueIndex("idx_organization_modules_org_key").on(
      t.organizationId,
      t.moduleKey,
    ),
  ],
);

export const moduleLicenses = sqliteTable(
  "module_licenses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").notNull(),
    membershipId: integer("membership_id").notNull(),
    moduleKey: text("module_key").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    pricePerUser: integer("price_per_user").notNull().default(49),
    activatedAt: text("activated_at").notNull(),
    deactivatedAt: text("deactivated_at").notNull().default(""),
  },
  (t) => [
    uniqueIndex("idx_module_licenses_member_key").on(
      t.organizationId,
      t.membershipId,
      t.moduleKey,
    ),
    index("idx_module_licenses_org_active").on(
      t.organizationId,
      t.moduleKey,
      t.active,
    ),
  ],
);

export const userProfiles = sqliteTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  theme: text("theme").notNull().default("light"),
  avatarKey: text("avatar_key").notNull().default(""),
  avatarType: text("avatar_type").notNull().default(""),
  avatarX: integer("avatar_x").notNull().default(50),
  avatarY: integer("avatar_y").notNull().default(50),
  avatarZoom: integer("avatar_zoom").notNull().default(100),
  browserNotifications: integer("browser_notifications", { mode: "boolean" })
    .notNull()
    .default(false),
  updatedAt: text("updated_at").notNull(),
});

export const offerTemplates = sqliteTable(
  "offer_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").notNull(),
    name: text("name").notNull(),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("idx_offer_templates_org").on(t.organizationId, t.id)],
);

export const callListEntries = sqliteTable(
  "call_list_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").notNull(),
    orgNumber: text("org_number").notNull().default(""),
    name: text("name").notNull(),
    industry: text("industry").notNull().default(""),
    city: text("city").notNull().default(""),
    employees: integer("employees"),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    website: text("website").notNull().default(""),
    status: text("status").notNull().default("Ny"),
    meetingAt: text("meeting_at").notNull().default(""),
    customerId: integer("customer_id"),
    contactName: text("contact_name").notNull().default(""),
    contactEmail: text("contact_email").notNull().default(""),
    contactPhone: text("contact_phone").notNull().default(""),
    handledBy: text("handled_by").notNull().default(""),
    source: text("source").notNull().default("Brønnøysundregistrene"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_call_list_entries_org_created").on(
      t.organizationId,
      t.createdAt,
    ),
    index("idx_call_list_entries_org_status").on(t.organizationId, t.status),
  ],
);

export const marketingPosts = sqliteTable(
  "marketing_posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").notNull(),
    content: text("content").notNull(),
    platforms: text("platforms").notNull().default("[]"),
    scheduledAt: text("scheduled_at").notNull().default(""),
    status: text("status").notNull().default("Kladd"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("idx_marketing_posts_org_scheduled").on(
      t.organizationId,
      t.scheduledAt,
    ),
  ],
);

export const marketingPostImages = sqliteTable(
  "marketing_post_images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").notNull(),
    postId: integer("post_id").notNull(),
    objectKey: text("object_key").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("idx_marketing_post_images_org_post").on(t.organizationId, t.postId),
  ],
);
