import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkEntry, WageRate, PayrollSettings, Store, Employee } from '../types';
import { DEFAULT_WAGE_RATES, DEFAULT_SETTINGS } from '../types';

interface AppState {
  entries: WorkEntry[];
  wageRates: WageRate[];
  settings: PayrollSettings;
  customHolidays: string[];      // 'YYYY-MM-DD' 형식
  stores: Store[];
  employees: Employee[];

  addEntry: (entry: WorkEntry) => void;
  updateEntry: (entry: WorkEntry) => void;
  deleteEntry: (id: string) => void;

  saveWageRate: (rate: WageRate) => void;
  deleteWageRate: (year: number) => void;

  saveSettings: (settings: PayrollSettings) => void;

  addCustomHoliday: (date: string) => void;
  removeCustomHoliday: (date: string) => void;

  addStore: (store: Store) => void;
  updateStore: (store: Store) => void;
  deleteStore: (id: string) => void;

  addEmployee: (employee: Employee) => void;
  updateEmployee: (employee: Employee) => void;
  deleteEmployee: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      entries: [],
      wageRates: DEFAULT_WAGE_RATES,
      settings: DEFAULT_SETTINGS,
      customHolidays: [],
      stores: [],
      employees: [],

      addEntry: (entry) =>
        set((s) => ({ entries: [...s.entries, entry] })),

      updateEntry: (entry) =>
        set((s) => ({ entries: s.entries.map((e) => (e.id === entry.id ? entry : e)) })),

      deleteEntry: (id) =>
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

      saveWageRate: (rate) =>
        set((s) => {
          const exists = s.wageRates.findIndex((r) => r.year === rate.year);
          if (exists >= 0) {
            const updated = [...s.wageRates];
            updated[exists] = rate;
            return { wageRates: updated };
          }
          return { wageRates: [...s.wageRates, rate].sort((a, b) => a.year - b.year) };
        }),

      deleteWageRate: (year) =>
        set((s) => ({ wageRates: s.wageRates.filter((r) => r.year !== year) })),

      saveSettings: (settings) => set({ settings }),

      addCustomHoliday: (date) =>
        set((s) => ({
          customHolidays: s.customHolidays.includes(date)
            ? s.customHolidays
            : [...s.customHolidays, date].sort(),
        })),

      removeCustomHoliday: (date) =>
        set((s) => ({ customHolidays: s.customHolidays.filter((d) => d !== date) })),

      addStore: (store) =>
        set((s) => ({ stores: [...s.stores, store] })),

      updateStore: (store) =>
        set((s) => ({ stores: s.stores.map((st) => (st.id === store.id ? store : st)) })),

      deleteStore: (id) =>
        set((s) => ({
          stores: s.stores.filter((st) => st.id !== id),
          employees: s.employees.filter((e) => e.storeId !== id),
        })),

      addEmployee: (employee) =>
        set((s) => ({ employees: [...s.employees, employee] })),

      updateEmployee: (employee) =>
        set((s) => ({ employees: s.employees.map((e) => (e.id === employee.id ? employee : e)) })),

      deleteEmployee: (id) =>
        set((s) => ({ employees: s.employees.filter((e) => e.id !== id) })),
    }),
    { name: 'wage-calc-store' },
  ),
);
