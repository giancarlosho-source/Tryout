// IndexedDB wrapper for local court recordings + player tags
// Videos never leave the device unless the coach explicitly uploads them.

const DB_NAME = "tryoutdesk-videos";
const DB_VERSION = 1;

export interface PlayerTag {
  playerId: number;
  playerName: string;
  jerseyNumber?: string | null;
  timestampMs: number; // ms from start of recording
  skill?: string;
  note?: string;
}

export interface Recording {
  id: string; // uuid
  clubSlug: string;
  date: string; // ISO date string
  label: string; // e.g. "Court 1 – Serving"
  durationMs: number;
  blob: Blob;
  tags: PlayerTag[];
  createdAt: number; // Date.now()
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("recordings")) {
        db.createObjectStore("recordings", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecording(recording: Recording): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("recordings", "readwrite");
    tx.objectStore("recordings").put(recording);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listRecordings(clubSlug: string): Promise<Omit<Recording, "blob">[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("recordings", "readonly");
    const req = tx.objectStore("recordings").getAll();
    req.onsuccess = () => {
      const all = (req.result as Recording[])
        .filter((r) => r.clubSlug === clubSlug)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(({ blob: _blob, ...rest }) => rest);
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getRecording(id: string): Promise<Recording | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("recordings", "readonly");
    const req = tx.objectStore("recordings").get(id);
    req.onsuccess = () => resolve((req.result as Recording) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("recordings", "readwrite");
    tx.objectStore("recordings").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateTags(id: string, tags: PlayerTag[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("recordings", "readwrite");
    const store = tx.objectStore("recordings");
    const req = store.get(id);
    req.onsuccess = () => {
      const rec = req.result as Recording;
      if (!rec) { reject(new Error("Recording not found")); return; }
      store.put({ ...rec, tags });
      tx.oncomplete = () => resolve();
    };
    req.onerror = () => reject(req.error);
  });
}
