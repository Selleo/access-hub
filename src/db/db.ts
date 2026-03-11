import { Database } from "bun:sqlite";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { Kysely, type Migration, Migrator } from "kysely";
import fs from "node:fs";

import * as Mig001 from "./migrations/001_create_auth_tables.ts";
import * as Mig002 from "./migrations/002_create_resources.ts";
import * as Mig003 from "./migrations/003_create_access_requests.ts";
import * as Mig004 from "./migrations/004_create_access_grants.ts";
import * as Mig005 from "./migrations/005_create_purchase_requests.ts";
import * as Mig006 from "./migrations/006_create_audit_log.ts";
import * as Mig007 from "./migrations/007_create_secrets.ts";

fs.mkdirSync("data", { recursive: true });

export async function migrateToLatest() {
  const db = new Kysely<Database>({
    dialect: new BunSqliteDialect({
      database: new Database("data/app.sqlite"),
    }),
  });

  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations(): Promise<Record<string, Migration>> {
        return {
          "001": Mig001,
          "002": Mig002,
          "003": Mig003,
          "004": Mig004,
          "005": Mig005,
          "006": Mig006,
          "007": Mig007,
        };
      },
    },
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("failed to migrate");
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
}
