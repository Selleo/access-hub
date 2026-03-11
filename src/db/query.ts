import { Database as SQLiteDatabase } from "bun:sqlite";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Kysely } from "kysely";
import type { Database } from "./schema";

export const db = new Kysely<Database>({
  dialect: new BunSqliteDialect({
    database: new SQLiteDatabase("data/app.sqlite"),
  }),
});
