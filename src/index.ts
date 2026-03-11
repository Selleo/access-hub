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
          await db
            .insertInto("access_grant")
            .values({
              id: crypto.randomUUID(),
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

    "/": index,
    "/*": index,
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

    // SPA fallback: serve index.html for non-API routes
    return new Response(Bun.file("src/index.html"));
  },
});

console.log(`Server running at http://localhost:${server.port}`);
