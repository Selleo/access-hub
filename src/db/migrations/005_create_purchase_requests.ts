import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("purchase_request")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("requester_id", "text", (col) => col.notNull())
    .addColumn("software_name", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("url", "text")
    .addColumn("justification", "text", (col) => col.notNull())
    .addColumn("estimated_cost", "text")
    .addColumn("status", "text", (col) => col.notNull().defaultTo("pending")) // pending | approved | rejected | purchased
    .addColumn("reviewer_id", "text")
    .addColumn("created_at", "date", (col) => col.notNull())
    .addColumn("updated_at", "date", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_purchase_request", ["id"])
    .addForeignKeyConstraint(
      "fk_purchase_request_requester_id",
      ["requester_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("cascade")
    )
    .addForeignKeyConstraint(
      "fk_purchase_request_reviewer_id",
      ["reviewer_id"],
      "user",
      ["id"],
      (cb) => cb.onDelete("set null")
    )
    .execute();

  await db.schema
    .createIndex("idx_purchase_request_requester_id")
    .on("purchase_request")
    .column("requester_id")
    .execute();

  await db.schema
    .createIndex("idx_purchase_request_status")
    .on("purchase_request")
    .column("status")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_purchase_request_status").ifExists().execute();
  await db.schema.dropIndex("idx_purchase_request_requester_id").ifExists().execute();
  await db.schema.dropTable("purchase_request").ifExists().execute();
}
