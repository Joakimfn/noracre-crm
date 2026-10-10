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
    country: text("country").notNull().default("NO"),
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").notNull().default(1),
    importId: text("import_id").notNull().default(""),
    importSource: text("import_source").notNull().default(""),
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
    address: text("address").notNull().default(""),
    postalCode: text("postal_code").notNull().default(""),
    employees: integer("employees"),
    employeeRange: text("employee_range").notNull().default(""),
    employeeRangeYear: text("employee_range_year").notNull().default(""),
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
    reminderMinutes: text("reminder_minutes").notNull().default("[15]"),
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
  homeCountry: text("home_country").notNull().default("NO"),
  outboundEnabled: integer("outbound_enabled",{mode:"boolean"}).notNull().default(false),
  outboundCurrency: text("outbound_currency").notNull().default("NOK"),
  outboundTimezone: text("outbound_timezone").notNull().default("Europe/Oslo"),
  outboundCommissionBps: integer("outbound_commission_bps").notNull().default(0),
  outboundPitch: text("outbound_pitch").notNull().default(""),

  operatingCountries: text("operating_countries").notNull().default('["NO"]'),
  commissionBps: integer("commission_bps"),
  isPartner: integer("is_partner", {mode:"boolean"}).notNull().default(false),
  referredByPartnerId: integer("referred_by_partner_id"),
  partnerAssignedAt: text("partner_assigned_at").notNull().default(""),
  crmPrice: integer("crm_price"),
  ringPrice: integer("ring_price"),
  marketingPrice: integer("marketing_price"),
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
  scheduledDisableAt: text("scheduled_disable_at").notNull().default(""),
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
    scheduledDisableAt: text("scheduled_disable_at").notNull().default(""),
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
    requestedUserId: text("requested_user_id").notNull().default(""),
    notificationSentAt: text("notification_sent_at").notNull().default(""),
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

export const savedCallLists = sqliteTable("saved_call_lists", {
 id: integer("id").primaryKey({autoIncrement:true}),
 organizationId: integer("organization_id").notNull(),
 name: text("name").notNull(),
 country: text("country").notNull().default("NO"),
 createdByMembershipId: integer("created_by_membership_id").notNull(),
 createdAt: text("created_at").notNull(),
 updatedAt: text("updated_at").notNull(),
},t=>[index("idx_saved_lists_org").on(t.organizationId,t.id)]);
export const callListAssignments = sqliteTable("call_list_assignments", {
 id: integer("id").primaryKey({autoIncrement:true}),
 organizationId: integer("organization_id").notNull(),
 listId: integer("list_id").notNull(),
 membershipId: integer("membership_id").notNull(),
 assignedBy: text("assigned_by").notNull(),
 createdAt: text("created_at").notNull(),
 acknowledgedAt: text("acknowledged_at").notNull().default(""),
},t=>[uniqueIndex("idx_list_assignment_unique").on(t.listId,t.membershipId),index("idx_list_assignment_member").on(t.organizationId,t.membershipId)]);

export const outboundLeadState = sqliteTable("outbound_lead_state",{
  id:integer("id").primaryKey({autoIncrement:true}),
  organizationId:integer("organization_id").notNull(),
  entryId:integer("entry_id").notNull(),
  assignedMembershipId:integer("assigned_membership_id").notNull().default(0),
  nextCallAt:text("next_call_at").notNull().default(""),
  pipeline:text("pipeline").notNull().default("Prospekt"),
  lastOutcome:text("last_outcome").notNull().default(""),
  lastNote:text("last_note").notNull().default(""),
  contactName:text("contact_name").notNull().default(""),
  contactPhone:text("contact_phone").notNull().default(""),
  attempts:integer("attempts").notNull().default(0),
  doNotContact:integer("do_not_contact",{mode:"boolean"}).notNull().default(false),
  createdAt:text("created_at").notNull(),
  updatedAt:text("updated_at").notNull(),
},t=>[
  uniqueIndex("outbound_lead_entry_unique").on(t.entryId),
  index("outbound_lead_owner").on(t.organizationId,t.assignedMembershipId),
  index("outbound_lead_followup").on(t.organizationId,t.nextCallAt),
]);

export const outboundCallLogs = sqliteTable("outbound_call_logs",{
  id:integer("id").primaryKey({autoIncrement:true}),
  organizationId:integer("organization_id").notNull(),
  entryId:integer("entry_id").notNull(),
  membershipId:integer("membership_id").notNull(),
  outcome:text("outcome").notNull(),
  note:text("note").notNull().default(""),
  nextCallAt:text("next_call_at").notNull().default(""),
  createdAt:text("created_at").notNull(),
},t=>[index("outbound_calls_reporting").on(t.organizationId,t.createdAt),index("outbound_calls_lead").on(t.organizationId,t.entryId)]);

export const outboundDeals = sqliteTable("outbound_deals",{
  id:integer("id").primaryKey({autoIncrement:true}),
  organizationId:integer("organization_id").notNull(),
  entryId:integer("entry_id").notNull(),
  membershipId:integer("membership_id").notNull(),
  customerOrganizationId:integer("customer_organization_id"),
  pipeline:text("pipeline").notNull().default("Demo booket"),
  monthlyAmountMinor:integer("monthly_amount_minor").notNull().default(0),
  currency:text("currency").notNull().default("NOK"),
  commissionBps:integer("commission_bps").notNull().default(0),
  paymentReference:text("payment_reference").notNull().default(""),
  paymentConfirmedAt:text("payment_confirmed_at").notNull().default(""),
  note:text("note").notNull().default(""),
  createdAt:text("created_at").notNull(),
  updatedAt:text("updated_at").notNull(),
},t=>[uniqueIndex("outbound_deal_entry_unique").on(t.entryId),index("outbound_deal_org").on(t.organizationId,t.membershipId)]);

