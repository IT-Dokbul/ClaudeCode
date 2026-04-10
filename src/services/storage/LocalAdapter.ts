import type { StorageAdapter } from './StorageAdapter';
import type { WorkEntry, WageRate, PayrollSettings } from '../../types';
import { DEFAULT_WAGE_RATES, DEFAULT_SETTINGS } from '../../types';

const KEYS = {
  entries: 'wage_calc:entries',
  wageRates: 'wage_calc:wage_rates',
  settings: 'wage_calc:settings',
} as const;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const LocalAdapter: StorageAdapter = {
  async getEntries() {
    return load<WorkEntry[]>(KEYS.entries, []);
  },
  async saveEntry(entry) {
    const entries = load<WorkEntry[]>(KEYS.entries, []);
    save(KEYS.entries, [...entries, entry]);
  },
  async updateEntry(entry) {
    const entries = load<WorkEntry[]>(KEYS.entries, []);
    save(KEYS.entries, entries.map((e) => (e.id === entry.id ? entry : e)));
  },
  async deleteEntry(id) {
    const entries = load<WorkEntry[]>(KEYS.entries, []);
    save(KEYS.entries, entries.filter((e) => e.id !== id));
  },

  async getWageRates() {
    return load<WageRate[]>(KEYS.wageRates, DEFAULT_WAGE_RATES);
  },
  async saveWageRate(rate) {
    const rates = load<WageRate[]>(KEYS.wageRates, DEFAULT_WAGE_RATES);
    const existing = rates.findIndex((r) => r.year === rate.year);
    if (existing >= 0) {
      rates[existing] = rate;
    } else {
      rates.push(rate);
    }
    save(KEYS.wageRates, rates);
  },
  async deleteWageRate(year) {
    const rates = load<WageRate[]>(KEYS.wageRates, DEFAULT_WAGE_RATES);
    save(KEYS.wageRates, rates.filter((r) => r.year !== year));
  },

  async getSettings() {
    return load<PayrollSettings>(KEYS.settings, DEFAULT_SETTINGS);
  },
  async saveSettings(settings) {
    save(KEYS.settings, settings);
  },
};
