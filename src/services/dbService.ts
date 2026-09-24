import { ref, get, set, update, push, onValue, off, remove } from 'firebase/database';
import { rtdb } from './firebase';

export const dbService = {
  getRef(path: string) {
    return ref(rtdb, path);
  },

  async get<T>(path: string): Promise<T | null> {
    const dbRef = ref(rtdb, path);
    const snapshot = await get(dbRef);
    if (!snapshot.exists()) return null;
    return snapshot.val() as T;
  },

  async set<T>(path: string, data: T): Promise<void> {
    const dbRef = ref(rtdb, path);
    await set(dbRef, data);
  },

  async update(path: string, data: Record<string, any>): Promise<void> {
    const dbRef = ref(rtdb, path);
    await update(dbRef, data);
  },

  async push<T>(path: string, data: T): Promise<string> {
    const dbRef = ref(rtdb, path);
    const newRef = push(dbRef);
    await set(newRef, data);
    return newRef.key as string;
  },

  async remove(path: string): Promise<void> {
    const dbRef = ref(rtdb, path);
    await remove(dbRef);
  },

  subscribe<T>(path: string, callback: (data: T | null) => void): () => void {
    const dbRef = ref(rtdb, path);
    const listener = onValue(dbRef, (snapshot) => {
      callback(snapshot.exists() ? (snapshot.val() as T) : null);
    });
    return () => off(dbRef, 'value', listener);
  }
};
