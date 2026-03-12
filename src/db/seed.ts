import { Database } from "bun:sqlite";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Kysely } from "kysely";
import type { Database as DB } from "./schema";

const db = new Kysely<DB>({
  dialect: new BunSqliteDialect({
    database: new Database("data/app.sqlite"),
  }),
});

const now = new Date().toISOString();
let id = 0;
const rid = () => `seed-resource-${++id}`;
const roleid = () => `seed-role-${id}-${Math.random().toString(36).slice(2, 8)}`;

// Get the first user to use as owner
const owner = await db.selectFrom("user").select("id").executeTakeFirst();
if (!owner) {
  console.error("No user found. Please sign in first, then run the seed.");
  process.exit(1);
}
const ownerId = owner.id;

type ResourceSeed = {
  name: string;
  description: string;
  type: "software" | "secure_note";
  tag?: string;
  global_visible?: number;
  url?: string;
  requires_approval: number;
  approval_count: number;
  roles: { name: string; is_admin?: number; description?: string; requires_approval?: number }[];
};

const OWNER_ROLE = {
  name: "Owner",
  is_admin: 1,
  description: "Resource ownership and management permissions",
  requires_approval: 1,
};

const RESOURCE_TAGS: Record<string, string> = {
  "Figma": "Marketing",
  "Adobe Creative Cloud": "Marketing",
  "Slack": "Service Delivery",
  "Google Workspace": "Service Delivery",
  "Zoom": "Service Delivery",
  "Notion": "Service Delivery",
  "GitHub": "Service Delivery",
  "GitLab": "Service Delivery",
  "Vercel": "Service Delivery",
  "Sentry": "Service Delivery",
  "Linear": "Service Delivery",
  "Datadog": "Service Delivery",
  "Postman": "Service Delivery",
  "Ahrefs": "Marketing",
  "SEMrush": "Marketing",
  "HubSpot": "Marketing",
  "Mailchimp": "Marketing",
  "Google Ads": "Marketing",
  "Meta Business Suite": "Marketing",
  "Google Analytics": "Marketing",
  "QuickBooks": "Finance",
  "Xero": "Finance",
  "Stripe Dashboard": "Finance",
  "Brex": "Finance",
  "Expensify": "Finance",
  "BambooHR": "Legal",
  "1Password Business": "Service Delivery",
  "AWS Console": "Service Delivery",
  "Google Cloud Platform": "Service Delivery",
  "Cloudflare": "Service Delivery",
  "Production Database Credentials": "Service Delivery",
  "Production SSH Keys": "Service Delivery",
  "Staging Environment Credentials": "Service Delivery",
  "VPN Configuration": "Service Delivery",
  "CI/CD Service Accounts": "Service Delivery",
  "DNS Management": "Service Delivery",
  "Third-party API Keys": "Service Delivery",
};

