import type { StateStorage } from "zustand/middleware";

import {
  createBrowserSqlJsBundle,
  type BrowserSqlJsAdapterOptions,
  type SQLiteDatabaseBundle,
} from "./client";

const DEFAULT_BINARY_DATABASE_NAME = "trackwallet-native-authority";
const DEFAULT_BINARY_STORE_NAME = "sqlite-binaries";
const DEFAULT_BINARY_KEY = "alpha-authority";
const DEFAULT_DOCUMENTS_TABLE_NAME = "persist_documents";

interface SqlJsQueryResult {
  columns: string[];
  values: unknown[][];
}

interface SqlJsRawDatabase {
  run(sql: string): void;
  exec(sql: string): SqlJsQueryResult[];
  export(): Uint8Array;
}

export interface SQLiteBinaryStorage {
  load(): Promise<Uint8Array | null>;
  save(data: Uint8Array): Promise<void>;
  clear(): Promise<void>;
}

export interface SQLiteStateStorage extends StateStorage {
  flush(): Promise<void>;
  clearAll(): Promise<void>;
}

export interface MemorySqliteBinaryStorageOptions {
  seedData?: Uint8Array | null;
}

export interface IndexedDbSqliteBinaryStorageOptions {
  databaseName?: string;
  storeName?: string;
  key?: string;
}

export interface SQLiteStateStorageOptions extends BrowserSqlJsAdapterOptions {
  binaryStorage?: SQLiteBinaryStorage;
  legacyStorage?: Pick<StateStorage, "getItem">;
  documentsTableName?: string;
}