export const outboundSuppression = sqliteTable("outbound_suppression",{
  id:integer("id").primaryKey({autoIncrement:true}),
  organizationId:integer("organization_id").notNull(),
  country:text("country").notNull(),
  orgNumber:text("org_number").notNull(),
  name:text("name").notNull().default(""),
  createdByMembershipId:integer("created_by_membership_id").notNull(),
  reason:text("reason").notNull().default(""),
  createdAt:text("created_at").notNull(),
},t=>[uniqueIndex("outbound_suppression_unique").on(t.organizationId,t.country,t.orgNumber)]);

export const callListEntries = sqliteTable(
  "call_list_entries",
  {
    listId: integer("list_id"),
    country: text("country").notNull().default("NO"),
    id: integer("id").primaryKey({ autoIncrement: true }),
    organizationId: integer("organization_id").notNull(),
    orgNumber: text("org_number").notNull().default(""),
    name: text("name").notNull(),
    industry: text("industry").notNull().default(""),
    city: text("city").notNull().default(""),
    address: text("address").notNull().default(""),
    postalCode: text("postal_code").notNull().default(""),
    employees: integer("employees"),
    employeeRange: text("employee_range").notNull().default(""),
    employeeRangeYear: text("employee_range_year").notNull().default(""),
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
    scheduledMembershipId: integer('scheduled_membership_id').notNull().default(0),
    scheduledTargets: text('scheduled_targets').notNull().default('[]'),
    publicationError: text('publication_error').notNull().default(''),
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


export const socialOAuth = sqliteTable("social_oauth", {
  id: text("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  membershipId: integer("membership_id").notNull(),
  stateHash: text("state_hash").notNull(),
  browserHash: text("browser_hash").notNull(),
  status: text("status").notNull().default("waiting"),
  payload: text("payload").notNull().default(""),
  expiresAt: integer("expires_at").notNull(),
}, t => [uniqueIndex("social_oauth_state").on(t.stateHash), index("social_oauth_expiry").on(t.expiresAt)]);

export const socialConnections = sqliteTable("social_connections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").notNull(),
  platform: text("platform").notNull(),
  accountId: text("account_id").notNull(),
  accountName: text("account_name").notNull(),
  pageId: text("page_id").notNull(),
  token: text("token").notNull(),
  expiresAt: integer("expires_at").notNull(),
  connectedBy: integer("connected_by").notNull(),
  updatedAt: text("updated_at").notNull(),
}, t => [uniqueIndex("social_connection_org_platform").on(t.organizationId, t.platform)]);

export const socialDeliveries = sqliteTable("social_deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").notNull(),
  postId: integer("post_id").notNull(),
  platform: text("platform").notNull(),
  accountId: text("account_id").notNull(),
  status: text("status").notNull().default("sending"),
  remoteId: text("remote_id").notNull().default(""),
  error: text("error").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, t => [uniqueIndex("social_delivery_once").on(t.organizationId, t.postId, t.platform)]);

export const billingEvents = sqliteTable("billing_events", {
 id: integer("id").primaryKey({autoIncrement:true}),
 organizationId: integer("organization_id").notNull(),
 entityType: text("entity_type").notNull(), entityId: integer("entity_id").notNull(),
 membershipId: integer("membership_id").notNull().default(0), moduleKey: text("module_key").notNull().default(""),
 label: text("label").notNull(), active: integer("active",{mode:"boolean"}).notNull(),
 monthlyPrice: integer("monthly_price").notNull().default(0), eventKind: text("event_kind").notNull(),
 occurredAt: text("occurred_at").notNull(), referenceAt: text("reference_at").notNull().default(""),
});


export const backgroundJobs = sqliteTable("background_jobs", {
 key: text("key").primaryKey(),
 day: text("day").notNull().default(""),
 cursor: integer("cursor").notNull().default(0),
 completedAt: text("completed_at").notNull().default(""),
 leaseUntil: text("lease_until").notNull().default(""),
 failures: integer("failures").notNull().default(0),
});

export const dataImports=sqliteTable("data_imports",{id:text("id").primaryKey(),organizationId:integer("organization_id").notNull(),fingerprint:text("fingerprint").notNull(),result:text("result").notNull(),createdAt:text("created_at").notNull()});

// One bounded usage counter per membership; no prompts or customer data are stored.
export const callListAiUsage = sqliteTable('call_list_ai_usage', {
 membershipId: integer('membership_id').primaryKey().references(()=>memberships.id,{onDelete:'cascade'}),
 windowStarted: integer('window_started').notNull(),
 count: integer('count').notNull().default(0),
});


export const partnerPayments = sqliteTable('partner_payments',{
 id:integer('id').primaryKey({autoIncrement:true}),organizationId:integer('organization_id').notNull(),partnerId:integer('partner_id').notNull(),companyName:text('company_name').notNull(),reference:text('reference').notNull(),referenceKey:text('reference_key').notNull(),paidOn:text('paid_on').notNull(),amountOre:integer('amount_ore').notNull(),basisPoints:integer('basis_points').notNull(),commissionOre:integer('commission_ore').notNull(),createdAt:text('created_at').notNull(),createdBy:text('created_by').notNull(),voidedAt:text('voided_at').notNull().default(''),
},t=>[uniqueIndex('partner_payment_reference').on(t.organizationId,t.referenceKey),index('partner_payment_partner').on(t.partnerId,t.paidOn)]);