const resources: ResourceSeed[] = [
  // --- Design ---
  {
    name: "Figma",
    description: "Collaborative interface design and prototyping tool.",
    type: "software",
    url: "https://figma.com",
    requires_approval: 0,
    approval_count: 0,
    roles: [
      { name: "View" },
      { name: "Editor" },
      { name: "Dev", requires_approval: 1 },
    ],
  },
  {
    name: "Adobe Creative Cloud",
    description: "Suite of creative tools including Photoshop, Illustrator, and Premiere.",
    type: "software",
    url: "https://adobe.com",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Single App License" },
      { name: "All Apps License" },
    ],
  },

  // --- Communication ---
  {
    name: "Slack",
    description: "Team messaging and communication platform.",
    type: "software",
    url: "https://slack.com",
    requires_approval: 0,
    approval_count: 0,
    roles: [
      { name: "Member" },
      { name: "Admin", requires_approval: 1 },
      { name: "Owner", requires_approval: 1 },
    ],
  },
  {
    name: "Google Workspace",
    description: "Gmail, Drive, Docs, Sheets, Calendar, and Meet for business.",
    type: "software",
    url: "https://workspace.google.com",
    requires_approval: 0,
    approval_count: 0,
    roles: [
      { name: "User" },
      { name: "Super Admin", requires_approval: 1 },
    ],
  },
  {
    name: "Zoom",
    description: "Video conferencing and online meetings.",
    type: "software",
    url: "https://zoom.us",
    requires_approval: 0,
    approval_count: 0,
    roles: [
      { name: "Basic" },
      { name: "Licensed" },
      { name: "Admin", requires_approval: 1 },
    ],
  },
  {
    name: "Notion",
    description: "All-in-one workspace for notes, docs, and project management.",
    type: "software",
    url: "https://notion.so",
    requires_approval: 0,
    approval_count: 0,
    roles: [
      { name: "Member" },
      { name: "Admin", requires_approval: 1 },
    ],
  },

  // --- Development ---
  {
    name: "GitHub",
    description: "Code hosting, version control, and CI/CD platform.",
    type: "software",
    url: "https://github.com",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Read", description: "Read-only access to repositories" },
      { name: "Write", description: "Push access to repositories" },
      { name: "Admin", description: "Full repository and org settings access", requires_approval: 1 },
    ],
  },
  {
    name: "GitLab",
    description: "DevOps platform with source control, CI/CD, and monitoring.",
    type: "software",
    url: "https://gitlab.com",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Reporter" },
      { name: "Developer" },
      { name: "Maintainer", requires_approval: 1 },
    ],
  },
  {
    name: "Vercel",
    description: "Frontend deployment and hosting platform.",
    type: "software",
    url: "https://vercel.com",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Viewer" },
      { name: "Developer" },
      { name: "Admin", requires_approval: 1 },
    ],
  },
  {
    name: "Sentry",
    description: "Application error tracking and performance monitoring.",
    type: "software",
    url: "https://sentry.io",
    requires_approval: 0,
    approval_count: 0,
    roles: [
      { name: "Member" },
      { name: "Admin", requires_approval: 1 },
    ],
  },
  {
    name: "Linear",
    description: "Issue tracking and project management for software teams.",
    type: "software",
    url: "https://linear.app",
    requires_approval: 0,
    approval_count: 0,
    roles: [
      { name: "Member" },
      { name: "Admin", requires_approval: 1 },
    ],
  },
  {
    name: "Datadog",
    description: "Cloud-scale monitoring, security, and analytics platform.",
    type: "software",
    url: "https://datadoghq.com",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Read Only" },
      { name: "Standard" },
      { name: "Admin", requires_approval: 1 },
    ],
  },
  {
    name: "Postman",
    description: "API development and testing collaboration platform.",
    type: "software",
    url: "https://postman.com",
    requires_approval: 0,
    approval_count: 0,
    roles: [
      { name: "Viewer" },
      { name: "Editor" },
      { name: "Admin", requires_approval: 1 },
    ],
  },

  // --- Marketing ---
  {
    name: "Ahrefs",
    description: "SEO toolset for backlink analysis, keyword research, and site audits.",
    type: "software",
    url: "https://ahrefs.com",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Viewer" },
      { name: "Power User" },
    ],
  },
  {
    name: "SEMrush",
    description: "Online visibility management and content marketing platform.",
    type: "software",
    url: "https://semrush.com",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "User" },
      { name: "Admin", requires_approval: 1 },
    ],
  },
  {
    name: "HubSpot",
    description: "CRM, marketing automation, sales, and customer service platform.",
    type: "software",
    url: "https://hubspot.com",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Viewer" },
      { name: "Marketing User" },
      { name: "Sales User" },
      { name: "Super Admin", requires_approval: 1 },
    ],
  },
  {
    name: "Mailchimp",
    description: "Email marketing and automation platform.",
    type: "software",
    url: "https://mailchimp.com",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Viewer" },
      { name: "Author" },
      { name: "Manager" },
      { name: "Admin", requires_approval: 1 },
    ],
  },
  {
    name: "Google Ads",
    description: "Online advertising platform for search, display, and video ads.",
    type: "software",
    url: "https://ads.google.com",
    requires_approval: 1,
    approval_count: 2,
    roles: [
      { name: "Read Only" },
      { name: "Standard" },
      { name: "Admin", requires_approval: 1 },
    ],
  },
  {
    name: "Meta Business Suite",
    description: "Manage Facebook and Instagram business pages, ads, and insights.",
    type: "software",
    url: "https://business.facebook.com",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Analyst" },
      { name: "Advertiser" },
      { name: "Admin", requires_approval: 1 },
    ],
  },
  {
    name: "Google Analytics",
    description: "Web analytics service for tracking website traffic and behavior.",
    type: "software",
    url: "https://analytics.google.com",
    requires_approval: 0,
    approval_count: 0,
    roles: [
      { name: "Viewer" },
      { name: "Editor" },
      { name: "Admin", requires_approval: 1 },
    ],
  },

  // --- Finance ---
  {
    name: "QuickBooks",
    description: "Accounting software for invoicing, payroll, and expense tracking.",
    type: "software",
    url: "https://quickbooks.intuit.com",
    requires_approval: 1,
    approval_count: 2,
    roles: [
      { name: "Reports Only" },
      { name: "Standard" },
      { name: "Admin", requires_approval: 1 },
    ],
  },
  {
    name: "Xero",
    description: "Cloud accounting platform for small and medium businesses.",
    type: "software",
    url: "https://xero.com",
    requires_approval: 1,
    approval_count: 2,
    roles: [
      { name: "Viewer" },
      { name: "Invoicing" },
      { name: "Standard" },
      { name: "Advisor" },
    ],
  },
  {
    name: "Stripe Dashboard",
    description: "Payment processing dashboard for managing transactions and subscriptions.",
    type: "software",
    url: "https://dashboard.stripe.com",
    requires_approval: 1,
    approval_count: 2,
    roles: [
      { name: "View Only" },
      { name: "Developer", description: "API keys and webhook access" },
      { name: "Administrator", requires_approval: 1 },
    ],
  },
  {
    name: "Brex",
    description: "Corporate credit card and spend management platform.",
    type: "software",
    url: "https://brex.com",
    requires_approval: 1,
    approval_count: 2,
    roles: [
      { name: "Employee", description: "Card holder with spending limits" },
      { name: "Bookkeeper" },
      { name: "Admin", requires_approval: 1 },
    ],
  },
  {
    name: "Expensify",
    description: "Expense reporting and management tool.",
    type: "software",
    url: "https://expensify.com",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Submitter" },
      { name: "Approver" },
      { name: "Admin", requires_approval: 1 },
    ],
  },

  // --- HR / People ---
  {
    name: "BambooHR",
    description: "HR software for employee records, time-off, and onboarding.",
    type: "software",
    url: "https://bamboohr.com",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Employee" },
      { name: "Manager" },
      { name: "HR Admin", requires_approval: 1 },
    ],
  },
  {
    name: "1Password Business",
    description: "Team password manager and secure credential sharing.",
    type: "software",
    url: "https://1password.com",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Member" },
      { name: "Admin", requires_approval: 1 },
    ],
  },

  // --- Infrastructure (secure notes / infra) ---
  {
    name: "AWS Console",
    description: "Amazon Web Services cloud management console.",
    type: "secure_note",
    url: "https://console.aws.amazon.com",
    requires_approval: 1,
    approval_count: 2,
    roles: [
      { name: "Read Only", description: "ViewOnlyAccess policy" },
      { name: "Developer", description: "PowerUserAccess policy" },
      { name: "Admin", description: "AdministratorAccess policy", requires_approval: 1 },
    ],
  },
  {
    name: "Google Cloud Platform",
    description: "Google's cloud computing services and infrastructure.",
    type: "secure_note",
    url: "https://console.cloud.google.com",
    requires_approval: 1,
    approval_count: 2,
    roles: [
      { name: "Viewer" },
      { name: "Editor" },
      { name: "Owner", requires_approval: 1 },
    ],
  },
  {
    name: "Cloudflare",
    description: "CDN, DNS, DDoS protection, and web security services.",
    type: "secure_note",
    url: "https://dash.cloudflare.com",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Read Only" },
      { name: "Administrator" },
      { name: "Super Administrator", requires_approval: 1 },
    ],
  },
  {
    name: "Production Database Credentials",
    description: "PostgreSQL connection strings and credentials for production databases.",
    type: "secure_note",
    requires_approval: 1,
    approval_count: 2,
    roles: [
      { name: "Read Replica", description: "Read-only replica connection" },
      { name: "Full Access", description: "Primary database read/write", requires_approval: 1 },
    ],
  },
  {
    name: "Production SSH Keys",
    description: "SSH keys for accessing production servers and bastion hosts.",
    type: "secure_note",
    requires_approval: 1,
    approval_count: 2,
    roles: [
      { name: "Bastion Only", description: "Access to jump server only" },
      { name: "Full Server Access", requires_approval: 1 },
    ],
  },
  {
    name: "Staging Environment Credentials",
    description: "API keys, database URLs, and service credentials for staging.",
    type: "secure_note",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Read Only" },
      { name: "Full Access" },
    ],
  },
  {
    name: "VPN Configuration",
    description: "WireGuard/OpenVPN configs for connecting to internal network.",
    type: "secure_note",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Standard", description: "Access to internal services" },
      { name: "Full Tunnel", description: "All traffic routed through VPN" },
    ],
  },
  {
    name: "CI/CD Service Accounts",
    description: "Service account credentials for GitHub Actions, CircleCI, and deployment pipelines.",
    type: "secure_note",
    requires_approval: 1,
    approval_count: 2,
    roles: [
      { name: "Read Tokens" },
      { name: "Deploy Tokens", requires_approval: 1 },
    ],
  },
  {
    name: "DNS Management",
    description: "Access to manage DNS records across company domains.",
    type: "secure_note",
    requires_approval: 1,
    approval_count: 2,
    roles: [
      { name: "Viewer" },
      { name: "Editor", requires_approval: 1 },
    ],
  },
  {
    name: "Third-party API Keys",
    description: "API keys for Twilio, SendGrid, Stripe, and other external services.",
    type: "secure_note",
    requires_approval: 1,
    approval_count: 1,
    roles: [
      { name: "Sandbox/Test Keys" },
      { name: "Production Keys", requires_approval: 1 },
    ],
  },
];

