import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("secret").addColumn("archived_at", "date").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("secret").dropColumn("archived_at").execute();
}
