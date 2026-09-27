import {
  ref,
  get,
  set,
  update,
  push,
  onValue,
  off,
  remove,
  runTransaction,
  query,
  limitToLast,
  orderByKey,
  TransactionResult
} from 'firebase/database';
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
  },

  /**
   * Phase 19: Atomic Transaction with Concurrency & Race-Condition Guarding
   */
  async runAtomicTransaction<T>(
    path: string,
    updateFn: (currentData: T | null) => T | undefined
  ): Promise<TransactionResult> {
    const dbRef = ref(rtdb, path);
    return await runTransaction(dbRef, updateFn);
  },

  /**
   * Phase 19: Server-side pagination query to prevent in-memory browser bloat
   */
  async getPaginated<T>(path: string, limitCount: number = 50): Promise<T[]> {
    const dbRef = ref(rtdb, path);
    const q = query(dbRef, orderByKey(), limitToLast(limitCount));
    const snapshot = await get(q);
    if (!snapshot.exists()) return [];
    const val = snapshot.val();
    return Object.values(val) as T[];
  },

  /**
   * Phase 19: Active-Record lightweight indexing for non-paid records
   */
  async getActiveInvoices<T>(tenantId: string): Promise<T[]> {
    const activeIndex = await this.get<Record<string, T>>(`activeInvoices/${tenantId}`);
    if (activeIndex) {
      return Object.values(activeIndex);
    }
    // Fallback to filtering all invoices
    const all = await this.get<Record<string, any>>(`invoices/${tenantId}`);
    if (!all) return [];
    return Object.values(all).filter((inv) => inv.balance > 0) as T[];
  },

  async indexActiveInvoice(tenantId: string, invoiceId: string, invoiceData: any): Promise<void> {
    if (invoiceData.balance > 0) {
      await this.set(`activeInvoices/${tenantId}/${invoiceId}`, invoiceData);
    } else {
      await this.remove(`activeInvoices/${tenantId}/${invoiceId}`);
    }
  },

  /**
   * Phase 19: Pre-calculated materialized metrics table
   */
  async getDashboardSummary<T>(tenantId: string): Promise<T | null> {
    return await this.get<T>(`dashboardSummary/${tenantId}`);
  },

  async updateDashboardSummary(tenantId: string, summary: Record<string, any>): Promise<void> {
    await this.update(`dashboardSummary/${tenantId}`, {
      ...summary,
      updatedAt: Date.now(),
    });
  }
};
