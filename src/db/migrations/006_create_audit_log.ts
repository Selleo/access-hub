import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("audit_log")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("actor_id", "text") // null for system actions
    .addColumn("action", "text", (col) => col.notNull()) // e.g. access.requested, access.approved, resource.created
    .addColumn("entity_type", "text", (col) => col.notNull()) // resource, access_request, access_grant, etc.
    .addColumn("entity_id", "text", (col) => col.notNull())
    .addColumn("metadata", "text") // JSON blob for extra context
    .addColumn("ip_address", "text")
    .addColumn("created_at", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_audit_log", ["id"])
    .addForeignKeyConstraint(
      "fk_audit_log_actor_id",
      ["actor_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("set null")
    )
    .execute();

  await db.schema
    .createIndex("idx_audit_log_actor_id")
    .on("audit_log")
    .column("actor_id")
    .execute();

  await db.schema
    .createIndex("idx_audit_log_entity")
    .on("audit_log")
    .columns(["entity_type", "entity_id"])
    .execute();

  await db.schema
    .createIndex("idx_audit_log_action")
    .on("audit_log")
    .column("action")
    .execute();

  await db.schema
    .createIndex("idx_audit_log_created_at")
    .on("audit_log")
    .column("created_at")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_audit_log_created_at").ifExists().execute();
  await db.schema.dropIndex("idx_audit_log_action").ifExists().execute();
  await db.schema.dropIndex("idx_audit_log_entity").ifExists().execute();
  await db.schema.dropIndex("idx_audit_log_actor_id").ifExists().execute();
  await db.schema.dropTable("audit_log").ifExists().execute();
}