// Clear existing seed data
await db.deleteFrom("resource_role").where("id", "like", "seed-%").execute();
await db.deleteFrom("resource").where("id", "like", "seed-%").execute();

for (const r of resources) {
  const resourceId = rid();

  await db
    .insertInto("resource")
    .values({
      id: resourceId,
      name: r.name,
      description: r.description,
      type: r.type,
      tag: r.tag ?? RESOURCE_TAGS[r.name] ?? "Unassigned",
      global_visible: r.global_visible == null ? 1 : r.global_visible ? 1 : 0,
      url: r.url ?? null,
      icon_url: null,
      owner_id: ownerId,
      requires_approval: r.requires_approval,
      approval_count: r.approval_count,
      created_at: now,
      updated_at: now,
    })
    .execute();

  const seededRoles = r.roles.length > 0 ? [...r.roles] : [];
  const existingRoleNames = new Set(seededRoles.map((role) => role.name.toLowerCase()));

  if (!existingRoleNames.has(OWNER_ROLE.name.toLowerCase())) {
    seededRoles.push(OWNER_ROLE);
    existingRoleNames.add(OWNER_ROLE.name.toLowerCase());
  }

  const rolesToCreate =
    seededRoles.length > 0
      ? seededRoles
      : [{ name: "User", description: "Default role", requires_approval: undefined }];

  for (const role of rolesToCreate) {
    await db
      .insertInto("resource_role")
      .values({
        id: roleid(),
        resource_id: resourceId,
        name: role.name,
        description: role.description ?? null,
        requires_approval: role.requires_approval ?? null,
        approval_count: null,
        is_admin: role.is_admin ?? (/admin/i.test(role.name) ? 1 : 0),
        created_at: now,
      })
      .execute();
  }
}

console.log(`Seeded ${resources.length} resources with roles.`);
await db.destroy();
