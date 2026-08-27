/* ==========================================================================
   PROBE — db.js
   Thin IndexedDB wrapper. No backend, no network calls. Everything local.
   Stores:
     - analyses    (keyPath: id)      one record per discovery call analysed
     - methodology (keyPath: key)     single record, key = "current"
     - settings    (keyPath: key)     single record, key = "current"
     - drafts      (keyPath: id)      in-progress "New Discovery" wizard state
   ========================================================================== */

const ProbeDB = (() => {
  const DB_NAME = "probe-db";
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("analyses")) {
          const s = db.createObjectStore("analyses", { keyPath: "id" });
          s.createIndex("createdAt", "createdAt");
        }
        if (!db.objectStoreNames.contains("methodology")) {
          db.createObjectStore("methodology", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("drafts")) {
          db.createObjectStore("drafts", { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return {
    async put(storeName, value) {
      const store = await tx(storeName, "readwrite");
      return reqToPromise(store.put(value));
    },
    async get(storeName, key) {
      const store = await tx(storeName, "readonly");
      return reqToPromise(store.get(key));
    },
    async getAll(storeName) {
      const store = await tx(storeName, "readonly");
      return reqToPromise(store.getAll());
    },
    async delete(storeName, key) {
      const store = await tx(storeName, "readwrite");
      return reqToPromise(store.delete(key));
    },
    async clear(storeName) {
      const store = await tx(storeName, "readwrite");
      return reqToPromise(store.clear());
    },
  };
})();
