import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("access_grant")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("resource_id", "text", (col) => col.notNull())
    .addColumn("resource_role_id", "text", (col) => col.notNull())
    .addColumn("access_request_id", "text") // null if granted manually
    .addColumn("status", "text", (col) => col.notNull().defaultTo("active")) // active | expired | revoked
    .addColumn("granted_at", "date", (col) => col.notNull())
    .addColumn("expires_at", "date") // null = forever
    .addColumn("revoked_at", "date")
    .addColumn("created_at", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_access_grant", ["id"])
    .addForeignKeyConstraint(
      "fk_access_grant_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_access_grant_resource_id",
      ["resource_id"],
      "resource",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_access_grant_resource_role_id",
      ["resource_role_id"],
      "resource_role",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_access_grant_access_request_id",
      ["access_request_id"],
      "access_request",
      ["id"],
      (cb) => cb.onDelete("set null")
    )
    .execute();

  await db.schema
    .createIndex("idx_access_grant_user_id")
    .on("access_grant")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("idx_access_grant_resource_id")
    .on("access_grant")
    .column("resource_id")
    .execute();

  await db.schema
    .createIndex("idx_access_grant_status")
    .on("access_grant")
    .column("status")
    .execute();

  await db.schema
    .createIndex("idx_access_grant_expires_at")
    .on("access_grant")
    .column("expires_at")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_access_grant_expires_at").ifExists().execute();
  await db.schema.dropIndex("idx_access_grant_status").ifExists().execute();
  await db.schema.dropIndex("idx_access_grant_resource_id").ifExists().execute();
  await db.schema.dropIndex("idx_access_grant_user_id").ifExists().execute();
  await db.schema.dropTable("access_grant").ifExists().execute();
}
