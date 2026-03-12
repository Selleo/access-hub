import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("resource")
    .addColumn("tag", "text")
    .execute();

  await db.schema
    .alterTable("resource")
    .addColumn("global_visible", "integer", (col) => col.notNull().defaultTo(1))
    .execute();

  await sql`
    UPDATE resource
    SET type = 'secure_note'
    WHERE type NOT IN ('software', 'secure_note')
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("resource").dropColumn("global_visible").execute();
  await db.schema.alterTable("resource").dropColumn("tag").execute();
}
