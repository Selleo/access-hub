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

    "/api/resources/tags": async (req) => {
      try {
        await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method !== "GET") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      const rows = await db
        .selectFrom("resource")
        .select("tag")
        .where("global_visible", "=", 1)
        .execute();

      const tags = Array.from(
        new Set(
          rows
            .map((row) => row.tag?.trim() ?? "")
            .filter((tag) => tag.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b));

      return Response.json(tags);
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
      const tag = url.searchParams.get("tag")?.trim() ?? "";

      let query = db
        .selectFrom("resource")
        .leftJoin("user", "user.id", "resource.owner_id")
        .select([
          "resource.id",
          "resource.name",
          "resource.description",
          "resource.type",
          "resource.tag",
          "resource.global_visible",
          "resource.url",
          "resource.icon_url",
          "resource.created_at",
          "user.name as owner_name",
          "user.image as owner_image",
        ])
        .where("resource.global_visible", "=", 1)
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

      if (tag) {
        query = query.where("resource.tag", "=", tag);
      }

      const resources = await query.execute();
      return Response.json(resources);
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
              "resource.tag",
              "resource.global_visible",
              "resource.url",
              "resource.created_at",
              "user.name as owner_name",
              "user.email as owner_email",
            ])
            .orderBy("resource.created_at", "desc")
            .execute();
          return Response.json(resources);
        }

        if (req.method === "POST") {
          let body: {
            name?: string;
            description?: string | null;
            type?: "software" | "secure_note";
            tag?: string | null;
            global_visible?: number;
            url?: string | null;
            approval_policy_id?: string;
          };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }

          const name = body.name?.trim() ?? "";
          const description = body.description?.trim() ?? null;
          const type = body.type;
          const tag = body.tag?.trim() ?? null;
          const globalVisible = body.global_visible == null ? 1 : body.global_visible ? 1 : 0;
          const url = body.url?.trim() ?? null;
          const approvalPolicyId = body.approval_policy_id?.trim() ?? "";

          if (!name || !type || !approvalPolicyId) {
            return Response.json({ error: "name, type and approval_policy_id are required" }, { status: 400 });
          }

          if (!["software", "secure_note"].includes(type)) {
            return Response.json({ error: "Invalid type" }, { status: 400 });
          }

          if (url) {
            try {
              new URL(url);
            } catch {
              return Response.json({ error: "Invalid URL" }, { status: 400 });
            }
          }

          const policy = await db
            .selectFrom("approval_policy")
            .select("id")
            .where("id", "=", approvalPolicyId)
            .executeTakeFirst();
          if (!policy) return Response.json({ error: "Invalid approval_policy_id" }, { status: 400 });

          const resourceId = crypto.randomUUID();
          const now = new Date().toISOString();

          await db
            .insertInto("resource")
            .values({
              id: resourceId,
              name,
              description,
              type,
              tag,
              global_visible: globalVisible,
              url,
              icon_url: null,
              owner_id: session.user.id,
              approval_policy_id: approvalPolicyId,
              requires_approval: 0,
              approval_count: 0,
              created_at: now,
              updated_at: now,
            })
            .execute();
          await db
            .insertInto("resource_role")
            .values({
              id: crypto.randomUUID(),
              resource_id: resourceId,
              name: "Default",
              description: null,
              requires_approval: null,
              approval_count: null,
              is_admin: 0,
              created_at: now,
            })
            .execute();

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
                tag,
                approval_policy_id: approvalPolicyId,
                global_visible: globalVisible,
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
    "/api/admin/policies": async (req) => {
      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method === "GET") {
        const policies = await db
          .selectFrom("approval_policy")
          .leftJoin(
            "approval_policy_group",
            "approval_policy_group.approval_policy_id",
            "approval_policy.id"
          )
          .select([
            "approval_policy.id",
            "approval_policy.name",
            "approval_policy.auto_approve",
            "approval_policy.created_at",
            "approval_policy.updated_at",
            db.fn.count("approval_policy_group.id").as("group_count"),
          ])
          .groupBy([
            "approval_policy.id",
            "approval_policy.name",
            "approval_policy.auto_approve",
            "approval_policy.created_at",
            "approval_policy.updated_at",
          ])
          .orderBy("approval_policy.name", "asc")
          .execute();

        return Response.json(
          policies.map((policy) => ({
            ...policy,
            group_count: Number(policy.group_count),
          }))
        );
      }

      if (req.method === "POST") {
        let body: {
          name?: string;
          auto_approve?: number;
          approval_group_ids?: string[];
        };
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const name = body.name?.trim() ?? "";
        const autoApprove = body.auto_approve ? 1 : 0;
        const approvalGroupIds = Array.from(
          new Set((body.approval_group_ids ?? []).map((id) => id?.trim()).filter((id): id is string => !!id))
        );

        if (!name) {
          return Response.json({ error: "name is required" }, { status: 400 });
        }
        if (autoApprove && approvalGroupIds.length > 0) {
          return Response.json({ error: "Auto approve policy cannot have groups" }, { status: 400 });
        }
        if (!autoApprove && approvalGroupIds.length < 1) {
          return Response.json({ error: "At least one group is required when auto approve is off" }, { status: 400 });
        }

        const duplicate = await db
          .selectFrom("approval_policy")
          .select("id")
          .where("name", "=", name)
          .executeTakeFirst();
        if (duplicate) {
          return Response.json({ error: "Policy with this name already exists" }, { status: 409 });
        }

        if (approvalGroupIds.length > 0) {
          const validGroups = await db
            .selectFrom("approval_group")
            .select("id")
            .where("id", "in", approvalGroupIds)
            .execute();
          if (validGroups.length !== approvalGroupIds.length) {
            return Response.json({ error: "One or more groups do not exist" }, { status: 400 });
          }
        }

        const policyId = crypto.randomUUID();
        const now = new Date().toISOString();
        await db.transaction().execute(async (trx) => {
          await trx
            .insertInto("approval_policy")
            .values({
              id: policyId,
              name,
              auto_approve: autoApprove,
              created_at: now,
              updated_at: now,
            })
            .execute();

          for (const approvalGroupId of approvalGroupIds) {
            await trx
              .insertInto("approval_policy_group")
              .values({
                id: crypto.randomUUID(),
                approval_policy_id: policyId,
                approval_group_id: approvalGroupId,
                created_at: now,
              })
              .execute();
          }
        });

        await db
          .insertInto("audit_log")
          .values({
            id: crypto.randomUUID(),
            actor_id: session.user.id,
            action: "approval_policy.created",
            entity_type: "approval_policy",
            entity_id: policyId,
            metadata: JSON.stringify({
              name,
              auto_approve: autoApprove,
              group_count: approvalGroupIds.length,
            }),
            ip_address: req.headers.get("x-forwarded-for") ?? null,
            created_at: now,
          })
          .execute();

        return Response.json({ id: policyId }, { status: 201 });
      }

      return Response.json({ error: "Method not allowed" }, { status: 405 });
    },
    "/api/admin/approval-policies": async (req) => {
      try {
        await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method !== "GET") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      const policies = await db
        .selectFrom("approval_policy")
        .select(["id", "name", "auto_approve", "created_at", "updated_at"])
        .orderBy("name", "asc")
        .execute();

      return Response.json(policies);
    },
    "/api/admin/users": async (req) => {
      try {
        try {
          await requireSession(req);
        } catch {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (req.method !== "GET") {
          return Response.json({ error: "Method not allowed" }, { status: 405 });
        }

        const users = await db
          .selectFrom("user")
          .select(["id", "name", "email", "image", "emailVerified", "createdAt", "updatedAt"])
          .orderBy("createdAt", "desc")
          .execute();

        return Response.json(users);
      } catch (error) {
        console.error("Failed to fetch admin users", error);
        return Response.json({ error: "Failed to fetch admin users" }, { status: 500 });
      }
    },
    "/api/admin/approval-groups": async (req) => {
      try {
        let session;
        try {
          session = await requireSession(req);
        } catch {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (req.method === "GET") {
          const url = new URL(req.url);
          const groupId = url.searchParams.get("id")?.trim() ?? "";

          if (groupId) {
            const group = await db
              .selectFrom("approval_group")
              .select(["id", "name", "description", "created_at", "updated_at"])
              .where("id", "=", groupId)
              .executeTakeFirst();

            if (!group) {
              return Response.json({ error: "Approval group not found" }, { status: 404 });
            }

            const members = await db
              .selectFrom("approval_group_member")
              .innerJoin("user", "user.id", "approval_group_member.user_id")
              .select([
                "approval_group_member.user_id",
                "user.name",
                "user.email",
                "approval_group_member.created_at",
              ])
              .where("approval_group_member.approval_group_id", "=", groupId)
              .orderBy("user.name", "asc")
              .execute();

            return Response.json({
              ...group,
              members,
            });
          }

          const groups = await db
            .selectFrom("approval_group")
            .leftJoin(
              "approval_group_member",
              "approval_group_member.approval_group_id",
              "approval_group.id"
            )
            .select([
              "approval_group.id",
              "approval_group.name",
              "approval_group.description",
              "approval_group.created_at",
              "approval_group.updated_at",
              db.fn.count("approval_group_member.id").as("member_count"),
            ])
            .groupBy([
              "approval_group.id",
              "approval_group.name",
              "approval_group.description",
              "approval_group.created_at",
              "approval_group.updated_at",
            ])
            .orderBy("approval_group.name", "asc")
            .execute();

          return Response.json(
            groups.map((group) => ({
              ...group,
              member_count: Number(group.member_count),
            }))
          );
        }

        if (req.method === "POST") {
          let body: {
            name?: string;
            description?: string | null;
            member_user_ids?: string[];
          };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }

          const name = body.name?.trim() ?? "";
          const description = body.description?.trim() ?? null;
          const memberUserIds = Array.from(
            new Set((body.member_user_ids ?? []).map((id) => id?.trim()).filter((id): id is string => !!id))
          );

          if (!name) {
            return Response.json({ error: "name is required" }, { status: 400 });
          }

          const duplicate = await db
            .selectFrom("approval_group")
            .select("id")
            .where("name", "=", name)
            .executeTakeFirst();

          if (duplicate) {
            return Response.json({ error: "Approval group with this name already exists" }, { status: 409 });
          }

          if (memberUserIds.length > 0) {
            const validUsers = await db
              .selectFrom("user")
              .select("id")
              .where("id", "in", memberUserIds)
              .execute();

            if (validUsers.length !== memberUserIds.length) {
              return Response.json({ error: "One or more selected users do not exist" }, { status: 400 });
            }
          }

          const id = crypto.randomUUID();
          const now = new Date().toISOString();

          await db.transaction().execute(async (trx) => {
            await trx
              .insertInto("approval_group")
              .values({
                id,
                name,
                description,
                created_by: session.user.id,
                created_at: now,
                updated_at: now,
              })
              .execute();

            for (const userId of memberUserIds) {
              await trx
                .insertInto("approval_group_member")
                .values({
                  id: crypto.randomUUID(),
                  approval_group_id: id,
                  user_id: userId,
                  created_at: now,
                })
                .execute();
            }
          });

          await db
            .insertInto("audit_log")
            .values({
              id: crypto.randomUUID(),
              actor_id: session.user.id,
              action: "approval_group.created",
              entity_type: "approval_group",
              entity_id: id,
              metadata: JSON.stringify({
                name,
                member_count: memberUserIds.length,
              }),
              ip_address: req.headers.get("x-forwarded-for") ?? null,
              created_at: now,
            })
            .execute();

          return Response.json({ id }, { status: 201 });
        }

        if (req.method === "PATCH") {
          let body: {
            id?: string;
            name?: string;
            description?: string | null;
            member_user_ids?: string[];
          };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }

          const groupId = body.id?.trim() ?? "";
          const name = body.name?.trim() ?? "";
          const description = body.description?.trim() ?? null;
          const memberUserIds = Array.from(
            new Set((body.member_user_ids ?? []).map((id) => id?.trim()).filter((id): id is string => !!id))
          );

          if (!groupId || !name) {
            return Response.json({ error: "id and name are required" }, { status: 400 });
          }

          const existing = await db
            .selectFrom("approval_group")
            .select("id")
            .where("id", "=", groupId)
            .executeTakeFirst();

          if (!existing) {
            return Response.json({ error: "Approval group not found" }, { status: 404 });
          }

          const duplicate = await db
            .selectFrom("approval_group")
            .select("id")
            .where("name", "=", name)
            .where("id", "!=", groupId)
            .executeTakeFirst();

          if (duplicate) {
            return Response.json({ error: "Approval group with this name already exists" }, { status: 409 });
          }

          if (memberUserIds.length > 0) {
            const validUsers = await db
              .selectFrom("user")
              .select("id")
              .where("id", "in", memberUserIds)
              .execute();

            if (validUsers.length !== memberUserIds.length) {
              return Response.json({ error: "One or more selected users do not exist" }, { status: 400 });
            }
          }

          const now = new Date().toISOString();

          await db.transaction().execute(async (trx) => {
            await trx
              .updateTable("approval_group")
              .set({
                name,
                description,
                updated_at: now,
              })
              .where("id", "=", groupId)
              .execute();

            await trx
              .deleteFrom("approval_group_member")
              .where("approval_group_id", "=", groupId)
              .execute();

            for (const userId of memberUserIds) {
              await trx
                .insertInto("approval_group_member")
                .values({
                  id: crypto.randomUUID(),
                  approval_group_id: groupId,
                  user_id: userId,
                  created_at: now,
                })
                .execute();
            }
          });

          await db
            .insertInto("audit_log")
            .values({
              id: crypto.randomUUID(),
              actor_id: session.user.id,
              action: "approval_group.updated",
              entity_type: "approval_group",
              entity_id: groupId,
              metadata: JSON.stringify({
                name,
                member_count: memberUserIds.length,
              }),
              ip_address: req.headers.get("x-forwarded-for") ?? null,
              created_at: now,
            })
            .execute();

          return Response.json({ id: groupId });
        }

        if (req.method === "DELETE") {
          let body: { id?: string };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }

          const groupId = body.id?.trim() ?? "";
          if (!groupId) {
            return Response.json({ error: "id is required" }, { status: 400 });
          }

          const existing = await db
            .selectFrom("approval_group")
            .select(["id", "name"])
            .where("id", "=", groupId)
            .executeTakeFirst();

          if (!existing) {
            return Response.json({ error: "Approval group not found" }, { status: 404 });
          }

          await db.deleteFrom("approval_group").where("id", "=", groupId).execute();

          const now = new Date().toISOString();
          await db
            .insertInto("audit_log")
            .values({
              id: crypto.randomUUID(),
              actor_id: session.user.id,
              action: "approval_group.deleted",
              entity_type: "approval_group",
              entity_id: groupId,
              metadata: JSON.stringify({
                name: existing.name,
              }),
              ip_address: req.headers.get("x-forwarded-for") ?? null,
              created_at: now,
            })
            .execute();

          return Response.json({ id: groupId });
        }

        return Response.json({ error: "Method not allowed" }, { status: 405 });
      } catch (error) {
        console.error("Failed to process approval groups", error);
        return Response.json({ error: "Failed to process approval groups" }, { status: 500 });
      }
    },
    "/api/admin/resources/detail": async (req) => {
      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const url = new URL(req.url);
      const resourceId = url.searchParams.get("id")?.trim() ?? "";
      if (!resourceId) return Response.json({ error: "id is required" }, { status: 400 });

      if (req.method === "GET") {
        const resource = await db
          .selectFrom("resource")
          .select([
            "id",
            "name",
            "description",
            "type",
            "tag",
            "global_visible",
            "url",
            "approval_policy_id",
          ])
          .where("id", "=", resourceId)
          .executeTakeFirst();

        if (!resource) {
          return Response.json({ error: "Resource not found" }, { status: 404 });
        }

        return Response.json({
          ...resource,
        });
      }

      return Response.json({ error: "Method not allowed" }, { status: 405 });
    },
    "/api/admin/resources/update": async (req) => {
      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method === "PATCH") {
        let body: {
          id?: string;
          name?: string;
          description?: string | null;
          type?: "software" | "secure_note";
          tag?: string | null;
          global_visible?: number;
          url?: string | null;
          approval_policy_id?: string;
        };
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const resourceId = body.id?.trim() ?? "";
        if (!resourceId) return Response.json({ error: "id is required" }, { status: 400 });

        const existing = await db
          .selectFrom("resource")
          .select("id")
          .where("id", "=", resourceId)
          .executeTakeFirst();

        if (!existing) {
          return Response.json({ error: "Resource not found" }, { status: 404 });
        }

        const name = body.name?.trim() ?? "";
        const description = body.description?.trim() ?? null;
        const type = body.type;
        const tag = body.tag?.trim() ?? null;
        const globalVisible = body.global_visible == null ? 1 : body.global_visible ? 1 : 0;
        const requestUrl = body.url?.trim() ?? null;
        const approvalPolicyId = body.approval_policy_id?.trim() ?? "";

        if (!name || !type || !approvalPolicyId) {
          return Response.json({ error: "name, type and approval_policy_id are required" }, { status: 400 });
        }

        if (!["software", "secure_note"].includes(type)) {
          return Response.json({ error: "Invalid type" }, { status: 400 });
        }

        if (requestUrl) {
          try {
            new URL(requestUrl);
          } catch {
            return Response.json({ error: "Invalid URL" }, { status: 400 });
          }
        }

        const policy = await db
          .selectFrom("approval_policy")
          .select("id")
          .where("id", "=", approvalPolicyId)
          .executeTakeFirst();
        if (!policy) return Response.json({ error: "Invalid approval_policy_id" }, { status: 400 });

        const now = new Date().toISOString();

        await db
          .updateTable("resource")
          .set({
            name,
            description,
            type,
            tag,
            global_visible: globalVisible,
            url: requestUrl,
            approval_policy_id: approvalPolicyId,
            requires_approval: 0,
            approval_count: 0,
            updated_at: now,
          })
          .where("id", "=", resourceId)
          .execute();

        await db
          .insertInto("audit_log")
          .values({
            id: crypto.randomUUID(),
            actor_id: session.user.id,
            action: "resource.updated",
            entity_type: "resource",
            entity_id: resourceId,
            metadata: JSON.stringify({
              name,
              type,
              tag,
              approval_policy_id: approvalPolicyId,
              global_visible: globalVisible,
            }),
            ip_address: req.headers.get("x-forwarded-for") ?? null,
            created_at: now,
          })
          .execute();

        return Response.json({ id: resourceId });
      }

      return Response.json({ error: "Method not allowed" }, { status: 405 });
    },
    "/api/admin/resources/secrets": async (req) => {
      try {
        await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method !== "GET") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      const url = new URL(req.url);
      const resourceId = url.searchParams.get("resource_id")?.trim() ?? "";
      if (!resourceId) return Response.json({ error: "resource_id is required" }, { status: 400 });

      const resource = await db
        .selectFrom("resource")
        .select("id")
        .where("id", "=", resourceId)
        .executeTakeFirst();

      if (!resource) return Response.json({ error: "Resource not found" }, { status: 404 });

      const secrets = await db
        .selectFrom("secret")
        .select(["id", "name", "type", "encrypted_value", "archived_at"])
        .where("resource_id", "=", resourceId)
        .where("archived_at", "is", null)
        .orderBy("created_at", "asc")
        .execute();

      return Response.json(secrets);
    },
    "/api/admin/resources/secrets/create": async (req) => {
      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      let body: {
        resource_id?: string;
        name?: string | null;
        type?: string;
        value?: string | null;
      };
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const resourceId = body.resource_id?.trim() ?? "";
      if (!resourceId) return Response.json({ error: "resource_id is required" }, { status: 400 });

      const allowedSecretTypes = new Set(["text", "password", "totp", "note"]);
      const type = body.type?.trim() ?? "";
      if (!allowedSecretTypes.has(type)) {
        return Response.json({ error: "Invalid secret type" }, { status: 400 });
      }

      const resource = await db
        .selectFrom("resource")
        .select("id")
        .where("id", "=", resourceId)
        .executeTakeFirst();
      if (!resource) return Response.json({ error: "Resource not found" }, { status: 404 });

      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      await db
        .insertInto("secret")
        .values({
          id,
          resource_id: resourceId,
          name: body.name?.trim() ?? "",
          encrypted_value: body.value ?? "",
          type,
          created_by: session.user.id,
          created_at: now,
          updated_at: now,
          archived_at: null,
        })
        .execute();

      await db
        .insertInto("audit_log")
        .values({
          id: crypto.randomUUID(),
          actor_id: session.user.id,
          action: "secret.created",
          entity_type: "secret",
          entity_id: id,
          metadata: JSON.stringify({
            resource_id: resourceId,
            type,
          }),
          ip_address: req.headers.get("x-forwarded-for") ?? null,
          created_at: now,
        })
        .execute();

      return Response.json({ id, resource_id: resourceId }, { status: 201 });
    },
    "/api/admin/resources/secrets/update": async (req) => {
      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method !== "PATCH") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      let body: {
        id?: string;
        name?: string | null;
        type?: string;
        value?: string | null;
      };
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const secretId = body.id?.trim() ?? "";
      if (!secretId) return Response.json({ error: "id is required" }, { status: 400 });

      const existing = await db
        .selectFrom("secret")
        .select(["id", "resource_id"])
        .where("id", "=", secretId)
        .where("archived_at", "is", null)
        .executeTakeFirst();
      if (!existing) return Response.json({ error: "Secret not found" }, { status: 404 });

      const allowedSecretTypes = new Set(["text", "password", "totp", "note"]);
      if (body.type != null && !allowedSecretTypes.has(body.type.trim())) {
        return Response.json({ error: "Invalid secret type" }, { status: 400 });
      }

      const now = new Date().toISOString();
      await db
        .updateTable("secret")
        .set({
          name: body.name?.trim() ?? "",
          encrypted_value: body.value ?? "",
          updated_at: now,
        })
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
          }),
          ip_address: req.headers.get("x-forwarded-for") ?? null,
          created_at: now,
        })
        .execute();

      return Response.json({ id: secretId, resource_id: existing.resource_id });
    },
    "/api/admin/resources/secrets/delete": async (req) => {
      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method !== "DELETE") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      let body: { id?: string };
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const secretId = body.id?.trim() ?? "";
      if (!secretId) return Response.json({ error: "id is required" }, { status: 400 });

      const existing = await db
        .selectFrom("secret")
        .select(["id", "archived_at"])
        .where("id", "=", secretId)
        .executeTakeFirst();
      if (!existing) return Response.json({ error: "Secret not found" }, { status: 404 });
      if (existing.archived_at) return Response.json({ ok: true, archived: true });

      const now = new Date().toISOString();
      await db
        .updateTable("secret")
        .set({
          archived_at: now,
          updated_at: now,
        })
        .where("id", "=", secretId)
        .execute();

      await db
        .insertInto("audit_log")
        .values({
          id: crypto.randomUUID(),
          actor_id: session.user.id,
          action: "secret.archived",
          entity_type: "secret",
          entity_id: secretId,
          metadata: null,
          ip_address: req.headers.get("x-forwarded-for") ?? null,
          created_at: now,
        })
        .execute();

      return Response.json({ ok: true, id: secretId, archived_at: now });
    },
    "/api/admin/policies/detail": async (req) => {
      try {
        await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method !== "GET") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      const url = new URL(req.url);
      const policyId = url.searchParams.get("id")?.trim() ?? "";
      if (!policyId) return Response.json({ error: "id is required" }, { status: 400 });

      const policy = await db
        .selectFrom("approval_policy")
        .select(["id", "name", "auto_approve", "created_at", "updated_at"])
        .where("id", "=", policyId)
        .executeTakeFirst();
      if (!policy) return Response.json({ error: "Policy not found" }, { status: 404 });

      const groups = await db
        .selectFrom("approval_policy_group")
        .innerJoin("approval_group", "approval_group.id", "approval_policy_group.approval_group_id")
        .select(["approval_group.id", "approval_group.name"])
        .where("approval_policy_group.approval_policy_id", "=", policyId)
        .orderBy("approval_group.name", "asc")
        .execute();

      return Response.json({
        ...policy,
        groups,
      });
    },
    "/api/admin/policies/update": async (req) => {
      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method !== "PATCH") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      let body: {
        id?: string;
        name?: string;
        auto_approve?: number;
        approval_group_ids?: string[];
      };
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const policyId = body.id?.trim() ?? "";
      const name = body.name?.trim() ?? "";
      const autoApprove = body.auto_approve ? 1 : 0;
      const approvalGroupIds = Array.from(
        new Set((body.approval_group_ids ?? []).map((gid) => gid?.trim()).filter((gid): gid is string => !!gid))
      );

      if (!policyId || !name) return Response.json({ error: "id and name are required" }, { status: 400 });
      if (autoApprove && approvalGroupIds.length > 0) {
        return Response.json({ error: "Auto approve policy cannot have groups" }, { status: 400 });
      }
      if (!autoApprove && approvalGroupIds.length < 1) {
        return Response.json({ error: "At least one group is required when auto approve is off" }, { status: 400 });
      }

      const existing = await db
        .selectFrom("approval_policy")
        .select("id")
        .where("id", "=", policyId)
        .executeTakeFirst();
      if (!existing) return Response.json({ error: "Policy not found" }, { status: 404 });

      const duplicate = await db
        .selectFrom("approval_policy")
        .select("id")
        .where("name", "=", name)
        .where("id", "!=", policyId)
        .executeTakeFirst();
      if (duplicate) return Response.json({ error: "Policy with this name already exists" }, { status: 409 });

      if (approvalGroupIds.length > 0) {
        const validGroups = await db
          .selectFrom("approval_group")
          .select("id")
          .where("id", "in", approvalGroupIds)
          .execute();
        if (validGroups.length !== approvalGroupIds.length) {
          return Response.json({ error: "One or more groups do not exist" }, { status: 400 });
        }
      }

      const now = new Date().toISOString();
      await db.transaction().execute(async (trx) => {
        await trx
          .updateTable("approval_policy")
          .set({
            name,
            auto_approve: autoApprove,
            updated_at: now,
          })
          .where("id", "=", policyId)
          .execute();

        await trx
          .deleteFrom("approval_policy_group")
          .where("approval_policy_id", "=", policyId)
          .execute();

        for (const approvalGroupId of approvalGroupIds) {
          await trx
            .insertInto("approval_policy_group")
            .values({
              id: crypto.randomUUID(),
              approval_policy_id: policyId,
              approval_group_id: approvalGroupId,
              created_at: now,
            })
            .execute();
        }
      });

      await db
        .insertInto("audit_log")
        .values({
          id: crypto.randomUUID(),
          actor_id: session.user.id,
          action: "approval_policy.updated",
          entity_type: "approval_policy",
          entity_id: policyId,
          metadata: JSON.stringify({
            name,
            auto_approve: autoApprove,
            group_count: approvalGroupIds.length,
          }),
          ip_address: req.headers.get("x-forwarded-for") ?? null,
          created_at: now,
        })
        .execute();

      return Response.json({ id: policyId });
    },
    "/api/admin/policies/delete": async (req) => {
      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method !== "DELETE") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      let body: { id?: string };
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
      }

      const policyId = body.id?.trim() ?? "";
      if (!policyId) return Response.json({ error: "id is required" }, { status: 400 });

      const existing = await db
        .selectFrom("approval_policy")
        .select(["id", "name"])
        .where("id", "=", policyId)
        .executeTakeFirst();
      if (!existing) return Response.json({ error: "Policy not found" }, { status: 404 });

      const inUse = await db
        .selectFrom("resource")
        .select("id")
        .where("approval_policy_id", "=", policyId)
        .limit(1)
        .executeTakeFirst();
      if (inUse) {
        return Response.json({ error: "Policy is assigned to one or more resources" }, { status: 409 });
      }

      await db.deleteFrom("approval_policy").where("id", "=", policyId).execute();

      const now = new Date().toISOString();
      await db
        .insertInto("audit_log")
        .values({
          id: crypto.randomUUID(),
          actor_id: session.user.id,
          action: "approval_policy.deleted",
          entity_type: "approval_policy",
          entity_id: policyId,
          metadata: JSON.stringify({
            name: existing.name,
          }),
          ip_address: req.headers.get("x-forwarded-for") ?? null,
          created_at: now,
        })
        .execute();

      return Response.json({ id: policyId });
    },
    "/api/admin/approval-groups/detail": async (req) => {
      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const url = new URL(req.url);
      const groupId = url.searchParams.get("id")?.trim() ?? "";
      if (!groupId) return Response.json({ error: "id is required" }, { status: 400 });

      if (req.method === "GET") {
        const group = await db
          .selectFrom("approval_group")
          .select(["id", "name", "description", "created_at", "updated_at"])
          .where("id", "=", groupId)
          .executeTakeFirst();

        if (!group) {
          return Response.json({ error: "Approval group not found" }, { status: 404 });
        }

        const members = await db
          .selectFrom("approval_group_member")
          .innerJoin("user", "user.id", "approval_group_member.user_id")
          .select([
            "approval_group_member.user_id",
            "user.name",
            "user.email",
            "approval_group_member.created_at",
          ])
          .where("approval_group_member.approval_group_id", "=", groupId)
          .orderBy("user.name", "asc")
          .execute();

        return Response.json({
          ...group,
          members,
        });
      }

      return Response.json({ error: "Method not allowed" }, { status: 405 });
    },
    "/api/admin/approval-groups/update": async (req) => {
      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method === "PATCH") {
        let body: {
          id?: string;
          name?: string;
          description?: string | null;
          member_user_ids?: string[];
        };
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const groupId = body.id?.trim() ?? "";
        if (!groupId) return Response.json({ error: "id is required" }, { status: 400 });

        const existing = await db
          .selectFrom("approval_group")
          .select("id")
          .where("id", "=", groupId)
          .executeTakeFirst();

        if (!existing) {
          return Response.json({ error: "Approval group not found" }, { status: 404 });
        }

        const name = body.name?.trim() ?? "";
        const description = body.description?.trim() ?? null;
        const memberUserIds = Array.from(
          new Set((body.member_user_ids ?? []).map((id) => id?.trim()).filter((id): id is string => !!id))
        );

        if (!name) {
          return Response.json({ error: "name is required" }, { status: 400 });
        }

        const duplicate = await db
          .selectFrom("approval_group")
          .select("id")
          .where("name", "=", name)
          .where("id", "!=", groupId)
          .executeTakeFirst();

        if (duplicate) {
          return Response.json({ error: "Approval group with this name already exists" }, { status: 409 });
        }

        if (memberUserIds.length > 0) {
          const validUsers = await db
            .selectFrom("user")
            .select("id")
            .where("id", "in", memberUserIds)
            .execute();

          if (validUsers.length !== memberUserIds.length) {
            return Response.json({ error: "One or more selected users do not exist" }, { status: 400 });
          }
        }

        const now = new Date().toISOString();

        await db.transaction().execute(async (trx) => {
          await trx
            .updateTable("approval_group")
            .set({
              name,
              description,
              updated_at: now,
            })
            .where("id", "=", groupId)
            .execute();

          await trx
            .deleteFrom("approval_group_member")
            .where("approval_group_id", "=", groupId)
            .execute();

          for (const userId of memberUserIds) {
            await trx
              .insertInto("approval_group_member")
              .values({
                id: crypto.randomUUID(),
                approval_group_id: groupId,
                user_id: userId,
                created_at: now,
              })
              .execute();
          }
        });

        await db
          .insertInto("audit_log")
          .values({
            id: crypto.randomUUID(),
            actor_id: session.user.id,
            action: "approval_group.updated",
            entity_type: "approval_group",
            entity_id: groupId,
            metadata: JSON.stringify({
              name,
              member_count: memberUserIds.length,
            }),
            ip_address: req.headers.get("x-forwarded-for") ?? null,
            created_at: now,
          })
          .execute();

        return Response.json({ id: groupId });
      }

      return Response.json({ error: "Method not allowed" }, { status: 405 });
    },
    "/api/admin/approval-groups/delete": async (req) => {
      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method === "DELETE") {
        let body: { id?: string };
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const groupId = body.id?.trim() ?? "";
        if (!groupId) return Response.json({ error: "id is required" }, { status: 400 });

        const existing = await db
          .selectFrom("approval_group")
          .select(["id", "name"])
          .where("id", "=", groupId)
          .executeTakeFirst();

        if (!existing) {
          return Response.json({ error: "Approval group not found" }, { status: 404 });
        }

        await db.deleteFrom("approval_group").where("id", "=", groupId).execute();

        const now = new Date().toISOString();
        await db
          .insertInto("audit_log")
          .values({
            id: crypto.randomUUID(),
            actor_id: session.user.id,
            action: "approval_group.deleted",
            entity_type: "approval_group",
            entity_id: groupId,
            metadata: JSON.stringify({
              name: existing.name,
            }),
            ip_address: req.headers.get("x-forwarded-for") ?? null,
            created_at: now,
          })
          .execute();

        return Response.json({ id: groupId });
      }

      return Response.json({ error: "Method not allowed" }, { status: 405 });
    },
    "/api/resources/roles": async (req) => {
      try {
        await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method !== "GET") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      const url = new URL(req.url);
      const resourceId = url.searchParams.get("resource_id")?.trim() ?? "";
      if (!resourceId) return Response.json({ error: "resource_id is required" }, { status: 400 });

      const roles = await db
        .selectFrom("resource_role")
        .select(["id", "name", "is_admin"])
        .where("resource_id", "=", resourceId)
        .orderBy("name", "asc")
        .execute();

      return Response.json(roles);
    },
    "/api/access-requests/review": async (req) => {
      return Response.json({ error: "Approval flow is disabled" }, { status: 410 });
    },
    "/api/purchase-requests/review": async (req) => {
      return Response.json({ error: "Approval flow is disabled" }, { status: 410 });
    },
    "/api/my-access/detail": async (req) => {
      if (req.method !== "GET") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      let session;
      try {
        session = await requireSession(req);
      } catch {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const url = new URL(req.url);
      const requestId = url.searchParams.get("request_id")?.trim() ?? "";
      if (!requestId) return Response.json({ error: "request_id is required" }, { status: 400 });

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

      return Response.json({
        ...request,
        approvals,
        grant,
      });
    },
    "/api/*": async () => Response.json({ error: "Not found" }, { status: 404 }),

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
          lease_duration_days: number | null;
          reason: string | null;
        };
        try {
          body = await req.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { resource_id, lease_duration_days, reason } = body;

        if (!resource_id) {
          return Response.json({ error: "resource_id is required" }, { status: 400 });
        }

        // Verify resource exists
        const resource = await db
          .selectFrom("resource")
          .select(["id"])
          .where("id", "=", resource_id)
          .executeTakeFirst();

        if (!resource) {
          return Response.json({ error: "Resource not found" }, { status: 404 });
        }

        let role = await db
          .selectFrom("resource_role")
          .select(["id"])
          .where("resource_id", "=", resource_id)
          .orderBy("created_at", "asc")
          .executeTakeFirst();

        if (!role) {
          const roleId = crypto.randomUUID();
          const now = new Date().toISOString();
          await db
            .insertInto("resource_role")
            .values({
              id: roleId,
              resource_id: resource_id,
              name: "Default",
              description: null,
              requires_approval: null,
              approval_count: null,
              is_admin: 0,
              created_at: now,
            })
            .execute();
          role = { id: roleId };
        }

        // Check for existing active request
        const existing = await db
          .selectFrom("access_request")
          .select("id")
          .where("requester_id", "=", session.user.id)
          .where("resource_id", "=", resource_id)
          .where("resource_role_id", "=", role.id)
          .where("status", "in", ["pending", "approved"])
          .executeTakeFirst();

        if (existing) {
          return Response.json({ error: "You already have an access request for this resource" }, { status: 409 });
        }

        const now = new Date().toISOString();
        const requestId = crypto.randomUUID();

        const status = "approved";

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
            resource_role_id: role.id,
            status,
            reason: reason ?? null,
            lease_duration_days: lease_duration_days ?? null,
            expires_at: expiresAt,
            created_at: now,
            updated_at: now,
          })
          .execute();

        const grantId = crypto.randomUUID();
        await db
          .insertInto("access_grant")
          .values({
            id: grantId,
            user_id: session.user.id,
            resource_id,
            resource_role_id: role.id,
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
              resource_role_id: role.id,
              expires_at: expiresAt,
            }),
            ip_address: req.headers.get("x-forwarded-for") ?? null,
            created_at: now,
          })
          .execute();

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
              resource_role_id: role.id,
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

        return Response.json({
          access_approvals: [],
          purchase_approvals: [],
        });
      } catch (error) {
        console.error("Failed to fetch my approvals", error);
        return Response.json({ error: "Failed to fetch my approvals" }, { status: 500 });
      }
    },

    "/": index,
    "/*": index,
  },
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return new Response(Bun.file("src/index.html"));
  },
});

console.log(`Server running at http://localhost:${server.port}`);
