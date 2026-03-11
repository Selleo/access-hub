import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("secret")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("resource_id", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("encrypted_value", "text", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull()) // password | mfa_totp | ssh_key | api_key | note
    .addColumn("created_by", "text", (col) => col.notNull())
    .addColumn("created_at", "date", (col) => col.notNull())
    .addColumn("updated_at", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_secret", ["id"])
    .addForeignKeyConstraint(
      "fk_secret_resource_id",
      ["resource_id"],
      "resource",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_secret_created_by",
      ["created_by"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("idx_secret_resource_id")
    .on("secret")
    .column("resource_id")
    .execute();

  await db.schema
    .createIndex("idx_secret_type")
    .on("secret")
    .column("type")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_secret_type").ifExists().execute();
  await db.schema.dropIndex("idx_secret_resource_id").ifExists().execute();
  await db.schema.dropTable("secret").ifExists().execute();
}
