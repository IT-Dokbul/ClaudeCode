import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkEntry, WageRate, PayrollSettings } from '../types';
import { DEFAULT_WAGE_RATES, DEFAULT_SETTINGS } from '../types';

interface AppState {
  entries: WorkEntry[];
  wageRates: WageRate[];
  settings: PayrollSettings;
  customHolidays: string[];      // 'YYYY-MM-DD' 형식

  addEntry: (entry: WorkEntry) => void;
  updateEntry: (entry: WorkEntry) => void;
  deleteEntry: (id: string) => void;

  saveWageRate: (rate: WageRate) => void;
  deleteWageRate: (year: number) => void;

  saveSettings: (settings: PayrollSettings) => void;

  addCustomHoliday: (date: string) => void;
  removeCustomHoliday: (date: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      entries: [],
      wageRates: DEFAULT_WAGE_RATES,
      settings: DEFAULT_SETTINGS,
      customHolidays: [],

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
    }),
    { name: 'wage-calc-store' },
  ),
);
