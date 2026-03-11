import { serve } from "bun";
import index from "./index.html";
import { migrateToLatest } from "./db/db";
import { auth } from "./auth";
import { db } from "./db/query";

await migrateToLatest();

const port = Number(process.env.PORT ?? 3000);

async function getSession(req: Request) {
  return auth.api.getSession({
    headers: req.headers,
  });
}

async function requireSession(req: Request) {
  const session = await getSession(req);
  if (!session) throw new Error("Unauthorized");
  return session;
}

const server = serve({
  port,
  routes: {
    "/api/auth/*": async (req) => auth.handler(req),

    "/api/me": async (req) => {
      const session = await getSession(req);
      if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      return Response.json(session);
    },

    "/api/resources": async (req) => {
      try {
        await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const url = new URL(req.url);
      const search = url.searchParams.get("search")?.trim() ?? "";
      const type = url.searchParams.get("type")?.trim() ?? "";

      let query = db
        .selectFrom("resource")
        .leftJoin("user", "user.id", "resource.owner_id")
        .select([
          "resource.id",
          "resource.name",
          "resource.description",
          "resource.type",
          "resource.url",
          "resource.icon_url",
          "resource.requires_approval",
          "resource.approval_count",
          "resource.created_at",
          "user.name as owner_name",
          "user.image as owner_image",
        ])
        .orderBy("resource.name", "asc");

      if (search) {
        query = query.where((eb) =>
          eb.or([
            eb("resource.name", "like", `%${search}%`),
            eb("resource.description", "like", `%${search}%`),
          ])
        );
      }

      if (type) {
        query = query.where("resource.type", "=", type);
      }

      const resources = await query.execute();

      // Get role counts per resource
      const roleCounts = await db
        .selectFrom("resource_role")
        .select(["resource_id", db.fn.count("id").as("role_count")])
        .groupBy("resource_id")
        .execute();

      const roleCountMap = new Map(
        roleCounts.map((r) => [r.resource_id, Number(r.role_count)])
      );

      const result = resources.map((r) => ({
        ...r,
        role_count: roleCountMap.get(r.id) ?? 0,
      }));

      return Response.json(result);
    },
    "/api/admin/resources": async (req) => {
      try {
        let session;
        try {
          session = await requireSession(req);
        } catch {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (req.method === "GET") {
          const resources = await db
            .selectFrom("resource")
            .leftJoin("user", "user.id", "resource.owner_id")
            .select([
              "resource.id",
              "resource.name",
              "resource.description",
              "resource.type",
              "resource.url",
              "resource.requires_approval",
              "resource.approval_count",
              "resource.created_at",
              "user.name as owner_name",
              "user.email as owner_email",
            ])
            .orderBy("resource.created_at", "desc")
            .execute();

          const roleCounts = await db
            .selectFrom("resource_role")
            .select(["resource_id", db.fn.count("id").as("role_count")])
            .groupBy("resource_id")
            .execute();

          const roleCountMap = new Map(
            roleCounts.map((r) => [r.resource_id, Number(r.role_count)])
          );

          return Response.json(
            resources.map((resource) => ({
              ...resource,
              role_count: roleCountMap.get(resource.id) ?? 0,
            }))
          );
        }

        if (req.method === "POST") {
          let body: {
            name?: string;
            description?: string | null;
            type?: "software" | "secure_note" | "infrastructure";
            url?: string | null;
            requires_approval?: number;
            approval_count?: number;
            roles?: Array<{
              name?: string;
              description?: string | null;
              requires_approval?: number | null;
              approval_count?: number | null;
            }>;
          };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }

          const name = body.name?.trim() ?? "";
          const description = body.description?.trim() ?? null;
          const type = body.type;
          const url = body.url?.trim() ?? null;
          const requiresApproval = body.requires_approval ? 1 : 0;
          const approvalCount = requiresApproval ? Math.max(1, Number(body.approval_count ?? 1)) : 0;
          const roles = body.roles ?? [];

          if (!name || !type) {
            return Response.json({ error: "name and type are required" }, { status: 400 });
          }

          if (!["software", "secure_note", "infrastructure"].includes(type)) {
            return Response.json({ error: "Invalid type" }, { status: 400 });
          }

          if (url) {
            try {
              new URL(url);
            } catch {
              return Response.json({ error: "Invalid URL" }, { status: 400 });
            }
          }

          const cleanRoles = roles
            .map((role) => ({
              name: role.name?.trim() ?? "",
              description: role.description?.trim() ?? null,
              requires_approval:
                role.requires_approval == null ? null : role.requires_approval ? 1 : 0,
              approval_count:
                role.approval_count == null ? null : Math.max(1, Number(role.approval_count)),
            }))
            .filter((role) => role.name.length > 0);

          if (cleanRoles.length === 0) {
            return Response.json(
              { error: "At least one role is required to create a resource" },
              { status: 400 }
            );
          }

          const resourceId = crypto.randomUUID();
          const now = new Date().toISOString();

          await db
            .insertInto("resource")
            .values({
              id: resourceId,
              name,
              description,
              type,
              url,
              icon_url: null,
              owner_id: session.user.id,
              requires_approval: requiresApproval,
              approval_count: approvalCount,
              created_at: now,
              updated_at: now,
            })
            .execute();

          for (const role of cleanRoles) {
            await db
              .insertInto("resource_role")
              .values({
                id: crypto.randomUUID(),
                resource_id: resourceId,
                name: role.name,
                description: role.description,
                requires_approval: role.requires_approval,
                approval_count: role.approval_count,
                created_at: now,
              })
              .execute();
          }

          await db
            .insertInto("audit_log")
            .values({
              id: crypto.randomUUID(),
              actor_id: session.user.id,
              action: "resource.created",
              entity_type: "resource",
              entity_id: resourceId,
              metadata: JSON.stringify({
                name,
                type,
                role_count: cleanRoles.length,
              }),
              ip_address: req.headers.get("x-forwarded-for") ?? null,
              created_at: now,
            })
            .execute();

          return Response.json({ id: resourceId }, { status: 201 });
        }

        return Response.json({ error: "Method not allowed" }, { status: 405 });
      } catch (error) {
        console.error("Failed to process admin resources", error);
        return Response.json({ error: "Failed to process admin resources" }, { status: 500 });
      }
    },

    "/api/access-requests": async (req) => {
      try {
        if (req.method !== "POST") {
          return Response.json({ error: "Method not allowed" }, { status: 405 });
        }

        let session;
        try {
          session = await requireSession(req);
        } catch {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: {
          resource_id: string;
          resource_role_id: string;
          lease_duration_days: number | null;
          reason: string | null;
        };
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { resource_id, resource_role_id, lease_duration_days, reason } = body;

        if (!resource_id || !resource_role_id) {
          return Response.json({ error: "resource_id and resource_role_id are required" }, { status: 400 });
        }

        // Verify resource and role exist
        const resource = await db
          .selectFrom("resource")
          .select(["id", "requires_approval", "approval_count"])
          .where("id", "=", resource_id)
          .executeTakeFirst();

        if (!resource) {
          return Response.json({ error: "Resource not found" }, { status: 404 });
        }

        const role = await db
          .selectFrom("resource_role")
          .select(["id", "requires_approval", "approval_count"])
          .where("id", "=", resource_role_id)
          .where("resource_id", "=", resource_id)
          .executeTakeFirst();

        if (!role) {
          return Response.json({ error: "Role not found" }, { status: 404 });
        }

        // Check for existing pending request
        const existing = await db
          .selectFrom("access_request")
          .select("id")
          .where("requester_id", "=", session.user.id)
          .where("resource_id", "=", resource_id)
          .where("resource_role_id", "=", resource_role_id)
          .where("status", "=", "pending")
          .executeTakeFirst();

        if (existing) {
          return Response.json({ error: "You already have a pending request for this role" }, { status: 409 });
        }

        const needsApproval =
          role.requires_approval != null
            ? !!role.requires_approval
            : !!resource.requires_approval;

        const now = new Date().toISOString();
        const requestId = crypto.randomUUID();

        const status = needsApproval ? "pending" : "approved";

        let expiresAt: string | null = null;
        if (lease_duration_days && lease_duration_days > 0) {
          const exp = new Date();
          exp.setDate(exp.getDate() + lease_duration_days);
          expiresAt = exp.toISOString();
        }

        await db
          .insertInto("access_request")
          .values({
            id: requestId,
            requester_id: session.user.id,
            resource_id,
            resource_role_id,
            status,
            reason: reason ?? null,
            lease_duration_days: lease_duration_days ?? null,
            expires_at: expiresAt,
            created_at: now,
            updated_at: now,
          })
          .execute();

        // If auto-approved, create the grant immediately
        if (!needsApproval) {
          const grantId = crypto.randomUUID();
          await db
            .insertInto("access_grant")
            .values({
              id: grantId,
              user_id: session.user.id,
              resource_id,
              resource_role_id,
              access_request_id: requestId,
              status: "active",
              granted_at: now,
              expires_at: expiresAt,
              revoked_at: null,
              created_at: now,
            })
            .execute();

          await db
            .insertInto("audit_log")
            .values({
              id: crypto.randomUUID(),
              actor_id: session.user.id,
              action: "access.granted",
              entity_type: "access_grant",
              entity_id: grantId,
              metadata: JSON.stringify({
                mode: "auto",
                access_request_id: requestId,
                resource_id,
                resource_role_id,
                expires_at: expiresAt,
              }),
              ip_address: req.headers.get("x-forwarded-for") ?? null,
              created_at: now,
            })
            .execute();
        }

        // Audit log
        await db
          .insertInto("audit_log")
          .values({
            id: crypto.randomUUID(),
            actor_id: session.user.id,
            action: "access.requested",
            entity_type: "access_request",
            entity_id: requestId,
            metadata: JSON.stringify({
              resource_id,
              resource_role_id,
              status,
              lease_duration_days,
            }),
            ip_address: req.headers.get("x-forwarded-for") ?? null,
            created_at: now,
          })
          .execute();

        return Response.json({ id: requestId, status });
      } catch (error) {
        console.error("Failed to create access request", error);
        return Response.json({ error: "Failed to create access request" }, { status: 500 });
      }
    },
    "/api/purchase-requests": async (req) => {
      try {
        let session;
        try {
          session = await requireSession(req);
        } catch {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (req.method === "GET") {
          const url = new URL(req.url);
          const status = url.searchParams.get("status")?.trim() ?? "";

          let query = db
            .selectFrom("purchase_request")
            .leftJoin("user as requester", "requester.id", "purchase_request.requester_id")
            .leftJoin("user as reviewer", "reviewer.id", "purchase_request.reviewer_id")
            .select([
              "purchase_request.id",
              "purchase_request.requester_id",
              "purchase_request.software_name",
              "purchase_request.description",
              "purchase_request.url",
              "purchase_request.justification",
              "purchase_request.estimated_cost",
              "purchase_request.status",
              "purchase_request.reviewer_id",
              "purchase_request.created_at",
              "purchase_request.updated_at",
              "requester.name as requester_name",
              "requester.email as requester_email",
              "reviewer.name as reviewer_name",
              "reviewer.email as reviewer_email",
            ])
            .orderBy("purchase_request.created_at", "desc");

          if (status) {
            query = query.where("purchase_request.status", "=", status);
          }

          const rows = await query.execute();
          const result = rows.map((row) => ({
            ...row,
            can_review: row.requester_id !== session.user.id,
          }));

          return Response.json(result);
        }

        if (req.method === "POST") {
          let body: {
            software_name?: string;
            description?: string | null;
            url?: string | null;
            justification?: string;
            estimated_cost?: string | null;
          };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }

          const softwareName = body.software_name?.trim() ?? "";
          const justification = body.justification?.trim() ?? "";
          const description = body.description?.trim() ?? null;
          const requestUrl = body.url?.trim() ?? null;
          const estimatedCost = body.estimated_cost?.trim() ?? null;

          if (!softwareName || !justification) {
            return Response.json(
              { error: "software_name and justification are required" },
              { status: 400 }
            );
          }

          if (requestUrl) {
            try {
              new URL(requestUrl);
            } catch {
              return Response.json({ error: "Invalid URL" }, { status: 400 });
            }
          }

          const now = new Date().toISOString();
          const requestId = crypto.randomUUID();

          await db
            .insertInto("purchase_request")
            .values({
              id: requestId,
              requester_id: session.user.id,
              software_name: softwareName,
              description,
              url: requestUrl,
              justification,
              estimated_cost: estimatedCost,
              status: "pending",
              reviewer_id: null,
              created_at: now,
              updated_at: now,
            })
            .execute();

          await db
            .insertInto("audit_log")
            .values({
              id: crypto.randomUUID(),
              actor_id: session.user.id,
              action: "purchase.requested",
              entity_type: "purchase_request",
              entity_id: requestId,
              metadata: JSON.stringify({
                software_name: softwareName,
                estimated_cost: estimatedCost,
              }),
              ip_address: req.headers.get("x-forwarded-for") ?? null,
              created_at: now,
            })
            .execute();

          return Response.json({ id: requestId, status: "pending" }, { status: 201 });
        }

        return Response.json({ error: "Method not allowed" }, { status: 405 });
      } catch (error) {
        console.error("Failed to process purchase requests", error);
        return Response.json({ error: "Failed to process purchase requests" }, { status: 500 });
      }
    },
    "/api/audit-log": async (req) => {
      try {
        if (req.method !== "GET") {
          return Response.json({ error: "Method not allowed" }, { status: 405 });
        }

        try {
          await requireSession(req);
        } catch {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const rows = await db
          .selectFrom("audit_log")
          .leftJoin("user", "user.id", "audit_log.actor_id")
          .select([
            "audit_log.id",
            "audit_log.action",
            "audit_log.entity_type",
            "audit_log.entity_id",
            "audit_log.created_at",
            "user.name as actor_name",
            "user.email as actor_email",
          ])
          .orderBy("audit_log.created_at", "desc")
          .limit(200)
          .execute();

        return Response.json(rows);
      } catch (error) {
        console.error("Failed to fetch audit log", error);
        return Response.json({ error: "Failed to fetch audit log" }, { status: 500 });
      }
    },
    "/api/my-requests": async (req) => {
      try {
        if (req.method !== "GET") {
          return Response.json({ error: "Method not allowed" }, { status: 405 });
        }

        let session;
        try {
          session = await requireSession(req);
        } catch {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const accessRequests = await db
          .selectFrom("access_request")
          .leftJoin("resource", "resource.id", "access_request.resource_id")
          .leftJoin("resource_role", "resource_role.id", "access_request.resource_role_id")
          .select([
            "access_request.id",
            "access_request.status",
            "access_request.reason",
            "access_request.lease_duration_days",
            "access_request.expires_at",
            "access_request.created_at",
            "resource.name as resource_name",
            "resource.type as resource_type",
            "resource_role.name as role_name",
          ])
          .where("access_request.requester_id", "=", session.user.id)
          .orderBy("access_request.created_at", "desc")
          .execute();

        const purchaseRequests = await db
          .selectFrom("purchase_request")
          .leftJoin("user as reviewer", "reviewer.id", "purchase_request.reviewer_id")
          .select([
            "purchase_request.id",
            "purchase_request.software_name",
            "purchase_request.justification",
            "purchase_request.estimated_cost",
            "purchase_request.status",
            "purchase_request.created_at",
            "reviewer.name as reviewer_name",
          ])
          .where("purchase_request.requester_id", "=", session.user.id)
          .orderBy("purchase_request.created_at", "desc")
          .execute();

        const accessGrants = await db
          .selectFrom("access_grant")
          .leftJoin("resource", "resource.id", "access_grant.resource_id")
          .leftJoin("resource_role", "resource_role.id", "access_grant.resource_role_id")
          .select([
            "access_grant.id",
            "access_grant.access_request_id",
            "access_grant.status",
            "access_grant.granted_at",
            "access_grant.expires_at",
            "access_grant.revoked_at",
            "resource.name as resource_name",
            "resource.type as resource_type",
            "resource_role.name as role_name",
          ])
          .where("access_grant.user_id", "=", session.user.id)
          .orderBy("access_grant.granted_at", "desc")
          .execute();

        return Response.json({
          access_requests: accessRequests,
          purchase_requests: purchaseRequests,
          access_grants: accessGrants,
        });
      } catch (error) {
        console.error("Failed to fetch my requests", error);
        return Response.json({ error: "Failed to fetch my requests" }, { status: 500 });
      }
    },
    "/api/my-approvals": async (req) => {
      try {
        if (req.method !== "GET") {
          return Response.json({ error: "Method not allowed" }, { status: 405 });
        }

        let session;
        try {
          session = await requireSession(req);
        } catch {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const accessApprovals = await db
          .selectFrom("access_request")
          .leftJoin("resource", "resource.id", "access_request.resource_id")
          .leftJoin("resource_role", "resource_role.id", "access_request.resource_role_id")
          .leftJoin("user as requester", "requester.id", "access_request.requester_id")
          .select([
            "access_request.id",
            "access_request.requester_id",
            "access_request.status",
            "access_request.reason",
            "access_request.lease_duration_days",
            "access_request.expires_at",
            "access_request.created_at",
            "resource.name as resource_name",
            "resource_role.name as role_name",
            "requester.name as requester_name",
            "requester.email as requester_email",
          ])
          .where("access_request.status", "=", "pending")
          .where("access_request.requester_id", "!=", session.user.id)
          .orderBy("access_request.created_at", "desc")
          .execute();

        const purchaseApprovals = await db
          .selectFrom("purchase_request")
          .leftJoin("user as requester", "requester.id", "purchase_request.requester_id")
          .select([
            "purchase_request.id",
            "purchase_request.requester_id",
            "purchase_request.software_name",
            "purchase_request.justification",
            "purchase_request.estimated_cost",
            "purchase_request.status",
            "purchase_request.created_at",
            "requester.name as requester_name",
            "requester.email as requester_email",
          ])
          .where("purchase_request.status", "=", "pending")
          .where("purchase_request.requester_id", "!=", session.user.id)
          .orderBy("purchase_request.created_at", "desc")
          .execute();

        return Response.json({
          access_approvals: accessApprovals,
          purchase_approvals: purchaseApprovals,
        });
      } catch (error) {
        console.error("Failed to fetch my approvals", error);
        return Response.json({ error: "Failed to fetch my approvals" }, { status: 500 });
      }
    },

    "/api/secrets": async (req) => {
      try {
        let session;
        try {
          session = await requireSession(req);
        } catch {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (req.method === "GET") {
          const url = new URL(req.url);
          const resourceId = url.searchParams.get("resource_id")?.trim() ?? "";

          let query = db
            .selectFrom("secret")
            .leftJoin("resource", "resource.id", "secret.resource_id")
            .leftJoin("user", "user.id", "secret.created_by")
            .select([
              "secret.id",
              "secret.resource_id",
              "secret.name",
              "secret.type",
              "secret.created_at",
              "secret.updated_at",
              "resource.name as resource_name",
              "resource.type as resource_type",
              "user.name as created_by_name",
            ])
            .orderBy("resource.name", "asc")
            .orderBy("secret.name", "asc");

          if (resourceId) {
            query = query.where("secret.resource_id", "=", resourceId);
          }

          const secrets = await query.execute();
          return Response.json(secrets);
        }

        if (req.method === "POST") {
          let body: {
            resource_id?: string;
            name?: string;
            type?: string;
            value?: string;
          };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }

          const resourceId = body.resource_id?.trim() ?? "";
          const name = body.name?.trim() ?? "";
          const type = body.type?.trim() ?? "";
          const value = body.value ?? "";

          if (!resourceId || !name || !type || !value) {
            return Response.json(
              { error: "resource_id, name, type, and value are required" },
              { status: 400 }
            );
          }

          const validTypes = ["password", "mfa_totp", "ssh_key", "api_key", "note", "backup_codes"];
          if (!validTypes.includes(type)) {
            return Response.json({ error: `type must be one of: ${validTypes.join(", ")}` }, { status: 400 });
          }

          // Verify resource exists
          const resource = await db
            .selectFrom("resource")
            .select("id")
            .where("id", "=", resourceId)
            .executeTakeFirst();

          if (!resource) {
            return Response.json({ error: "Resource not found" }, { status: 404 });
          }

          const now = new Date().toISOString();
          const secretId = crypto.randomUUID();

          await db
            .insertInto("secret")
            .values({
              id: secretId,
              resource_id: resourceId,
              name,
              encrypted_value: value,
              type,
              created_by: session.user.id,
              created_at: now,
              updated_at: now,
            })
            .execute();

          await db
            .insertInto("audit_log")
            .values({
              id: crypto.randomUUID(),
              actor_id: session.user.id,
              action: "secret.created",
              entity_type: "secret",
              entity_id: secretId,
              metadata: JSON.stringify({ resource_id: resourceId, name, type }),
              ip_address: req.headers.get("x-forwarded-for") ?? null,
              created_at: now,
            })
            .execute();

          return Response.json({ id: secretId }, { status: 201 });
        }

        return Response.json({ error: "Method not allowed" }, { status: 405 });
      } catch (error) {
        console.error("Failed to process secrets", error);
        return Response.json({ error: "Failed to process secrets" }, { status: 500 });
      }
    },

    "/": index,
  },

  async fetch(req) {
    const url = new URL(req.url);

    // Match /api/resources/:id/roles
    const rolesMatch = url.pathname.match(/^\/api\/resources\/([^/]+)\/roles$/);
    if (rolesMatch) {
      try {
        await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const resourceId = rolesMatch[1]!;

      const roles = await db
        .selectFrom("resource_role")
        .select(["id", "name", "description", "requires_approval"])
        .where("resource_id", "=", resourceId)
        .orderBy("name", "asc")
        .execute();

      return Response.json(roles);
    }

    // Match /api/access-requests/:id
    const accessMatch = url.pathname.match(/^\/api\/access-requests\/([^/]+)$/);
    if (accessMatch) {
      if (req.method !== "PATCH") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const requestId = accessMatch[1]!;

      let body: { status?: string };
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const nextStatus = body.status;
      if (!nextStatus || !["approved", "rejected"].includes(nextStatus)) {
        return Response.json(
          { error: "status must be one of: approved, rejected" },
          { status: 400 }
        );
      }

      const existing = await db
        .selectFrom("access_request")
        .select([
          "id",
          "requester_id",
          "resource_id",
          "resource_role_id",
          "status",
          "expires_at",
        ])
        .where("id", "=", requestId)
        .executeTakeFirst();

      if (!existing) {
        return Response.json({ error: "Access request not found" }, { status: 404 });
      }

      if (existing.requester_id === session.user.id) {
        return Response.json(
          { error: "You cannot approve your own access request" },
          { status: 403 }
        );
      }

      if (existing.status !== "pending") {
        return Response.json(
          { error: `Access request is already ${existing.status}` },
          { status: 409 }
        );
      }

      const now = new Date().toISOString();

      await db
        .updateTable("access_request")
        .set({
          status: nextStatus,
          updated_at: now,
        })
        .where("id", "=", requestId)
        .execute();

      if (nextStatus === "approved") {
        const grantId = crypto.randomUUID();
        await db
          .insertInto("access_grant")
          .values({
            id: grantId,
            user_id: existing.requester_id,
            resource_id: existing.resource_id,
            resource_role_id: existing.resource_role_id,
            access_request_id: existing.id,
            status: "active",
            granted_at: now,
            expires_at: existing.expires_at,
            revoked_at: null,
            created_at: now,
          })
          .execute();

        await db
          .insertInto("audit_log")
          .values({
            id: crypto.randomUUID(),
            actor_id: session.user.id,
            action: "access.granted",
            entity_type: "access_grant",
            entity_id: grantId,
            metadata: JSON.stringify({
              mode: "manual",
              access_request_id: existing.id,
              resource_id: existing.resource_id,
              resource_role_id: existing.resource_role_id,
              expires_at: existing.expires_at,
            }),
            ip_address: req.headers.get("x-forwarded-for") ?? null,
            created_at: now,
          })
          .execute();
      }

      await db
        .insertInto("audit_log")
        .values({
          id: crypto.randomUUID(),
          actor_id: session.user.id,
          action: "access.reviewed",
          entity_type: "access_request",
          entity_id: requestId,
          metadata: JSON.stringify({
            to: nextStatus,
          }),
          ip_address: req.headers.get("x-forwarded-for") ?? null,
          created_at: now,
        })
        .execute();

      return Response.json({ id: requestId, status: nextStatus });
    }

    // Match /api/purchase-requests/:id
    const purchaseMatch = url.pathname.match(/^\/api\/purchase-requests\/([^/]+)$/);
    if (purchaseMatch) {
      if (req.method !== "PATCH") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const requestId = purchaseMatch[1]!;

      let body: { status?: string };
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const nextStatus = body.status;
      if (!nextStatus || !["approved", "rejected", "purchased"].includes(nextStatus)) {
        return Response.json(
          { error: "status must be one of: approved, rejected, purchased" },
          { status: 400 }
        );
      }

      const existing = await db
        .selectFrom("purchase_request")
        .select(["id", "requester_id", "status"])
        .where("id", "=", requestId)
        .executeTakeFirst();

      if (!existing) {
        return Response.json({ error: "Purchase request not found" }, { status: 404 });
      }

      if (existing.requester_id === session.user.id) {
        return Response.json(
          { error: "You cannot review your own purchase request" },
          { status: 403 }
        );
      }

      const validTransition =
        (existing.status === "pending" && (nextStatus === "approved" || nextStatus === "rejected")) ||
        (existing.status === "approved" && nextStatus === "purchased");

      if (!validTransition) {
        return Response.json(
          {
            error: `Invalid status transition from ${existing.status} to ${nextStatus}`,
          },
          { status: 409 }
        );
      }

      const now = new Date().toISOString();

      await db
        .updateTable("purchase_request")
        .set({
          status: nextStatus,
          reviewer_id: session.user.id,
          updated_at: now,
        })
        .where("id", "=", requestId)
        .execute();

      await db
        .insertInto("audit_log")
        .values({
          id: crypto.randomUUID(),
          actor_id: session.user.id,
          action: "purchase.status_changed",
          entity_type: "purchase_request",
          entity_id: requestId,
          metadata: JSON.stringify({
            from: existing.status,
            to: nextStatus,
          }),
          ip_address: req.headers.get("x-forwarded-for") ?? null,
          created_at: now,
        })
        .execute();

      return Response.json({ id: requestId, status: nextStatus });
    }

    // Match /api/secrets/:id
    const secretMatch = url.pathname.match(/^\/api\/secrets\/([^/]+)$/);
    if (secretMatch) {
      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const secretId = secretMatch[1]!;

      if (req.method === "PATCH") {
        let body: { name?: string; type?: string; value?: string };
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const existing = await db
          .selectFrom("secret")
          .select(["id", "resource_id", "name"])
          .where("id", "=", secretId)
          .executeTakeFirst();

        if (!existing) {
          return Response.json({ error: "Secret not found" }, { status: 404 });
        }

        const updates: Record<string, string> = {};
        if (body.name?.trim()) updates.name = body.name.trim();
        if (body.type?.trim()) updates.type = body.type.trim();
        if (body.value) updates.encrypted_value = body.value;
        updates.updated_at = new Date().toISOString();

        await db
          .updateTable("secret")
          .set(updates)
          .where("id", "=", secretId)
          .execute();

        await db
          .insertInto("audit_log")
          .values({
            id: crypto.randomUUID(),
            actor_id: session.user.id,
            action: "secret.updated",
            entity_type: "secret",
            entity_id: secretId,
            metadata: JSON.stringify({
              resource_id: existing.resource_id,
              fields: Object.keys(updates).filter((k) => k !== "updated_at"),
            }),
            ip_address: req.headers.get("x-forwarded-for") ?? null,
            created_at: updates.updated_at,
          })
          .execute();

        return Response.json({ id: secretId });
      }

      if (req.method === "DELETE") {
        const existing = await db
          .selectFrom("secret")
          .select(["id", "resource_id", "name", "type"])
          .where("id", "=", secretId)
          .executeTakeFirst();

        if (!existing) {
          return Response.json({ error: "Secret not found" }, { status: 404 });
        }

        await db.deleteFrom("secret").where("id", "=", secretId).execute();

        const now = new Date().toISOString();
        await db
          .insertInto("audit_log")
          .values({
            id: crypto.randomUUID(),
            actor_id: session.user.id,
            action: "secret.deleted",
            entity_type: "secret",
            entity_id: secretId,
            metadata: JSON.stringify({
              resource_id: existing.resource_id,
              name: existing.name,
              type: existing.type,
            }),
            ip_address: req.headers.get("x-forwarded-for") ?? null,
            created_at: now,
          })
          .execute();

        return Response.json({ ok: true });
      }

      // GET single secret (with value)
      if (req.method === "GET") {
        const secret = await db
          .selectFrom("secret")
          .select(["id", "resource_id", "name", "encrypted_value", "type", "created_at", "updated_at"])
          .where("id", "=", secretId)
          .executeTakeFirst();

        if (!secret) {
          return Response.json({ error: "Secret not found" }, { status: 404 });
        }

        await db
          .insertInto("audit_log")
          .values({
            id: crypto.randomUUID(),
            actor_id: session.user.id,
            action: "secret.viewed",
            entity_type: "secret",
            entity_id: secretId,
            metadata: JSON.stringify({ resource_id: secret.resource_id }),
            ip_address: req.headers.get("x-forwarded-for") ?? null,
            created_at: new Date().toISOString(),
          })
          .execute();

        return Response.json(secret);
      }

      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    // Match /api/my-access/:requestId
    const myAccessMatch = url.pathname.match(/^\/api\/my-access\/([^/]+)$/);
    if (myAccessMatch) {
      if (req.method !== "GET") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const requestId = myAccessMatch[1]!;

      // Get the access request with resource and role info
      const request = await db
        .selectFrom("access_request")
        .leftJoin("resource", "resource.id", "access_request.resource_id")
        .leftJoin("resource_role", "resource_role.id", "access_request.resource_role_id")
        .leftJoin("user as owner", "owner.id", "resource.owner_id")
        .select([
          "access_request.id",
          "access_request.requester_id",
          "access_request.resource_id",
          "access_request.resource_role_id",
          "access_request.status",
          "access_request.reason",
          "access_request.lease_duration_days",
          "access_request.expires_at",
          "access_request.created_at",
          "access_request.updated_at",
          "resource.name as resource_name",
          "resource.description as resource_description",
          "resource.type as resource_type",
          "resource.url as resource_url",
          "resource.requires_approval",
          "resource.approval_count",
          "resource_role.name as role_name",
          "resource_role.description as role_description",
          "owner.name as owner_name",
        ])
        .where("access_request.id", "=", requestId)
        .where("access_request.requester_id", "=", session.user.id)
        .executeTakeFirst();

      if (!request) {
        return Response.json({ error: "Request not found" }, { status: 404 });
      }

      // Get approvals
      const approvals = await db
        .selectFrom("access_approval")
        .leftJoin("user", "user.id", "access_approval.approver_id")
        .select([
          "access_approval.id",
          "access_approval.decision",
          "access_approval.comment",
          "access_approval.created_at",
          "user.name as approver_name",
        ])
        .where("access_approval.access_request_id", "=", requestId)
        .orderBy("access_approval.created_at", "asc")
        .execute();

      // Get grant if exists
      const grant = await db
        .selectFrom("access_grant")
        .select([
          "id",
          "status",
          "granted_at",
          "expires_at",
          "revoked_at",
        ])
        .where("access_request_id", "=", requestId)
        .where("user_id", "=", session.user.id)
        .executeTakeFirst();

      // Get secrets only if access is granted and active
      let secrets: { id: string; name: string; encrypted_value: string; type: string }[] = [];
      if (grant && grant.status === "active" && request.resource_id) {
        secrets = await db
          .selectFrom("secret")
          .select(["id", "name", "encrypted_value", "type"])
          .where("resource_id", "=", request.resource_id)
          .orderBy("name", "asc")
          .execute();
      }

      return Response.json({
        ...request,
        approvals,
        grant,
        secrets,
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // SPA fallback: serve index.html for non-API routes
    return new Response(Bun.file("src/index.html"));
  },
});

console.log(`Server running at http://localhost:${server.port}`);
