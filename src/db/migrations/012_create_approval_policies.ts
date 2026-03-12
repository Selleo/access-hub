import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("approval_policy")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("auto_approve", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "date", (col) => col.notNull())
    .addColumn("updated_at", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_approval_policy", ["id"])
    .execute();

  await db.schema
    .createTable("approval_policy_group")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("approval_policy_id", "text", (col) => col.notNull())
    .addColumn("approval_group_id", "text", (col) => col.notNull())
    .addColumn("created_at", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_approval_policy_group", ["id"])
    .addForeignKeyConstraint(
      "fk_approval_policy_group_policy_id",
      ["approval_policy_id"],
      "approval_policy",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_approval_policy_group_group_id",
      ["approval_group_id"],
      "approval_group",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("idx_approval_policy_group_policy_id")
    .on("approval_policy_group")
    .column("approval_policy_id")
    .execute();

  await db.schema
    .createIndex("idx_approval_policy_group_group_id")
    .on("approval_policy_group")
    .column("approval_group_id")
    .execute();

  await db.schema
    .createIndex("idx_approval_policy_group_unique")
    .unique()
    .on("approval_policy_group")
    .columns(["approval_policy_id", "approval_group_id"])
    .execute();

  await db.schema.alterTable("resource").addColumn("approval_policy_id", "text").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("resource").dropColumn("approval_policy_id").execute();
  await db.schema.dropIndex("idx_approval_policy_group_unique").ifExists().execute();
  await db.schema.dropIndex("idx_approval_policy_group_group_id").ifExists().execute();
  await db.schema.dropIndex("idx_approval_policy_group_policy_id").ifExists().execute();
  await db.schema.dropTable("approval_policy_group").ifExists().execute();
  await db.schema.dropTable("approval_policy").ifExists().execute();
}
