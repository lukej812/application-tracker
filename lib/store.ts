/**
 * Results live in this browser only, in IndexedDB. Nothing is sent to a
 * server for storage. clearAll() is the "delete everything" button.
 */
const DB_NAME = "callback";
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const load = <T>(key: string) => run<T | undefined>("readonly", (s) => s.get(key));
export const save = (key: string, value: unknown) => run<IDBValidKey>("readwrite", (s) => s.put(value, key));
export const clearAll = () => run<undefined>("readwrite", (s) => s.clear());
