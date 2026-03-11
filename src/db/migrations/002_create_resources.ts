import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("resource")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("type", "text", (col) => col.notNull()) // software | secure_note | infrastructure
    .addColumn("url", "text")
    .addColumn("icon_url", "text")
    .addColumn("owner_id", "text", (col) => col.notNull())
    .addColumn("requires_approval", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("approval_count", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("created_at", "date", (col) => col.notNull())
    .addColumn("updated_at", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_resource", ["id"])
    .addForeignKeyConstraint(
      "fk_resource_owner_id",
      ["owner_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("idx_resource_owner_id")
    .on("resource")
    .column("owner_id")
    .execute();

  await db.schema
    .createIndex("idx_resource_type")
    .on("resource")
    .column("type")
    .execute();

  await db.schema
    .createTable("resource_role")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("resource_id", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("requires_approval", "integer") // null = inherit from resource
    .addColumn("approval_count", "integer") // null = inherit from resource
    .addColumn("created_at", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_resource_role", ["id"])
    .addForeignKeyConstraint(
      "fk_resource_role_resource_id",
      ["resource_id"],
      "resource",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("idx_resource_role_resource_id")
    .on("resource_role")
    .column("resource_id")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_resource_role_resource_id").ifExists().execute();
  await db.schema.dropTable("resource_role").ifExists().execute();

  await db.schema.dropIndex("idx_resource_type").ifExists().execute();
  await db.schema.dropIndex("idx_resource_owner_id").ifExists().execute();
  await db.schema.dropTable("resource").ifExists().execute();
}
