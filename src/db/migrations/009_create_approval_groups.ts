import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("approval_group")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("created_by", "text", (col) => col.notNull())
    .addColumn("created_at", "date", (col) => col.notNull())
    .addColumn("updated_at", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_approval_group", ["id"])
    .addForeignKeyConstraint(
      "fk_approval_group_created_by",
      ["created_by"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createTable("approval_group_member")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("approval_group_id", "text", (col) => col.notNull())
    .addColumn("user_id", "text", (col) => col.notNull())
    .addColumn("created_at", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_approval_group_member", ["id"])
    .addForeignKeyConstraint(
      "fk_approval_group_member_group_id",
      ["approval_group_id"],
      "approval_group",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_approval_group_member_user_id",
      ["user_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .execute();

  await db.schema
    .createIndex("idx_approval_group_name")
    .on("approval_group")
    .column("name")
    .execute();

  await db.schema
    .createIndex("idx_approval_group_member_group_id")
    .on("approval_group_member")
    .column("approval_group_id")
    .execute();

  await db.schema
    .createIndex("idx_approval_group_member_user_id")
    .on("approval_group_member")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("idx_approval_group_member_unique")
    .unique()
    .on("approval_group_member")
    .columns(["approval_group_id", "user_id"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_approval_group_member_unique").ifExists().execute();
  await db.schema.dropIndex("idx_approval_group_member_user_id").ifExists().execute();
  await db.schema.dropIndex("idx_approval_group_member_group_id").ifExists().execute();
  await db.schema.dropIndex("idx_approval_group_name").ifExists().execute();
  await db.schema.dropTable("approval_group_member").ifExists().execute();
  await db.schema.dropTable("approval_group").ifExists().execute();
}
