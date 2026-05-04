import type { AuthorityMode, AuthorityRuntime } from "@omni-sync/core";

import { selectSQLiteMode } from "./mode";
import { sqliteSchema, type SQLiteSchema } from "./schema";

export type SQLiteClientRuntime = Extract<
  AuthorityRuntime,
  "web" | "memory" | "native_mobile"
>;

export interface SQLiteDatabaseBundle<TDatabase = unknown, TRawDatabase = unknown> {
  database: TDatabase;
  rawDatabase: TRawDatabase;
}

export interface SQLiteAdapter<TDatabase = unknown> {
  id: string;
  runtime: SQLiteClientRuntime;
  createDatabase: (mode: AuthorityMode) => Promise<TDatabase> | TDatabase;
}

export interface SQLiteClient<TDatabase = unknown> {
  mode: AuthorityMode;
  runtime: SQLiteClientRuntime;
  adapterId: string;
  database: TDatabase;
  schema: SQLiteSchema;
}

export interface BootstrapSQLiteClientOptions<TDatabase = unknown> {
  mode?: AuthorityMode | null;
  runtime?: SQLiteClientRuntime;
  adapter?: SQLiteAdapter<TDatabase>;
  demoAdapter?: SQLiteAdapter<TDatabase>;
  realAdapter?: SQLiteAdapter<TDatabase>;
  fallbackAdapter?: SQLiteAdapter<TDatabase>;
  allowReal?: boolean;
}

export const inMemoryAdapter: SQLiteAdapter<Record<string, never>> = {
  id: "memory-placeholder",
  runtime: "memory",
  createDatabase: () => ({}),
};

export function selectSQLiteAdapter<TDatabase = unknown>(
  options: BootstrapSQLiteClientOptions<TDatabase> = {},
): SQLiteAdapter<TDatabase> {
  const mode = selectSQLiteMode({
    mode: options.mode,
    allowReal: options.allowReal,
  });

  const modeAdapter = mode === "real" ? options.realAdapter : options.demoAdapter;
  const runtimeAdapter =
    options.runtime && options.adapter && options.adapter.runtime === options.runtime
      ? options.adapter
      : undefined;

  return (
    modeAdapter ??
    runtimeAdapter ??
    options.adapter ??
    options.fallbackAdapter ??
    (inMemoryAdapter as SQLiteAdapter<TDatabase>)
  );
}

export async function bootstrapSQLiteClient<TDatabase = unknown>(
  options: BootstrapSQLiteClientOptions<TDatabase> = {},
): Promise<SQLiteClient<TDatabase>> {
  const mode = selectSQLiteMode({
    mode: options.mode,
    allowReal: options.allowReal,
  });
  const adapter = selectSQLiteAdapter({
    ...options,
    mode,
  });
  const database = await adapter.createDatabase(mode);

  return {
    mode,
    runtime: adapter.runtime,
    adapterId: adapter.id,
    database,
    schema: sqliteSchema,
  };
}

export interface BrowserSqlJsAdapterOptions {
  locateFile?: (file: string) => string;
  seedData?: Uint8Array;
}

interface SqlJsDatabaseConstructor {
  new (data?: Uint8Array): unknown;
}

interface SqlJsInitResult {
  Database: SqlJsDatabaseConstructor;
}

interface SqlJsModuleShape {
  default: (config?: {
    locateFile?: (file: string) => string;
  }) => Promise<SqlJsInitResult>;
}

const sqlJsAssetUrls: Record<string, string> = {
  "sql-wasm.wasm": new URL(
    "../../../../node_modules/sql.js/dist/sql-wasm.wasm",
    import.meta.url,
  ).toString(),
  "sql-wasm-browser.wasm": new URL(
    "../../../../node_modules/sql.js/dist/sql-wasm-browser.wasm",
    import.meta.url,
  ).toString(),
};

function resolveSqlJsWasmUrl(file: string): string {
  const assetUrl = sqlJsAssetUrls[file];

  if (!assetUrl) {
    throw new Error(`Unsupported sql.js asset requested: ${file}`);
  }

  return assetUrl;
}

export async function createBrowserSqlJsBundle(
  options: BrowserSqlJsAdapterOptions = {},
): Promise<SQLiteDatabaseBundle> {
  const sqlJsModuleId = "sql.js";
  const [{ drizzle }, sqlJsModule] = await Promise.all([
    import("drizzle-orm/sql-js"),
    import(sqlJsModuleId) as Promise<SqlJsModuleShape>,
  ]);
  const SQL = await sqlJsModule.default({
    locateFile: options.locateFile ?? resolveSqlJsWasmUrl,
  });
  const rawDatabase = new SQL.Database(options.seedData);
  const database = drizzle(rawDatabase, { schema: sqliteSchema });

  return {
    database,
    rawDatabase,
  };
}

export function createBrowserSqlJsAdapter(
  options: BrowserSqlJsAdapterOptions = {},
): SQLiteAdapter<SQLiteDatabaseBundle> {
  return {
    id: "sqljs-browser",
    runtime: "web",
    createDatabase: () => createBrowserSqlJsBundle(options),
  };
}