function escapeIdentifier(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Invalid SQLite identifier: ${value}`);
  }

  return `"${value}"`;
}

function escapeSqliteString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function requireIndexedDb(): IDBFactory {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "IndexedDB is not available for the native SQLite authority runtime.",
    );
  }

  return indexedDB;
}

function openIndexedDbDatabase(
  options: IndexedDbSqliteBinaryStorageOptions,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const factory = requireIndexedDb();
    const request = factory.open(
      options.databaseName ?? DEFAULT_BINARY_DATABASE_NAME,
      1,
    );

    request.onupgradeneeded = () => {
      const database = request.result;
      const storeName = options.storeName ?? DEFAULT_BINARY_STORE_NAME;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName);
      }
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open IndexedDB database."));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function runIndexedDbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed."));
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    };
  });
}

function ensureDocumentsTable(
  rawDatabase: SqlJsRawDatabase,
  documentsTableName: string,
): void {
  const table = escapeIdentifier(documentsTableName);
  rawDatabase.run(
    `CREATE TABLE IF NOT EXISTS ${table} (
      name TEXT PRIMARY KEY NOT NULL,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
}

function readDocument(
  rawDatabase: SqlJsRawDatabase,
  documentsTableName: string,
  name: string,
): string | null {
  const table = escapeIdentifier(documentsTableName);
  const result = rawDatabase.exec(
    `SELECT value_json FROM ${table} WHERE name = ${escapeSqliteString(name)} LIMIT 1`,
  );
  const value = result[0]?.values[0]?.[0];

  return typeof value === "string" ? value : null;
}

function writeDocument(
  rawDatabase: SqlJsRawDatabase,
  documentsTableName: string,
  name: string,
  value: string,
): void {
  const table = escapeIdentifier(documentsTableName);
  const now = new Date().toISOString();

  rawDatabase.run(
    `INSERT INTO ${table} (name, value_json, updated_at)
      VALUES (
        ${escapeSqliteString(name)},
        ${escapeSqliteString(value)},
        ${escapeSqliteString(now)}
      )
      ON CONFLICT(name) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at`,
  );
}

function deleteDocument(
  rawDatabase: SqlJsRawDatabase,
  documentsTableName: string,
  name: string,
): void {
  const table = escapeIdentifier(documentsTableName);
  rawDatabase.run(
    `DELETE FROM ${table} WHERE name = ${escapeSqliteString(name)}`,
  );
}

function clearDocuments(
  rawDatabase: SqlJsRawDatabase,
  documentsTableName: string,
): void {
  const table = escapeIdentifier(documentsTableName);
  rawDatabase.run(`DELETE FROM ${table}`);
}

export function createMemorySqliteBinaryStorage(
  options: MemorySqliteBinaryStorageOptions = {},
): SQLiteBinaryStorage {
  let current =
    options.seedData == null ? null : new Uint8Array(options.seedData);

  return {
    async load() {
      return current == null ? null : new Uint8Array(current);
    },
    async save(data) {
      current = new Uint8Array(data);
    },
    async clear() {
      current = null;
    },
  };
}

export function createIndexedDbSqliteBinaryStorage(
  options: IndexedDbSqliteBinaryStorageOptions = {},
): SQLiteBinaryStorage {
  const storeName = options.storeName ?? DEFAULT_BINARY_STORE_NAME;
  const key = options.key ?? DEFAULT_BINARY_KEY;

  return {
    async load() {
      const database = await openIndexedDbDatabase(options);
      try {
        const transaction = database.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const result = await runIndexedDbRequest(store.get(key));
        await transactionComplete(transaction);

        if (result instanceof Uint8Array) {
          return new Uint8Array(result);
        }
        if (result instanceof ArrayBuffer) {
          return new Uint8Array(result);
        }

        return null;
      } finally {
        database.close();
      }
    },
    async save(data) {
      const database = await openIndexedDbDatabase(options);
      try {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        store.put(new Uint8Array(data), key);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },
    async clear() {
      const database = await openIndexedDbDatabase(options);
      try {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        store.delete(key);
        await transactionComplete(transaction);
      } finally {
        database.close();
      }
    },
  };
}

export function createSQLiteStateStorage(
  options: SQLiteStateStorageOptions = {},
): SQLiteStateStorage {
  const binaryStorage =
    options.binaryStorage ?? createIndexedDbSqliteBinaryStorage();
  const documentsTableName =
    options.documentsTableName ?? DEFAULT_DOCUMENTS_TABLE_NAME;
  let bundlePromise: Promise<SQLiteDatabaseBundle> | null = null;
  let queue: Promise<void> = Promise.resolve();

  async function getBundle(): Promise<SQLiteDatabaseBundle> {
    if (!bundlePromise) {
      bundlePromise = (async () => {
        const seedData = await binaryStorage.load();
        const bundle = await createBrowserSqlJsBundle({
          locateFile: options.locateFile,
          seedData: seedData ?? undefined,
        });
        ensureDocumentsTable(
          bundle.rawDatabase as SqlJsRawDatabase,
          documentsTableName,
        );
        return bundle;
      })();
    }

    return bundlePromise;
  }

  async function persistBundle(bundle: SQLiteDatabaseBundle): Promise<void> {
    const rawDatabase = bundle.rawDatabase as SqlJsRawDatabase;
    await binaryStorage.save(rawDatabase.export());
  }

  function runQueued<T>(task: () => Promise<T>): Promise<T> {
    const next = queue.then(task, task);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async function readItem(name: string): Promise<string | null> {
    const bundle = await getBundle();
    const rawDatabase = bundle.rawDatabase as SqlJsRawDatabase;
    const storedValue = readDocument(rawDatabase, documentsTableName, name);

    if (storedValue != null) {
      return storedValue;
    }

    if (!options.legacyStorage) {
      return null;
    }

    const legacyValue = await options.legacyStorage.getItem(name);
    if (legacyValue == null) {
      return null;
    }

    writeDocument(rawDatabase, documentsTableName, name, legacyValue);
    await persistBundle(bundle);

    return legacyValue;
  }

  return {
    getItem(name) {
      return runQueued(() => readItem(name));
    },
    setItem(name, value) {
      return runQueued(async () => {
        const bundle = await getBundle();
        const rawDatabase = bundle.rawDatabase as SqlJsRawDatabase;
        writeDocument(rawDatabase, documentsTableName, name, value);
        await persistBundle(bundle);
      });
    },
    removeItem(name) {
      return runQueued(async () => {
        const bundle = await getBundle();
        const rawDatabase = bundle.rawDatabase as SqlJsRawDatabase;
        deleteDocument(rawDatabase, documentsTableName, name);
        await persistBundle(bundle);
      });
    },
    async flush() {
      await queue;
    },
    clearAll() {
      return runQueued(async () => {
        const bundle = await getBundle();
        const rawDatabase = bundle.rawDatabase as SqlJsRawDatabase;
        clearDocuments(rawDatabase, documentsTableName);
        await persistBundle(bundle);
      });
    },
  };
}
