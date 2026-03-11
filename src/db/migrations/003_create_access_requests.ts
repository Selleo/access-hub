import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("access_request")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("requester_id", "text", (col) => col.notNull())
    .addColumn("resource_id", "text", (col) => col.notNull())
    .addColumn("resource_role_id", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("pending")) // pending | approved | rejected | cancelled
    .addColumn("reason", "text")
    .addColumn("lease_duration_days", "integer") // null = forever
    .addColumn("expires_at", "date") // computed when approved
    .addColumn("created_at", "date", (col) => col.notNull())
    .addColumn("updated_at", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_access_request", ["id"])
    .addForeignKeyConstraint(
      "fk_access_request_requester_id",
      ["requester_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_access_request_resource_id",
      ["resource_id"],
      "resource",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_access_request_resource_role_id",
      ["resource_role_id"],
      "resource_role",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("idx_access_request_requester_id")
    .on("access_request")
    .column("requester_id")
    .execute();

  await db.schema
    .createIndex("idx_access_request_resource_id")
    .on("access_request")
    .column("resource_id")
    .execute();

  await db.schema
    .createIndex("idx_access_request_status")
    .on("access_request")
    .column("status")
    .execute();

  await db.schema
    .createTable("access_approval")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("access_request_id", "text", (col) => col.notNull())
    .addColumn("approver_id", "text", (col) => col.notNull())
    .addColumn("decision", "text", (col) => col.notNull()) // approved | rejected
    .addColumn("comment", "text")
    .addColumn("created_at", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_access_approval", ["id"])
    .addForeignKeyConstraint(
      "fk_access_approval_access_request_id",
      ["access_request_id"],
      "access_request",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_access_approval_approver_id",
      ["approver_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("idx_access_approval_access_request_id")
    .on("access_approval")
    .column("access_request_id")
    .execute();

  await db.schema
    .createIndex("idx_access_approval_approver_id")
    .on("access_approval")
    .column("approver_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_access_approval_approver_id").ifExists().execute();
  await db.schema.dropIndex("idx_access_approval_access_request_id").ifExists().execute();
  await db.schema.dropTable("access_approval").ifExists().execute();

  await db.schema.dropIndex("idx_access_request_status").ifExists().execute();
  await db.schema.dropIndex("idx_access_request_resource_id").ifExists().execute();
  await db.schema.dropIndex("idx_access_request_requester_id").ifExists().execute();
  await db.schema.dropTable("access_request").ifExists().execute();
}
