import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StoreConfig, MonthData } from '../types/schedule';
import { generateId } from '../utils/id';

const EMPTY_MONTH: MonthData = {
  aOff: [], bOff: [], aSub: false, bSub: false,
  sch: null, status: 'none', comment: '',
};

interface ScheduleState {
  stores: StoreConfig[];
  db: Record<string, Record<string, MonthData>>;

  addStore: (config: Omit<StoreConfig, 'id'>) => void;
  updateStore: (store: StoreConfig) => void;
  deleteStore: (id: string) => void;
  patchMonth: (storeId: string, yearMonth: string, updates: Partial<MonthData>) => void;
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set) => ({
      stores: [],
      db: {},

      addStore: (config) =>
        set((s) => ({ stores: [...s.stores, { id: generateId(), ...config }] })),

      updateStore: (store) =>
        set((s) => ({ stores: s.stores.map((st) => (st.id === store.id ? store : st)) })),

      deleteStore: (id) =>
        set((s) => {
          const newDb = { ...s.db };
          delete newDb[id];
          return { stores: s.stores.filter((st) => st.id !== id), db: newDb };
        }),

      patchMonth: (storeId, yearMonth, updates) =>
        set((s) => {
          const storeMd = s.db[storeId] || {};
          const current = storeMd[yearMonth] || EMPTY_MONTH;
          return {
            db: {
              ...s.db,
              [storeId]: { ...storeMd, [yearMonth]: { ...current, ...updates } },
            },
          };
        }),
    }),
    { name: 'schedule-store-v1' },
  ),
);
